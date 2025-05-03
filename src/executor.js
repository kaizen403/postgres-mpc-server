// src/executor.js

const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { ChatGroq } = require("@langchain/groq");
const { initializeAgentExecutorWithOptions } = require("langchain/agents");
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");
const { getTools } = require("./tools");

const prismaSchema = fs.readFileSync("./schema.prisma", "utf-8");
const log = (...args) => console.log(new Date().toISOString(), "-", ...args);

async function createExecutor() {
  const prisma = new PrismaClient();
  const groqModel = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama3-70b-8192",
    temperature: 0,
  });

  const schemaPrompt =
    `You have this Prisma schema:\n\n${prismaSchema}\n\n` +
    "Translate the user’s request into a valid PostgreSQL query " +
    "using ONLY those tables/columns. Return strictly raw SQL.";

  const runOp = async (op, instruction, nlPrompt) => {
    const resp = await groqModel.invoke([
      {
        role: "system",
        content: `${schemaPrompt}\n\nSpecifically, ${instruction}`,
      },
      { role: "user", content: nlPrompt },
    ]);

    const raw = resp.content.match(/```(?:sql)?\s*([\s\S]*?)```/i);
    const sql = (raw ? raw[1] : resp.content).trim().replace(/;$/, "");
    log(`${op.toUpperCase()} SQL:`, sql);

    if (op === "select") {
      const rows = await prisma.$queryRawUnsafe(sql);
      return { sql, rows };
    }
    const count = await prisma.$executeRawUnsafe(sql);
    return { sql, count };
  };

  const tools = getTools(runOp);

  return initializeAgentExecutorWithOptions(tools, groqModel, {
    agentType: "chat-zero-shot-react-description",
    verbose: false,
  });
}

module.exports = { createExecutor };
