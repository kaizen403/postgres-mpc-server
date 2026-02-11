# mcp-ctf

Natural-language SQL query server for a food delivery database. Send a plain English prompt, get back query results — the LLM translates it into PostgreSQL under the hood.

Built with LangChain, Groq (Llama 3), and Prisma.

## How it works

The server exposes a single endpoint (`POST /query`) that accepts a JSON body with a `prompt` field. An LLM agent reads the Prisma schema, picks the right operation (select, insert, update, delete), generates SQL, and runs it against the database.

If the prompt is raw SQL, it gets executed directly without going through the agent.

## Prerequisites

- Node.js (v18+)
- PostgreSQL database
- [Groq API key](https://console.groq.com/)

## Setup

### 1. Install dependencies

```sh
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```sh
DATABASE_URL="postgresql://user:password@localhost:5432/your_database"
GROQ_API_KEY="gsk_your_groq_api_key"
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Prisma uses this for all DB access. |
| `GROQ_API_KEY` | API key from [Groq](https://console.groq.com/). Powers the LLM that translates prompts to SQL. |

Both are required — the server will exit immediately if either is missing.

### 3. Run database migrations

```sh
npx prisma migrate deploy
```

This creates the tables: `User`, `Restaurant`, `MenuItem`, `Order`, and `OrderItem`.

### 4. Generate the Prisma client

```sh
npx prisma generate
```

### 5. Seed the database

```sh
node prisma/seed.js
```

Populates the database with sample data: 20 users, 5 restaurants with menus, and 50 orders. Running it again will clear existing data first.

## Usage

### Start the server

```sh
npm start
```

The server listens on `http://localhost:9001`.

### Query with natural language

```sh
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "show me all users who placed orders in the last 7 days"}'
```

### Query with raw SQL

```sh
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "SELECT * FROM \"User\" LIMIT 5"}'
```

Prompts that start with `SELECT`, `INSERT`, `UPDATE`, or `DELETE` bypass the agent and run directly.

## Database schema

```
User          1──n  Order
Restaurant    1──n  Order
Restaurant    1──n  MenuItem
Order         1──n  OrderItem
MenuItem      1──n  OrderItem
```

Orders track status as `PENDING`, `CONFIRMED`, `DELIVERED`, or `CANCELLED`.

## Project structure

```
├── index.js              # Main entrypoint (server + agent setup)
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.js           # Seed script
├── src/
│   ├── server.js         # Alternate server entrypoint
│   ├── executor.js       # LangChain agent executor
│   └── tools/index.js    # CRUD tool definitions
└── migrations/           # Prisma migration files
```
