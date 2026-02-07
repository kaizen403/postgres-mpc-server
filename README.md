# Postgres MCP Server

A natural language to PostgreSQL query server that translates human-readable prompts into SQL using LangChain and Groq's Llama-3 model.

## Quick Start

```bash
npm install
npm start
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HTTP Server (9001)                          │
│                         POST /query                                 │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ { prompt: "..." }
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Request Router                                  │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Raw SQL?  ──yes──▶  Direct Execution                      │    │
│  │      │                                                      │    │
│  │      no                                                     │    │
│  │      ▼                                                      │    │
│  │  LangChain Agent Executor                                   │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Tool Selection                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  SELECT  │  │  INSERT  │  │  UPDATE  │  │  DELETE  │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       └─────────────┴─────────────┴─────────────┘                  │
│                          │                                          │
└──────────────────────────┼──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Groq LLM (Llama-3.3-70B)                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  System: Prisma schema context + operation instructions      │   │
│  │  User: Natural language query                                │   │
│  │  Output: Raw PostgreSQL SQL                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ Generated SQL
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Prisma Client                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  $queryRawUnsafe() for SELECT                               │   │
│  │  $executeRawUnsafe() for INSERT/UPDATE/DELETE               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                            │
│  ┌─────────┐  ┌────────────┐  ┌──────────┐  ┌─────────────────┐   │
│  │  User   │  │ Restaurant │  │ MenuItem │  │ Order/OrderItem │   │
│  └─────────┘  └────────────┘  └──────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Components

### Entry Point (`index.js`)

The main server that:
- Starts an HTTP server on port 9001
- Accepts POST requests to `/query` with a JSON body containing a `prompt` field
- Routes raw SQL directly to execution, bypasses the agent for natural language prompts
- Returns JSON responses with query results or row counts

### Agent Executor (`src/executor.js`)

Creates a LangChain agent with:
- **Groq LLM**: Uses `llama3-70b-8192` model with temperature 0 for consistent SQL generation
- **Schema Context**: Injects the Prisma schema into the system prompt so the LLM knows available tables/columns
- **CRUD Tools**: Four specialized tools for SELECT, INSERT, UPDATE, DELETE operations

### Tools (`src/tools/index.js`)

LangChain tools that:
- Accept natural language input
- Invoke the LLM to generate SQL for the specific operation type
- Execute the SQL via Prisma and return results

## Data Model

A food ordering system with:

```
User ─────┐
          │
          ▼
       Order ───────▶ Restaurant
          │               │
          ▼               ▼
     OrderItem ◀──── MenuItem
```

| Model | Description |
|-------|-------------|
| `User` | Customers who place orders |
| `Restaurant` | Food establishments with menus |
| `MenuItem` | Individual dishes with prices |
| `Order` | A customer's order at a restaurant |
| `OrderItem` | Line items linking orders to menu items |

## Tech Stack

- **Runtime**: Node.js (CommonJS)
- **Database**: PostgreSQL via Prisma ORM
- **LLM**: Groq API with Llama-3.3-70B-Versatile
- **Agent Framework**: LangChain (chat-zero-shot-react-description)
- **Validation**: Zod schemas

## Environment Variables

Create a `.env` file:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
GROQ_API_KEY="your-groq-api-key"
```

## API Usage

```bash
# Natural language query
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "show me all users"}'

# Direct SQL (bypasses agent)
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "SELECT * FROM \"User\""}'
```

## Request Flow

1. Client sends POST to `/query` with natural language prompt
2. Server detects if input is raw SQL or natural language
3. For natural language: LangChain agent selects appropriate tool (select/create/update/delete)
4. Tool invokes Groq LLM with schema context to generate SQL
5. Generated SQL executed against PostgreSQL via Prisma
6. Results returned as JSON

## Development

```bash
# Seed the database
npx prisma db seed

# Run migrations
npx prisma migrate dev

# Start server
npm start
```
