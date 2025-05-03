// src/tools/index.js

const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

// define each CRUD op
const opDefs = [
  { name: "select", instr: "generate a SELECT." },
  { name: "create", instr: "generate an INSERT." },
  { name: "update", instr: "generate an UPDATE." },
  { name: "delete", instr: "generate a DELETE." },
];

function getTools(runOp) {
  return opDefs.map(({ name, instr }) =>
    tool(
      async (input) => {
        const result = await runOp(name, instr, input);
        return JSON.stringify(result);
      },
      {
        name,
        description: `${name.toUpperCase()} via natural-language prompt`,
        schema: z.string(),
      },
    ),
  );
}

module.exports = { getTools };
