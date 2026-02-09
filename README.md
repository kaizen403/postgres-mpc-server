# MCP CTF

A natural-language database interface for a food ordering system. Send plain English (or raw SQL) to a single HTTP endpoint and let an LLM agent figure out the query.

Built with Node.js, Prisma, LangChain, and Groq (Llama 3.3 70B).

## How it works

1. You POST a natural-language prompt to `/query`.
2. An LLM agent reads the Prisma schema and translates your prompt into PostgreSQL.
3. The query runs against the database and results come back as JSON.

If the prompt is already valid SQL, it bypasses the agent and runs directly.

## Prerequisites

- Node.js 18+
- PostgreSQL database
- [Groq API key](https://console.groq.com/)

## Setup

```bash
npm install
```

Create a `.env` file:

```
DATABASE_URL=postgresql://user:password@localhost:5432/your_db
GROQ_API_KEY=your_groq_api_key
```

Run Prisma migrations to set up the database:

```bash
npx prisma migrate dev
```

## Running

```bash
npm start
```

The server starts on `http://localhost:9001`.

## API

### `POST /query`

Send a JSON body with a `prompt` field.

**Natural language:**

```bash
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "show me all restaurants"}'
```

**Raw SQL:**

```bash
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "SELECT * FROM \"Restaurant\""}'
```

**Response:**

```json
{
  "status": "ok",
  "data": {
    "sql": "SELECT * FROM \"Restaurant\"",
    "rows": [...]
  }
}
```

## Database schema

| Model | Description |
|-------|-------------|
| User | Customers who place orders |
| Restaurant | Restaurants with menus |
| MenuItem | Individual items on a restaurant's menu |
| Order | An order placed by a user at a restaurant |
| OrderItem | Line items within an order |

Orders track status as `PENDING`, `CONFIRMED`, `DELIVERED`, or `CANCELLED`.

## Project structure

```
index.js          # HTTP server + LangChain agent setup
prisma/
  schema.prisma   # Database schema
package.json
.env              # Environment variables (not committed)
```

## License

ISC
