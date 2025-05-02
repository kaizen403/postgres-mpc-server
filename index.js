require("dotenv").config();
const fs = require("fs");
const http = require("http");
const { PrismaClient } = require("@prisma/client");
const { ChatGroq } = require("@langchain/groq");
const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

// Helper to strip triple‑backticks and trailing semicolon
const cleanSQL = (raw) => {
  const block = raw.match(/```(?:sql)?\s*([\s\S]*?)```/i);
  const sql = (block ? block[1] : raw).trim();
  return sql.endsWith(";") ? sql.slice(0, -1) : sql;
};

// Load your Prisma schema so the LLM knows your tables/columns
const prismaSchema = fs.readFileSync("./schema.prisma", "utf-8");

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

  // System preamble including your actual Prisma schema
  const schemaPrompt =
    "You have this Prisma schema:\n\n" +
    prismaSchema +
    "\n\nTranslate the user’s request into a valid PostgreSQL query using those tables and columns. Return only the raw SQL.";

  const fetchTool = tool(
    async (toolInput) => {
      const resp = await groqModel.invoke([
        {
          role: "system",
          content: schemaPrompt + "\n\nSpecifically, generate a SELECT.",
        },
        { role: "user", content: toolInput },
      ]);
      const sql = cleanSQL(resp.content);
      const rows = await prisma.$queryRawUnsafe(sql);
      return JSON.stringify({ sql, rows });
    },
    {
      name: "fetch",
      description: "Run a SELECT based on a natural‑language prompt",
      schema: z.string(),
    },
  );

  const deleteTool = tool(
    async (toolInput) => {
      const resp = await groqModel.invoke([
        {
          role: "system",
          content: schemaPrompt + "\n\nSpecifically, generate a DELETE.",
        },
        { role: "user", content: toolInput },
      ]);
      const sql = cleanSQL(resp.content);
      const count = await prisma.$executeRawUnsafe(sql);
      return JSON.stringify({ sql, count });
    },
    {
      name: "delete",
      description: "Run a DELETE based on a natural‑language prompt",
      schema: z.string(),
    },
  );

  const editTool = tool(
    async (toolInput) => {
      const resp = await groqModel.invoke([
        {
          role: "system",
          content:
            schemaPrompt + "\n\nSpecifically, generate an UPDATE or INSERT.",
        },
        { role: "user", content: toolInput },
      ]);
      const sql = cleanSQL(resp.content);
      const count = await prisma.$executeRawUnsafe(sql);
      return JSON.stringify({ sql, count });
    },
    {
      name: "edit",
      description: "Run an UPDATE or INSERT based on a natural‑language prompt",
      schema: z.string(),
    },
  );

  const executor = await initializeAgentExecutorWithOptions(
    [fetchTool, deleteTool, editTool],
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

        const result = await executor.invoke({ input: prompt });
        let data;
        if (
          Array.isArray(result.intermediateSteps) &&
          result.intermediateSteps.length
        ) {
          data = result.intermediateSteps[0][1];
          try {
            data = JSON.parse(data);
          } catch {}
        } else {
          data = result.output;
        }

        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok", data }, null, 2));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ status: "error", error: err.message }));
      }
    });
    req.on("error", () => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", error: "Request error" }));
    });
  });

  server.listen(9000);
})();
