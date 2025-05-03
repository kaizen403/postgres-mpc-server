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

const prismaSchema = fs.readFileSync("./schema.prisma", "utf-8");

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
    "using ONLY those tables/columns. Return only the raw SQL.";

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

  const makeTool = (name) =>
    tool(
      async (input) => {
        const out = await runOp(name, input);
        return JSON.stringify(out);
      },
      {
        name,
        description: `${name.toUpperCase()} rows based on a natural‑language prompt`,
        schema: z.string(),
      },
    );

  const selectTool = makeTool("select");
  const createTool = makeTool("create");
  const updateTool = makeTool("update");
  const deleteTool = makeTool("delete");

  const executor = await initializeAgentExecutorWithOptions(
    [selectTool, createTool, updateTool, deleteTool],
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

        const result = await executor.invoke({ input: prompt });

        let data = result.output;
        if (
          Array.isArray(result.intermediateSteps) &&
          result.intermediateSteps.length
        ) {
          data = result.intermediateSteps[0][1];
          try {
            data = JSON.parse(data);
          } catch {}
        }

        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok", data }, null, 2));
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
  server.listen(9000, () => log("Server listening on :9000"));
})();
