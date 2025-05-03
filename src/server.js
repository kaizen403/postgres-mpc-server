// src/server.js

require("dotenv").config();
const http = require("http");
const { createExecutor } = require("./executor");

const log = (...args) => console.log(new Date().toISOString(), "-", ...args);

(async () => {
  if (!process.env.DATABASE_URL || !process.env.GROQ_API_KEY) {
    console.error("Error: set DATABASE_URL and GROQ_API_KEY in .env");
    process.exit(1);
  }

  const executor = await createExecutor();

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
  server.listen(9000, () => log("Server listening on http://localhost:9000"));
})();
