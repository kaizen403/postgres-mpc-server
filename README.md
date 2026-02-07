# Postgres MCP Server

A natural-language PostgreSQL query server powered by LangChain and Groq LLM. Send plain English requests and get SQL executed against your database.

## Features

- **Natural Language to SQL**: Describe what you want in plain English, get SQL results back
- **CRUD Operations**: Supports SELECT, INSERT, UPDATE, DELETE via natural language
- **Raw SQL Mode**: Pass raw SQL directly for full control
- **LangChain Agent**: Uses `llama-3.3-70b-versatile` via Groq for intelligent query generation
- **Prisma ORM**: Type-safe database access with automatic schema awareness

## Database Schema

Food delivery system with:
- **Users** - Customer accounts
- **Restaurants** - Restaurant listings with addresses
- **MenuItems** - Restaurant menu items with prices
- **Orders** - Customer orders with status tracking
- **OrderItems** - Individual items within orders

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
GROQ_API_KEY="your-groq-api-key"
```

### 3. Setup database

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Seed sample data (optional)

```bash
node prisma/seed.js
```

### 5. Start the server

```bash
npm start
```

Server runs on `http://localhost:9001`

## API Usage

### Endpoint

```
POST /query
Content-Type: application/json
```

### Natural Language Query

```bash
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Show me all orders from the last week"}'
```

### Raw SQL

```bash
curl -X POST http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "SELECT * FROM \"User\" LIMIT 5"}'
```

### Example Prompts

| Prompt | Operation |
|--------|-----------|
| "List all users" | SELECT |
| "Show orders with status PENDING" | SELECT |
| "Add a new user named John with email john@test.com" | INSERT |
| "Update order 5 status to DELIVERED" | UPDATE |
| "Delete all cancelled orders" | DELETE |

## Response Format

```json
{
  "status": "ok",
  "data": {
    "sql": "SELECT * FROM \"User\"",
    "rows": [...]
  }
}
```

## Project Structure

```
.
├── index.js              # Main server (standalone)
├── src/
│   ├── server.js         # HTTP server (modular)
│   ├── executor.js       # LangChain agent setup
│   └── tools/index.js    # CRUD tool definitions
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.js           # Sample data generator
└── migrations/           # Prisma migrations
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GROQ_API_KEY` | API key for Groq LLM service |

## Tech Stack

- **Runtime**: Node.js
- **LLM**: Groq (llama-3.3-70b-versatile)
- **AI Framework**: LangChain
- **ORM**: Prisma
- **Validation**: Zod

## License

ISC
