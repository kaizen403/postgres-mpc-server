# mcp-ctf

Natural-language SQL API for a food delivery database. Send plain English (or raw SQL) to a single HTTP endpoint and get back query results — powered by LangChain, Groq (Llama 3), and Prisma.

## How it works

1. You POST a natural-language prompt (e.g. *"show me all pending orders"*) to `/query`.
2. An LLM agent translates the prompt into a PostgreSQL query using the Prisma schema as context.
3. The query runs against your database and results come back as JSON.

Raw SQL is also accepted — if the prompt starts with `SELECT`, `INSERT`, `UPDATE`, or `DELETE`, it bypasses the agent and executes directly.

## Schema

The database models a food delivery system:

| Model | Description |
|-------|-------------|
| **User** | Customers with name and email |
| **Restaurant** | Restaurants with name and address |
| **MenuItem** | Menu items belonging to a restaurant (name, price, availability) |
| **Order** | Orders linking a user to a restaurant, with status tracking (`PENDING`, `CONFIRMED`, `DELIVERED`, `CANCELLED`) |
| **OrderItem** | Line items within an order (menu item, quantity, unit price) |

## Prerequisites

- Node.js (v18+)
- PostgreSQL database
- [Groq API key](https://console.groq.com/)

## Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd mcp-ctf
   npm install
   ```

2. **Configure environment**

   Create a `.env` file in the project root:

   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/your_db"
   GROQ_API_KEY="gsk_..."
   ```

3. **Set up the database**

   ```bash
   npx prisma migrate dev
   ```

4. **Seed sample data** (optional)

   Populates the database with 20 users, 5 restaurants, menu items, and 50 orders:

   ```bash
   node prisma/seed.js
   ```

## Usage

**Start the server:**

```bash
npm start
```

The server listens on `http://localhost:9001`.

**Make a query:**

```bash
# Natural language
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "show me all pending orders with the user name"}'

# Raw SQL
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "SELECT * FROM \"User\" LIMIT 5"}'
```

**Response format:**

```json
{
  "status": "ok",
  "data": {
    "sql": "SELECT ...",
    "rows": [...]
  }
}
```

## API

### `POST /query`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | yes | Natural-language question or raw SQL |

**Responses:**

- `200` — query executed successfully
- `400` — missing prompt or query error
- `404` — any route other than `POST /query`

## Project structure

```
├── index.js              # Main entry point (standalone server on :9001)
├── schema.prisma         # Prisma schema (read by LLM for context)
├── prisma/
│   ├── schema.prisma     # Prisma schema (used by CLI)
│   └── seed.js           # Database seed script
├── src/
│   ├── server.js         # Modular server variant (:9000)
│   ├── executor.js       # LangChain agent + Groq setup
│   └── tools/
│       └── index.js      # CRUD tool definitions for the agent
├── package.json
└── .env                  # Environment variables (not committed)
```

## Tech stack

- **[LangChain](https://js.langchain.com/)** — agent framework for tool-based LLM orchestration
- **[Groq](https://groq.com/)** — fast LLM inference (Llama 3.3 70B)
- **[Prisma](https://www.prisma.io/)** — database ORM and schema management
- **[Zod](https://zod.dev/)** — schema validation for agent tools
- **PostgreSQL** — database

## License

ISC
