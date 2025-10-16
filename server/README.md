# DataLens AI Server

Backend server cho DataLens AI - Hệ thống chat với database sử dụng AI.

## 🌟 Features

- ✅ **Multi-Database Support**: PostgreSQL, MySQL, SQL Server
- ✅ **Schema Caching**: Cache database schemas với automatic embeddings
- ✅ **Semantic Search**: Find similar tables using AI embeddings
- ✅ **Auto-Migration**: Tự động chạy database migrations khi start
- ✅ **Local AI**: Generate embeddings locally với @xenova/transformers
- ✅ **RESTful API**: Comprehensive API endpoints
- ✅ **Connection Pooling**: Efficient database connection management
- ✅ **TypeScript**: Full type safety

**Storage Strategy:**

- 🗄️ **PostgreSQL** (Server): Database connections, schemas với table embeddings
- 💾 **IndexedDB** (Client): Conversations, messages, query results

## 📋 Prerequisites

- **Node.js** 18+
- **pnpm** package manager
- **PostgreSQL** 12+ (khuyến nghị: 15+)
- **pgvector** extension

## 🚀 Quick Start

### 1. Install PostgreSQL & pgvector

```bash
# Windows (PowerShell as Admin)
choco install postgresql

# macOS
brew install postgresql@15 pgvector

# Linux (Ubuntu/Debian)
sudo apt install postgresql postgresql-15-pgvector
```

### 2. Create Database

```bash
# Kết nối PostgreSQL
psql -U postgres

# Trong psql:
CREATE DATABASE datalens_ai;
\c datalens_ai
CREATE EXTENSION vector;
\q
```

### 3. Configure Environment

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env với credentials của bạn
```

**.env example:**

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=datalens_ai
DB_USER=postgres
DB_PASSWORD=your_password
AUTO_RUN_MIGRATIONS=true
```

### 4. Install & Run

```bash
# Install dependencies
pnpm install

# Run development server (auto-migration)
pnpm dev
```

Server sẽ chạy tại: **http://localhost:3001**

## 📚 Documentation

- **[Quick Start Guide](./QUICKSTART_POSTGRESQL.md)** - Setup từng bước
- **[Migration Guide](./POSTGRESQL_MIGRATION.md)** - Chi tiết về database schema
- **[Architecture](./ARCHITECTURE.md)** - System architecture diagrams
- **[Migration Summary](./MIGRATION_SUMMARY.md)** - Tổng hợp thay đổi
- **[Schema Embeddings API](./SCHEMA_EMBEDDINGS_API.md)** - API documentation for embeddings ⭐
- **[Examples](./SCHEMA_EMBEDDINGS_EXAMPLES.md)** - Test examples and usage

## 🛠️ Scripts

```bash
# Development với hot-reload
pnpm dev

# Chạy migrations thủ công
pnpm migrate

# Kiểm tra migration status
pnpm migrate:status

# Build production
pnpm build

# Run production
pnpm start
```

## 🌐 API Endpoints

### Database Management

| Method | Endpoint                      | Description                  |
| ------ | ----------------------------- | ---------------------------- |
| GET    | `/api/databases`              | Get all database connections |
| GET    | `/api/databases/:id`          | Get database by ID           |
| POST   | `/api/databases`              | Create database connection   |
| PUT    | `/api/databases/:id`          | Update database connection   |
| DELETE | `/api/databases/:id`          | Delete database connection   |
| POST   | `/api/databases/:id/activate` | Set active database          |

### Schema Management

| Method | Endpoint                            | Description                                     |
| ------ | ----------------------------------- | ----------------------------------------------- |
| GET    | `/api/databases/:id/schema`         | Get cached schema                               |
| POST   | `/api/databases/:id/schema`         | Save schema with auto-generated embeddings      |
| POST   | `/api/schema/search-similar-tables` | Search similar tables using semantic similarity |

### Query Execution

| Method | Endpoint                | Description                               |
| ------ | ----------------------- | ----------------------------------------- |
| POST   | `/api/test-connection`  | Test database connection                  |
| POST   | `/api/get-schema-query` | Get schema from target database           |
| POST   | `/api/execute-sql`      | Execute SQL query (requires `databaseId`) |

### Health Check

| Method | Endpoint      | Description         |
| ------ | ------------- | ------------------- |
| GET    | `/api/health` | Server health check |

## 🗄️ Database Schema

### PostgreSQL Tables (Server-side)

```
database_info      → Database connections
schema_info        → Schemas with per-table embeddings (384d via @xenova/transformers)
```

**Note:** Each table trong schema có riêng embedding được generate từ `tableDescription`.

### IndexedDB Tables (Client-side)

```
conversations      → Chat sessions
messages           → Chat messages
query_results      → SQL results + charts
user_settings      → User preferences
```

### Semantic Search

Sử dụng **@xenova/transformers** với model **Supabase/gte-small** (384 dimensions):

```typescript
// Search for similar tables across all databases
POST /api/schema/search-similar-tables
{
  "query": "customer orders and sales data",
  "limit": 5
}

// Response
{
  "success": true,
  "data": [
    {
      "databaseId": 1,
      "tableName": "orders",
      "tableDescription": "...",
      "similarity": 0.8523
    }
  ]
}
```

## 📁 Project Structure

```
server/
├── src/
│   ├── server.ts                    # Main server file
│   ├── db/
│   │   ├── client.ts                # PostgreSQL client
│   │   └── migrations.ts            # Migration runner
│   ├── repositories/
│   │   ├── databaseInfoRepository.ts
│   │   └── schemaInfoRepository.ts
│   ├── services/
│   │   ├── schemaService.ts
│   │   ├── queryExecutionService.ts
│   │   └── testDbService.ts
│   └── utils/
│       └── schemaQueries.ts
├── db/
│   ├── migrations/
│   │   └── 001_initial_schema.sql  # Initial schema
│   └── get-schema/
│       ├── postgres.sql
│       ├── mysql.sql
│       └── mssql.sql
├── scripts/
│   ├── run-migrations.ts           # Manual migration
│   └── migration-status.ts         # Check status
├── .env.example                    # Environment template
└── package.json
```

## 🔧 Configuration

### Environment Variables

| Variable              | Default     | Description         |
| --------------------- | ----------- | ------------------- |
| `PORT`                | 3001        | Server port         |
| `NODE_ENV`            | development | Environment         |
| `DB_HOST`             | localhost   | PostgreSQL host     |
| `DB_PORT`             | 5432        | PostgreSQL port     |
| `DB_NAME`             | datalens_ai | Database name       |
| `DB_USER`             | postgres    | Database user       |
| `DB_PASSWORD`         | -           | Database password   |
| `DB_SSL`              | false       | Enable SSL          |
| `DB_POOL_MAX`         | 20          | Max connections     |
| `AUTO_RUN_MIGRATIONS` | true        | Auto-run migrations |

## 🐛 Troubleshooting

### Cannot connect to PostgreSQL

```bash
# Check service status
Get-Service postgresql*  # Windows
sudo systemctl status postgresql  # Linux
```

### pgvector not installed

```sql
-- In psql
CREATE EXTENSION vector;

-- Verify
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Migration failed

```bash
# Reset database
psql -U postgres
DROP DATABASE datalens_ai;
CREATE DATABASE datalens_ai;
\c datalens_ai
CREATE EXTENSION vector;
\q

# Restart server
pnpm dev
```

### Check migration status

```bash
pnpm migrate:status
```

## 🎯 Next Steps

- [ ] Setup PostgreSQL và chạy migrations
- [ ] Test API endpoints với Postman/curl
- [ ] Test embedding generation với example schemas
- [ ] Update frontend để sử dụng API cho DB management
- [ ] Implement semantic table search trong UI
- [ ] Add Redis caching cho schemas
- [ ] Setup Docker containers

**Note:**

- Embeddings được generate tự động bằng **@xenova/transformers** (local, no API calls)
- Client-side data (conversations, messages, query results) vẫn sử dụng IndexedDB

## 📊 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15+ with pgvector
- **ORM/Client**: node-postgres (pg)
- **Migration**: Custom migration runner
- **AI/ML**: @xenova/transformers (Supabase/gte-small model)

## 🤝 Contributing

1. Install dependencies: `pnpm install`
2. Create `.env` from `.env.example`
3. Setup PostgreSQL database
4. Run migrations: `pnpm dev`
5. Make changes and test

## 📄 License

MIT

## 📞 Support

- Check [QUICKSTART_POSTGRESQL.md](./QUICKSTART_POSTGRESQL.md) for setup issues
- Check [POSTGRESQL_MIGRATION.md](./POSTGRESQL_MIGRATION.md) for database details
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview

---

**Made with ❤️ for DataLens AI**
