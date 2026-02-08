# mcp-ctf

AI-powered natural language interface for a food delivery database. Send plain English queries, get SQL results back. Built with LangChain, Groq (Llama 3.3 70B), Prisma, and PostgreSQL.

## System Design

### Architecture Overview

```
                         +------------------+
                         |     Client       |
                         | (any HTTP client)|
                         +--------+---------+
                                  |
                          POST /query
                         { "prompt": "..." }
                                  |
                                  v
                    +-------------+-------------+
                    |        HTTP Server         |
                    |     (Node.js, port 9001)   |
                    +-------------+-------------+
                                  |
                      +-----------+-----------+
                      |                       |
               raw SQL detected?        natural language
                      |                       |
                      v                       v
              +-------+-------+    +----------+----------+
              |  Direct SQL   |    |   LangChain Agent   |
              |  Execution    |    | (zero-shot ReAct)    |
              +-------+-------+    +----------+----------+
                      |                       |
                      |              selects a tool:
                      |         select / create / update / delete
                      |                       |
                      |                       v
                      |           +-----------+-----------+
                      |           |    Groq LLM (Llama)   |
                      |           |  NL + schema -> SQL   |
                      |           +-----------+-----------+
                      |                       |
                      |              generated SQL
                      |                       |
                      v                       v
                    +-----------+-------------+
                    |     Prisma ORM          |
                    | ($queryRawUnsafe /       |
                    |  $executeRawUnsafe)      |
                    +-----------+-------------+
                                |
                                v
                    +-----------+-------------+
                    |      PostgreSQL          |
                    +-------------------------+
```

### Request Flow

1. Client sends `POST /query` with a JSON body: `{ "prompt": "show me all pending orders" }`
2. Server checks if the prompt looks like raw SQL (starts with `SELECT`, `INSERT`, etc.)
   - **Yes** -- executes it directly against PostgreSQL via Prisma
   - **No** -- passes it to the LangChain agent
3. The agent (zero-shot ReAct) picks the right CRUD tool based on intent
4. The selected tool sends the natural language prompt + the full Prisma schema to Groq's Llama 3.3 70B model
5. The LLM returns raw SQL; the tool strips markdown fencing and trailing semicolons
6. SQL runs through Prisma's raw query methods
7. Results come back as JSON: `{ "status": "ok", "data": { "sql": "...", "rows": [...] } }`

### Data Model

```
+-----------+        +---------------+        +------------+
|   User    |        |  Restaurant   |        |  MenuItem  |
+-----------+        +---------------+        +------------+
| id (PK)   |        | id (PK)       |        | id (PK)    |
| name      |        | name          |<-------| restaurantId (FK)
| email (U) |        | address       |        | name       |
| createdAt |        +-------+-------+        | price      |
+-----+-----+                |                | available  |
      |                      |                +-----+------+
      |                      |                      |
      |    +-----------+     |                      |
      +--->|   Order   |<----+                      |
           +-----------+                            |
           | id (PK)   |     +-------------+        |
           | userId (FK)|    | OrderItem   |        |
           | restaurantId    +-------------+        |
           | total      |--->| id (PK)     |        |
           | status     |    | orderId (FK)|        |
           | placedAt   |    | menuItemId (FK)------+
           +------------+    | quantity    |
                             | unitPrice   |
                             +-------------+

OrderStatus: PENDING | CONFIRMED | DELIVERED | CANCELLED
```

**Entities:**

| Table | Purpose |
|-------|---------|
| `User` | Customers placing orders |
| `Restaurant` | Restaurants with menus |
| `MenuItem` | Individual dishes belonging to a restaurant |
| `Order` | A customer's order at a restaurant with a status and total |
| `OrderItem` | Line items in an order, linking to menu items with quantity and price |

### LangChain Agent & Tools

The agent uses a **zero-shot ReAct** strategy -- it reads the user's prompt, reasons about what operation is needed, and calls one of four tools:

| Tool | SQL Operation | Description |
|------|---------------|-------------|
| `select` | `SELECT` | Read data via natural language |
| `create` | `INSERT` | Insert records via natural language |
| `update` | `UPDATE` | Modify records via natural language |
| `delete` | `DELETE` | Remove records via natural language |

Each tool injects the full Prisma schema into the LLM system prompt so it only generates SQL against real tables and columns.

The monolithic entry point (`index.js`) also exposes a `rawSql` tool for direct SQL passthrough.

### Project Structure

```
.
|-- index.js                  # Monolithic entry point (port 9001)
|-- src/
|   |-- server.js             # Modular HTTP server (port 9000)
|   |-- executor.js           # LangChain agent + Groq LLM setup
|   |-- tools/
|   |   |-- index.js          # CRUD tool definitions
|   |-- schema.prisma         # Copy of schema (for executor)
|-- prisma/
|   |-- schema.prisma         # Prisma schema (source of truth)
|   |-- seed.js               # Seed script: 20 users, 5 restaurants, ~50 orders
|-- migrations/               # Prisma migration history
|-- package.json
|-- .env                      # DATABASE_URL, GROQ_API_KEY (not committed)
```

## Getting Started

### Prerequisites

- Node.js
- PostgreSQL database
- [Groq API key](https://console.groq.com/)

### Setup

```bash
# install dependencies
npm install

# configure environment
cp .env.example .env
# edit .env with your DATABASE_URL and GROQ_API_KEY

# run migrations
npx prisma migrate deploy

# seed the database
node prisma/seed.js

# start the server
npm start
```

### Usage

```bash
# natural language query
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "show me all pending orders with user names"}'

# raw SQL
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "SELECT * FROM \"User\" LIMIT 5"}'
```

### Response Format

```json
{
  "status": "ok",
  "data": {
    "sql": "SELECT ... FROM ...",
    "rows": [...]
  }
}
```

Error responses return `{ "status": "error", "error": "message" }` with a 400 or 500 status code.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js |
| LLM | Groq -- Llama 3.3 70B Versatile |
| Agent framework | LangChain (zero-shot ReAct) |
| ORM | Prisma |
| Database | PostgreSQL |
| Validation | Zod |
