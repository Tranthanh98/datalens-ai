# Schema API with Embeddings - Documentation

## Overview

API này cho phép lưu trữ database schema với automatic embedding generation cho mỗi table. Sử dụng **@xenova/transformers** với model **Supabase/gte-small** để generate embeddings.

## Features

✅ Automatic embedding generation cho mỗi table  
✅ Semantic search cho tables dựa trên description  
✅ Lưu trữ embeddings cùng schema trong JSONB  
✅ Fast local inference (không cần OpenAI API)  
✅ Batch processing cho multiple tables

## API Endpoints

### 1. Save Schema with Embeddings

**Endpoint:** `POST /api/databases/:id/schema`

**Description:** Lưu schema cho database với automatic embedding generation cho mỗi table dựa trên `tableDescription`.

**Request Body:**

```json
{
  "tables": [
    {
      "tableName": "users",
      "tableDescription": "Stores user account information including credentials and profile data",
      "isRelevant": true,
      "category": "Users",
      "columns": [
        {
          "columnName": "id",
          "dataType": "integer",
          "isPrimaryKey": true,
          "isForeignKey": false,
          "isNullable": false,
          "description": "Unique user identifier",
          "isRelevant": true
        },
        {
          "columnName": "email",
          "dataType": "varchar(255)",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": false,
          "description": "User email address for login and communication",
          "isRelevant": true
        },
        {
          "columnName": "created_at",
          "dataType": "timestamp",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": false,
          "description": "Account creation timestamp",
          "isRelevant": true
        }
      ],
      "primaryKey": ["id"],
      "foreignKeys": []
    },
    {
      "tableName": "orders",
      "tableDescription": "Contains customer order records with product and payment details",
      "isRelevant": true,
      "category": "Sales",
      "columns": [
        {
          "columnName": "id",
          "dataType": "integer",
          "isPrimaryKey": true,
          "isForeignKey": false,
          "isNullable": false,
          "description": "Unique order identifier",
          "isRelevant": true
        },
        {
          "columnName": "user_id",
          "dataType": "integer",
          "isPrimaryKey": false,
          "isForeignKey": true,
          "referencedTable": "users",
          "isNullable": false,
          "description": "Reference to the user who placed the order",
          "isRelevant": true
        },
        {
          "columnName": "total_amount",
          "dataType": "decimal(10,2)",
          "isPrimaryKey": false,
          "isForeignKey": false,
          "isNullable": false,
          "description": "Total order amount in currency",
          "isRelevant": true
        }
      ],
      "primaryKey": ["id"],
      "foreignKeys": [
        {
          "columnName": "user_id",
          "referencedTable": "users",
          "referencedColumn": "id"
        }
      ]
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "databaseId": 1,
    "tablesCount": 2,
    "tablesWithEmbeddings": 2,
    "createdAt": "2025-10-16T10:30:00Z",
    "updatedAt": "2025-10-16T10:30:00Z"
  },
  "message": "Successfully saved schema with 2 tables and embeddings"
}
```

**Processing:**

1. Validates table structure
2. For each table, generates embedding from: `"Table: {tableName}. Description: {tableDescription}"`
3. Combines table data with embedding
4. Saves to PostgreSQL as JSONB

### 2. Search Similar Tables

**Endpoint:** `POST /api/schema/search-similar-tables`

**Description:** Tìm kiếm tables tương tự dựa trên semantic similarity.

**Request Body:**

```json
{
  "query": "user authentication and login",
  "limit": 5
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "databaseId": 1,
      "tableName": "users",
      "tableDescription": "Stores user account information including credentials and profile data",
      "similarity": 0.8523
    },
    {
      "databaseId": 1,
      "tableName": "sessions",
      "tableDescription": "Active user sessions for authentication tracking",
      "similarity": 0.7891
    },
    {
      "databaseId": 2,
      "tableName": "auth_tokens",
      "tableDescription": "JWT tokens for user authentication",
      "similarity": 0.7234
    }
  ],
  "query": "user authentication and login",
  "resultsCount": 3
}
```

### 3. Get Schema (Existing)

**Endpoint:** `GET /api/databases/:id/schema`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "databaseId": 1,
    "schema": {
      "tables": [
        {
          "tableName": "users",
          "tableDescription": "...",
          "embedding": [0.123, 0.456, ...],
          "columns": [...],
          ...
        }
      ]
    },
    "createdAt": "2025-10-16T10:30:00Z",
    "updatedAt": "2025-10-16T10:30:00Z"
  }
}
```

## Schema Structure

### TableSchema Type

```typescript
interface ColumnSchema {
  columnName: string;
  dataType: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencedTable?: string;
  isNullable?: boolean;
  description: string;
  isRelevant: boolean;
}

interface ForeignKeySchema {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

interface TableSchema {
  tableName: string;
  tableDescription: string;
  isRelevant: boolean;
  category: string;
  columns: ColumnSchema[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeySchema[];
  embedding?: number[]; // Auto-generated
}
```

## Embedding Model

**Model:** `Supabase/gte-small`  
**Dimension:** 384  
**Method:** Feature extraction with mean pooling and normalization  
**Runtime:** Local (no API calls needed)

### Model Initialization

Model được lazy-load lần đầu khi sử dụng. Sau đó được cache trong memory.

```
First request: ~2-5 seconds (download + load model)
Subsequent requests: ~50-200ms per table
```

## Usage Examples

### Example 1: Save Schema from Frontend

```typescript
const saveSchema = async (databaseId: number, tables: TableSchema[]) => {
  const response = await fetch(`/api/databases/${databaseId}/schema`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tables }),
  });

  const result = await response.json();
  console.log(`Saved ${result.data.tablesCount} tables with embeddings`);
};
```

### Example 2: Search for Relevant Tables

```typescript
const searchTables = async (query: string) => {
  const response = await fetch("/api/schema/search-similar-tables", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit: 10,
    }),
  });

  const result = await response.json();
  return result.data; // Array of similar tables
};

// Usage
const results = await searchTables("customer purchase history");
console.log(`Found ${results.length} relevant tables`);
```

## Performance

### Embedding Generation

- **Single table:** ~50-200ms
- **10 tables:** ~1-2 seconds
- **100 tables:** ~10-20 seconds

### Storage

- **Embedding size:** 384 dimensions × 4 bytes = ~1.5 KB per table
- **Full table schema:** ~5-10 KB per table
- **Total per database:** ~10-50 KB (for typical schemas)

### Search Performance

- **Similarity search:** O(n) where n = total tables across all databases
- **Typical search time:** <100ms for 1000 tables

**Note:** For better performance với large datasets, có thể implement:

- Caching layer (Redis)
- Pre-filtering by category
- Batch processing

## Error Handling

### Common Errors

**1. Missing tables array**

```json
{
  "success": false,
  "error": "Missing or invalid 'tables' array in request body"
}
```

**2. Invalid table structure**

```json
{
  "success": false,
  "error": "Each table must have 'tableName' and 'tableDescription'"
}
```

**3. Embedding generation failed**

```json
{
  "success": false,
  "error": "Failed to save schema",
  "details": "Model initialization failed"
}
```

## Best Practices

### 1. Table Descriptions

✅ **Good:**

```json
{
  "tableDescription": "Stores customer order records including items, quantities, prices, and payment status"
}
```

❌ **Bad:**

```json
{
  "tableDescription": "Orders table"
}
```

### 2. Batch Processing

Nếu có nhiều databases, save schemas theo batch để tránh timeout:

```typescript
// Process in chunks of 5 databases
for (let i = 0; i < databases.length; i += 5) {
  const batch = databases.slice(i, i + 5);
  await Promise.all(batch.map((db) => saveSchema(db.id, db.tables)));
}
```

### 3. Error Recovery

```typescript
const saveSchemaWithRetry = async (databaseId, tables, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await saveSchema(databaseId, tables);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

## Migration from Old Schema Format

Nếu bạn có schemas cũ với `schema_embedding` (single embedding cho toàn bộ schema), bạn có thể migrate sang format mới:

```typescript
// Old format
{
  "schema": {...},
  "schemaEmbedding": [...]
}

// New format
{
  "tables": [
    {
      "tableName": "...",
      "tableDescription": "...",
      "embedding": [...],
      "columns": [...]
    }
  ]
}
```

## Future Enhancements

- 🔜 Support multiple embedding models
- 🔜 Column-level embeddings
- 🔜 Incremental updates (only re-generate changed tables)
- 🔜 Embedding caching layer
- 🔜 Vector database (Pinecone/Weaviate) for faster search at scale
