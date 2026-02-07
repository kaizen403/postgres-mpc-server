# mcp-ctf

Natural-language SQL agent for a food-delivery database. Send a plain-English prompt, get back query results.

## Quick start

```bash
cp .env.example .env   # fill in DATABASE_URL and GROQ_API_KEY
npm install
npx prisma migrate deploy
node prisma/seed.js     # optional — populates sample data
npm start               # starts on :9001
```

### Usage

```bash
curl -X POST http://localhost:9001/query \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "show me all pending orders"}'
```

Raw SQL also works — if the prompt starts with `SELECT`, `INSERT`, `UPDATE`, or `DELETE` it bypasses the LLM and runs directly.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    HTTP server                       │
│               POST /query { prompt }                 │
│                   (index.js :9001)                   │
└────────────┬──────────────────────────┬──────────────┘
             │ raw SQL?                 │ natural language
             │                          ▼
             │              ┌──────────────────────┐
             │              │  LangChain Agent      │
             │              │  (chat-zero-shot-     │
             │              │   react-description)  │
             │              └──────┬───────────────┘
             │                     │ picks a tool
             ▼                     ▼
     ┌──────────────────────────────────────┐
     │          runOp / runRaw              │
     │  • sends schema + instruction to LLM │
     │  • cleans SQL from response          │
     │  • executes via Prisma               │
     └──────────────────┬───────────────────┘
                        │
                        ▼
              ┌───────────────────┐
              │   PostgreSQL      │
              │   (via Prisma)    │
              └───────────────────┘
```

### Components

| File | Role |
|---|---|
| `index.js` | Entrypoint — HTTP server, LLM setup, tools, request handling (monolith) |
| `src/server.js` | Alternate modular entrypoint (`:9000`), delegates to executor |
| `src/executor.js` | Creates LangChain agent executor with Groq model and CRUD tools |
| `src/tools/index.js` | Defines the four CRUD tools (select, create, update, delete) |
| `prisma/schema.prisma` | Prisma schema — the source of truth for the database |
| `schema.prisma` | Copy of the schema read at runtime for the LLM system prompt |
| `prisma/seed.js` | Seed script — generates sample users, restaurants, menus, orders |
| `migrations/` | Prisma migration history |

### Request flow

1. Client POSTs `{ "prompt": "..." }` to `/query`.
2. If the prompt looks like raw SQL (`SELECT …`, `INSERT …`, etc.) it goes straight to `runRaw` → Prisma `$queryRawUnsafe` / `$executeRawUnsafe`.
3. Otherwise the LangChain agent receives the prompt. It has five tools:
   - **select** — generates a `SELECT` via LLM
   - **create** — generates an `INSERT` via LLM
   - **update** — generates an `UPDATE` via LLM
   - **delete** — generates a `DELETE` via LLM
   - **rawSql** — executes caller-supplied SQL directly
4. The chosen tool calls `runOp`, which asks Groq (`llama-3.3-70b-versatile`) to translate the natural-language prompt into SQL using the Prisma schema as context.
5. SQL is cleaned (strip markdown fences, trailing semicolons) and executed against PostgreSQL through Prisma.
6. Result (rows or affected count) is returned as JSON.

### Data model

```
User 1──* Order *──1 Restaurant
              │
              └──* OrderItem *──1 MenuItem *──1 Restaurant

OrderStatus: PENDING | CONFIRMED | DELIVERED | CANCELLED
```

Five tables: `User`, `Restaurant`, `MenuItem`, `Order`, `OrderItem`.

### Key dependencies

| Package | Purpose |
|---|---|
| `@langchain/groq` | Groq LLM adapter (Llama 3.3 70B) |
| `langchain` | Agent framework — zero-shot ReAct agent |
| `@langchain/core` | Tool definitions with Zod schemas |
| `@prisma/client` | PostgreSQL ORM and raw query execution |
| `zod` | Input validation for tool schemas |
| `dotenv` | Environment variable loading |

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `GROQ_API_KEY` | yes | API key for Groq cloud |
