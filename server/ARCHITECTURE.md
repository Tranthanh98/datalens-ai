# DataLens AI - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DataLens AI Frontend                        │
│                        (React + Zustand)                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP/REST API
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                      Express.js Server                              │
│                      (Port 3001)                                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    API Endpoints                             │ │
│  │  • /api/databases (CRUD)                                     │ │
│  │  • /api/databases/:id/schema                                 │ │
│  │  • /api/test-connection                                      │ │
│  │  • /api/execute-sql                                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                  Repository Layer                            │ │
│  │  • DatabaseInfoRepository                                    │ │
│  │  • SchemaInfoRepository                                      │ │
│  │  • ConversationRepository (future)                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                  Database Client                             │ │
│  │  • PostgreSQL Connection Pool                                │ │
│  │  • Query Interface                                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │               Migration System                               │ │
│  │  • Auto-run on startup                                       │ │
│  │  • Track executed migrations                                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ PostgreSQL Protocol
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    PostgreSQL Database                              │
│                    (datalens_ai)                                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                 Core Tables                                  │ │
│  │                                                              │ │
│  │  database_info         ← Database connections               │ │
│  │  schema_info           ← Cached schemas + embeddings        │ │
│  │  schema_migrations     ← Migration tracking                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              pgvector Extension                              │ │
│  │                                                              │ │
│  │  • Vector storage (1536 dimensions)                          │ │
│  │  • HNSW indexes for fast similarity search                   │ │
│  │  • Cosine distance operator (<=>)                            │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   IndexedDB (Client-side)                           │
│                                                                     │
│  • conversations         ← Chat sessions                            │
│  • messages              ← Chat messages                            │
│  • query_results         ← SQL results + charts                     │
│  • user_settings         ← User preferences                         │
└─────────────────────────────────────────────────────────────────────┘

         │                                            │
         │ Query                                      │ Query
         │                                            │
         ▼                                            ▼
┌─────────────────────┐                    ┌──────────────────────┐
│  Target Databases   │                    │   OpenAI API         │
│                     │                    │   (Future)           │
│  • PostgreSQL       │                    │                      │
│  • MySQL            │                    │  • Generate          │
│  • SQL Server       │                    │    embeddings        │
└─────────────────────┘                    │  • Semantic search   │
                                           └──────────────────────┘
```

## Data Flow

### 1. Database Connection Flow

```
User → Frontend → POST /api/databases
                      │
                      ▼
                  DatabaseInfoRepository
                      │
                      ▼
                  PostgreSQL
                      │
                      ▼
              database_info table
```

### 2. Schema Caching Flow

```
User → Frontend → POST /api/get-schema-query
                      │
                      ▼
                  SchemaService
                      │
                      ├─→ Query Target Database
                      │       │
                      │       ▼
                      │   Get Schema
                      │
                      ▼
            SchemaInfoRepository
                      │
                      ▼
                  PostgreSQL
                      │
                      ▼
              schema_info table
              (with embeddings)
```

### 3. Query Execution Flow

```
User Question → Frontend → POST /api/execute-sql
                              │
                              ├─→ Get DB Connection Info
                              │       │
                              │       ▼
                              │   DatabaseInfoRepository
                              │
                              ├─→ Execute Query
                              │       │
                              │       ▼
                              │   Target Database
                              │
                              └─→ Save Result
                                      │
                                      ▼
                              QueryResultRepository (future)
                                      │
                                      ▼
                                  PostgreSQL
```

### 4. Semantic Search Flow (Future)

```
Schema Text → Generate Embedding → OpenAI API
                      │
                      ▼
              Store in schema_info table
                      │
                      ▼
              Vector Index (HNSW)
                      │
                      ▼
        Find Similar Schemas
              using cosine similarity
                      │
                      ▼
              Return Relevant Context
```

**Note:** Messages và conversations được lưu trong IndexedDB ở client-side.

## Migration Flow

```
Server Start
     │
     ▼
Initialize DB Client
     │
     ▼
Check AUTO_RUN_MIGRATIONS
     │
     ├─→ true
     │    │
     │    ▼
     │  MigrationRunner
     │    │
     │    ├─→ Create schema_migrations table
     │    │
     │    ├─→ Get executed migrations
     │    │
     │    ├─→ Get pending migrations
     │    │
     │    └─→ Execute pending migrations
     │             │
     │             ▼
     │        Run SQL files
     │             │
     │             ▼
     │        Track in schema_migrations
     │
     └─→ false
          │
          ▼
     Skip migrations
          │
          ▼
    Start Express Server
```

## Database Schema Relationships

```
database_info (1) ─────────────┐
     │                         │
     │                         │ (1:1)
     │                         │
     │                         ▼
     │                    schema_info
     │                    (with embeddings)
     │
     └─→ (Referenced by IndexedDB conversations on client)

--- Client-side (IndexedDB) ---

conversations (stores database_id reference)
     │
     ├─→ messages (1:N)
     │
     └─→ query_results (1:N)

user_settings (stores default_database reference)
```

## Vector Search Architecture

```
┌─────────────────────────────────────────┐
│       Schema_Info Table                 │
│  ┌──────────────────────────────────┐   │
│  │ id │ database_id │ schema_embed │   │
│  ├────┼─────────────┼──────────────┤   │
│  │ 1  │ 101         │ [0.1, 0.2..] │   │
│  │ 2  │ 102         │ [0.3, 0.4..] │   │
│  └────┴─────────────┴──────────────┘   │
│           │                             │
│           │ HNSW Index                  │
│           │ (vector_cosine_ops)         │
│           ▼                             │
│  ┌──────────────────────────────────┐   │
│  │   Fast Schema Similarity Search  │   │
│  │   Query: schema_embedding <=> $1 │   │
│  │   Order: cosine distance         │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘

Query Schema Embedding [0.15, 0.25, ...]
         │
         ▼
    Find top K similar schemas
         │
         ▼
    Return results with similarity scores
```

## Technology Stack

```
┌─────────────────────────────────────────┐
│           Frontend                      │
│  • React                                │
│  • TypeScript                           │
│  • Zustand (State Management)          │
│  • Vite (Build Tool)                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           Backend                       │
│  • Node.js                              │
│  • Express.js                           │
│  • TypeScript                           │
│  • pg (PostgreSQL client)               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           Database                      │
│  • PostgreSQL 15+                       │
│  • pgvector extension                   │
│  • JSONB for flexible storage           │
│  • HNSW for vector search               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           Future Integrations           │
│  • OpenAI API (embeddings)              │
│  • Redis (caching)                      │
│  • Docker (containerization)            │
└─────────────────────────────────────────┘
```
