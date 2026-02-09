# mcp-ctf

A natural language SQL query server for a food ordering database. Send a plain English prompt, get back query results — powered by LangChain + Groq (Llama 3.3 70B) and PostgreSQL via Prisma.

## How it works

The server exposes a single endpoint (`POST /query`) that accepts either:

- **Natural language** — an LLM agent translates your prompt into the appropriate SQL (SELECT, INSERT, UPDATE, or DELETE) based on the Prisma schema
- **Raw SQL** — if your prompt starts with `SELECT`, `INSERT`, `UPDATE`, or `DELETE`, it skips the agent and runs the query directly

## Setup

**Prerequisites:** Node.js, a PostgreSQL database, and a [Groq API key](https://console.groq.com/).

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file:

   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/mydb
   GROQ_API_KEY=gsk_...
   ```

3. Push the schema to your database:

   ```bash
   npx prisma db push
   ```

4. Start the server:

   ```bash
   npm start
   ```

   Runs on `http://localhost:9001`.

## API

### `POST /query`

**Request body:**

```json
{ "prompt": "your question or SQL here" }
```

**Examples:**

```bash
# Natural language query
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "show me all restaurants"}'

# Natural language insert
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "add a user named Alice with email alice@example.com"}'

# Raw SQL (bypasses the agent)
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "SELECT * FROM \"User\" LIMIT 5"}'
```

**Response:**

```json
{
  "status": "ok",
  "data": {
    "sql": "SELECT * FROM \"User\" LIMIT 5",
    "rows": [...]
  }
}
```

On error:

```json
{
  "status": "error",
  "error": "error message"
}
```

## Database schema

| Table       | Key columns                                          |
|-------------|------------------------------------------------------|
| User        | id, name, email, createdAt                           |
| Restaurant  | id, name, address                                    |
| MenuItem    | id, restaurantId, name, price, available             |
| Order       | id, userId, restaurantId, total, status, placedAt    |
| OrderItem   | id, orderId, menuItemId, quantity, unitPrice          |

Order status values: `PENDING`, `CONFIRMED`, `DELIVERED`, `CANCELLED`.

Full schema in `prisma/schema.prisma`.

## Stack

- **Runtime:** Node.js (CommonJS)
- **LLM:** Groq (Llama 3.3 70B) via LangChain
- **Database:** PostgreSQL via Prisma
- **Agent:** LangChain `chat-zero-shot-react-description`
