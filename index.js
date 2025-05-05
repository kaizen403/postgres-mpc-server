require("dotenv").config();
const fs = require("fs");
const http = require("http");
const { PrismaClient } = require("@prisma/client");
const { ChatGroq } = require("@langchain/groq");
const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

/* ───────────────────────────── Helpers ───────────────────────────── */
const log = (...args) => console.log(new Date().toISOString(), "-", ...args);

const cleanSQL = (raw) => {
  const block = raw.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  const sql = (block ? block[1] : raw).trim();
  return sql.endsWith(";") ? sql.slice(0, -1) : sql;
};

// read Prisma schema as UTF-8
const prismaSchema = fs.readFileSync("prisma/schema.prisma", "utf8");

/* ──────────────────────────── Bootstrap ──────────────────────────── */
(async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const groqKey = process.env.GROQ_API_KEY;
  if (!dbUrl || !groqKey) {
    console.error("Error: set DATABASE_URL and GROQ_API_KEY in .env");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const groqModel = new ChatGroq({
    apiKey: groqKey,
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  });

  const schemaPrompt =
    `You have this Prisma schema:\n\n${prismaSchema}\n\n` +
    "Translate the user’s request into a valid PostgreSQL query " +
    "using ONLY those tables/columns. **Wrap every table and column name in double quotes** to preserve case. " +
    "Return only the raw SQL.";
  const opInstructions = {
    select: "generate a SELECT.",
    create: "generate an INSERT.",
    update: "generate an UPDATE.",
    delete: "generate a DELETE.",
  };

  const runOp = async (op, nlPrompt) => {
    const resp = await groqModel.invoke([
      {
        role: "system",
        content: `${schemaPrompt}\n\nSpecifically, ${opInstructions[op]}`,
      },
      { role: "user", content: nlPrompt },
    ]);
    const sql = cleanSQL(resp.content);
    log(`${op.toUpperCase()} SQL:`, sql);
    if (op === "select") {
      const rows = await prisma.$queryRawUnsafe(sql);
      return { sql, rows };
    }
    const count = await prisma.$executeRawUnsafe(sql);
    return { sql, count };
  };

  const runRaw = async (rawInput) => {
    const sql = cleanSQL(rawInput);
    log("RAW SQL:", sql);
    if (/^\s*select/i.test(sql)) {
      const rows = await prisma.$queryRawUnsafe(sql);
      return { sql, rows };
    }
    const count = await prisma.$executeRawUnsafe(sql);
    return { sql, count };
  };

  const makeTool = (name, handler, description) =>
    tool(
      async (input) => {
        const out = await handler(input);
        return JSON.stringify(out);
      },
      { name, description, schema: z.string() },
    );

  const selectTool = makeTool(
    "select",
    (i) => runOp("select", i),
    "SELECT via natural-language prompt",
  );
  const createTool = makeTool(
    "create",
    (i) => runOp("create", i),
    "INSERT via natural-language prompt",
  );
  const updateTool = makeTool(
    "update",
    (i) => runOp("update", i),
    "UPDATE via natural-language prompt",
  );
  const deleteTool = makeTool(
    "delete",
    (i) => runOp("delete", i),
    "DELETE via natural-language prompt",
  );
  const rawSqlTool = makeTool(
    "rawSql",
    runRaw,
    "Execute a raw SQL query provided by the user",
  );

  const executor = await initializeAgentExecutorWithOptions(
    [selectTool, createTool, updateTool, deleteTool, rawSqlTool],
    groqModel,
    { agentType: "chat-zero-shot-react-description", verbose: false },
  );

  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/query") {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "error", error: "Not found" }));
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      res.setHeader("Content-Type", "application/json");
      try {
        const { prompt } = JSON.parse(body);
        if (!prompt) throw new Error("`prompt` field required");
        log("PROMPT:", prompt);

        // If the prompt looks like raw SQL, bypass agent
        let responseData;
        if (/^\s*(SELECT|INSERT|UPDATE|DELETE)\b/i.test(prompt.trim())) {
          responseData = await runRaw(prompt);
        } else {
          const result = await executor.invoke({ input: prompt });
          // extract tool output
          let out = result.output;
          if (
            Array.isArray(result.intermediateSteps) &&
            result.intermediateSteps.length
          ) {
            out = result.intermediateSteps[0][1];
          }
          try {
            responseData = JSON.parse(out);
          } catch {
            responseData = out;
          }
        }

        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok", data: responseData }, null, 2));
      } catch (err) {
        log("ERROR:", err.message);
        res.writeHead(400);
        res.end(JSON.stringify({ status: "error", error: err.message }));
      }
    });

    req.on("error", (err) => {
      log("REQUEST ERROR:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", error: "Request error" }));
    });
  });

  process.on("unhandledRejection", (err) => log("UNHANDLED:", err));
  server.listen(9001, () => log("Server listening on http://localhost:9001"));
})();
