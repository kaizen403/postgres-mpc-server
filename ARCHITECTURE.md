# Architecture

## Overview

`mcp-ctf` is a natural-language-to-SQL HTTP service for a food delivery database. Users send plain English prompts (or raw SQL) and the server translates them into PostgreSQL queries via an LLM agent, executes them, and returns the results.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (CommonJS) |
| HTTP | `http` (stdlib, no framework) |
| Database | PostgreSQL |
| ORM | Prisma |
| LLM | Groq (Llama 3.3 70B / Llama 3 70B) |
| Agent framework | LangChain (`chat-zero-shot-react-description`) |
| Validation | Zod |
| Config | dotenv |

## Request Flow

```
POST /query { "prompt": "..." }
         |
         v
  ┌──────────────┐
  │  Raw SQL?     │──yes──> Execute directly via Prisma
  │  (regex check)│         ($queryRawUnsafe / $executeRawUnsafe)
  └──────┬───────┘
         │ no
         v
  ┌──────────────┐
  │  LangChain   │  Agent picks one of the CRUD tools
  │  Agent       │  based on the user's intent
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Groq LLM    │  System prompt includes the full Prisma schema.
  │  (NL → SQL)  │  LLM generates raw PostgreSQL for the operation.
  └──────┬───────┘
         │
         v
  ┌──────────────┐
  │  Prisma      │  SELECT → $queryRawUnsafe (returns rows)
  │  (execute)   │  INSERT/UPDATE/DELETE → $executeRawUnsafe (returns count)
  └──────────────┘
```

## Entry Points

The project has two server implementations:

| File | Port | Notes |
|------|------|-------|
| `index.js` | 9001 | Monolithic - everything in one file, includes a `rawSql` tool |
| `src/server.js` | 9000 | Modular - delegates to `src/executor.js` and `src/tools/` |

`npm start` runs `index.js`.

## Project Structure

```
.
├── index.js                  # Monolithic entry point (port 9001)
├── src/
│   ├── server.js             # Modular entry point (port 9000)
│   ├── executor.js           # Creates LangChain agent + Prisma client
│   ├── tools/
│   │   └── index.js          # CRUD tool definitions (select/create/update/delete)
│   └── schema.prisma         # Copy of schema (read by executor)
├── schema.prisma             # Prisma schema (root copy, used by index.js)
├── prisma/
│   ├── schema.prisma         # Prisma schema (canonical)
│   └── seed.js               # Seed script - generates sample data
├── migrations/               # Prisma migration history
│   ├── 20250503122129_1/     # Initial AdminUser table (since dropped)
│   └── 20250503170924_/      # Current schema - food delivery models
└── package.json
```

## Data Model

```
User ──< Order >── Restaurant
            │
         OrderItem >── MenuItem >── Restaurant

OrderStatus: PENDING | CONFIRMED | DELIVERED | CANCELLED
```

### Tables

- **User** - customers (id, name, email, createdAt)
- **Restaurant** - food establishments (id, name, address)
- **MenuItem** - restaurant menu entries (id, restaurantId, name, price, available)
- **Order** - placed orders (id, userId, restaurantId, total, status, placedAt)
- **OrderItem** - line items within an order (id, orderId, menuItemId, quantity, unitPrice)

## LangChain Tools

The agent has access to four CRUD tools (five in `index.js` which adds `rawSql`):

| Tool | Operation | Description |
|------|-----------|-------------|
| `select` | SELECT | Read data via natural language |
| `create` | INSERT | Create records via natural language |
| `update` | UPDATE | Modify records via natural language |
| `delete` | DELETE | Remove records via natural language |
| `rawSql` | Any | Execute raw SQL directly (index.js only) |

Each tool sends the user's natural language prompt to Groq with a system prompt containing the full Prisma schema and an instruction to generate the appropriate SQL type. The LLM response is cleaned (strip markdown fences, trailing semicolons) and executed against PostgreSQL.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GROQ_API_KEY` | Yes | Groq API key for LLM access |

## Seeding

```bash
node prisma/seed.js
```

Generates 20 users, 5 restaurants, ~40-60 menu items, and 50 orders with random order items.
