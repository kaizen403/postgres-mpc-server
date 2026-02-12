# mcp-ctf

Natural language SQL API for a food-delivery database. Send a plain-English prompt, get back query results — the server uses LangChain + Groq (Llama 3) to translate your request into PostgreSQL and execute it against a Prisma-managed schema.

## Prerequisites

- Node.js >= 18
- A PostgreSQL database
- A [Groq](https://console.groq.com/) API key

## Setup

### 1. Install dependencies

```sh
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your values:

```sh
cp .env.example .env
```

| Variable       | Description                                      |
| -------------- | ------------------------------------------------ |
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/mydb`) |
| `GROQ_API_KEY` | API key from Groq                                |

### 3. Run migrations

```sh
npx prisma migrate deploy
```

### 4. Generate the Prisma client

```sh
npx prisma generate
```

### 5. Seed the database

Populates the database with sample users, restaurants, menu items, and orders:

```sh
node prisma/seed.js
```

## Running the server

```sh
npm start
```

The server listens on **http://localhost:9001**.

## Usage

Send a POST request to `/query` with a JSON body containing a `prompt` field:

```sh
curl -s http://localhost:9001/query \
  -H "Content-Type: application/json" \
  -d '{"prompt": "show me all orders with status DELIVERED"}' | jq
```

The agent picks the right operation (SELECT, INSERT, UPDATE, DELETE) based on your prompt. You can also pass raw SQL directly — if the prompt starts with a SQL keyword it skips the LLM and executes it as-is.

### Example response

```json
{
  "status": "ok",
  "data": {
    "sql": "SELECT * FROM \"Order\" WHERE \"status\" = 'DELIVERED'",
    "rows": [ ... ]
  }
}
```

## Database schema

The Prisma schema (`prisma/schema.prisma`) defines five models:

- **User** — `id`, `name`, `email`, `createdAt`
- **Restaurant** — `id`, `name`, `address`
- **MenuItem** — `id`, `restaurantId`, `name`, `price`, `available`
- **Order** — `id`, `userId`, `restaurantId`, `total`, `status`, `placedAt`
- **OrderItem** — `id`, `orderId`, `menuItemId`, `quantity`, `unitPrice`

Order status is one of: `PENDING`, `CONFIRMED`, `DELIVERED`, `CANCELLED`.

## Project structure

```
├── index.js              # Standalone server (port 9001)
├── src/
│   ├── server.js         # Modular server entry (port 9000)
│   ├── executor.js       # LangChain agent + Groq setup
│   └── tools/index.js    # CRUD tool definitions
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.js           # Seed script
└── migrations/           # Prisma migration history
```
