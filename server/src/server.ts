import cors from "cors";
import dotenv from "dotenv";
import express, { Express } from "express";
import { initializeFromEnv } from "./db/client";
import { runMigrationsFromEnv } from "./db/migrations";
import { SchemaService } from "./services/schemaService";
import { DatabaseConnectionInfo } from "./utils/schemaQueries";

import { databaseInfoRepository } from "./repositories/databaseInfoRepository";
import { schemaInfoRepository } from "./repositories/schemaInfoRepository";
import { embeddingService } from "./services/embeddingService";
import { QueryExecutionService } from "./services/queryExecutionService";
import {
  testMySQLConnection,
  testPostgreSQLConnection,
  testSQLServerConnection,
} from "./services/testDbService";
import type { TableSchema } from "./types/schema";

// Interface for database connection
export interface DatabaseConnection {
  type: "postgresql" | "mysql" | "mssql";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  connectionString?: string;
  ssl?: boolean;
}

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
/**
 * Test database connection endpoint
 */
app.post("/api/test-connection", async (req, res) => {
  try {
    const config: DatabaseConnection = req.body;

    if (
      !config.type ||
      !config.host ||
      !config.database ||
      !config.username ||
      !config.password
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required connection parameters",
      });
    }

    let isConnected = false;

    switch (config.type) {
      case "postgresql":
        isConnected = await testPostgreSQLConnection(config);
        break;
      case "mysql":
        isConnected = await testMySQLConnection(config);
        break;
      case "mssql":
        isConnected = await testSQLServerConnection(config);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: "Unsupported database type",
        });
    }

    res.json({
      success: isConnected,
      message: isConnected ? "Connection successful" : "Connection failed",
    });
  } catch (error) {
    console.error("Connection test error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * Get database schema query endpoint
 * Returns the schema data as JSON object after executing the query
 */
app.post("/api/get-schema-query", async (req, res) => {
  try {
    const { databaseId } = req.body;

    console.log("req.body:", req.body);

    console.log("Received database ID:", databaseId);

    // Validate required fields
    if (!databaseId) {
      return res.status(400).json({
        success: false,
        error: "Missing required database ID",
      });
    }

    // Get database info by ID
    const dbInfo = await databaseInfoRepository.getById(databaseId);

    if (!dbInfo) {
      return res.status(404).json({
        success: false,
        error: `Database with ID ${databaseId} not found`,
      });
    }

    // Validate database type
    const supportedTypes: string[] = ["postgresql", "mysql", "mssql"];
    if (!supportedTypes.includes(dbInfo.type)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported database type: ${
          dbInfo.type
        }. Supported types: ${supportedTypes.join(", ")}`,
      });
    }

    // Execute schema query and return JSON result
    const schemaService = new SchemaService();
    const schemaData = await schemaService.executeSchemaQuery({
      type: dbInfo.type,
      host: dbInfo.host || "",
      port: dbInfo.port || 5432,
      database: dbInfo.database || "",
      username: dbInfo.username || "",
      password: dbInfo.password || "",
      ssl: dbInfo.ssl || false,
    } as DatabaseConnectionInfo);

    res.json({
      success: true,
      schema: schemaData,
      databaseType: dbInfo.type,
    });
  } catch (error) {
    console.error("Schema query execution error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to execute schema query",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Execute SQL query endpoint
 * Used by AI service to execute generated queries
 */
app.post("/api/execute-sql", async (req, res) => {
  try {
    const { databaseId, query } = req.body;

    // Validate required fields
    if (!databaseId || !query) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: databaseId and query",
      });
    }

    // Get database info by ID
    const dbInfo = await databaseInfoRepository.getById(databaseId);

    if (!dbInfo) {
      return res.status(404).json({
        success: false,
        error: `Database with ID ${databaseId} not found`,
      });
    }

    // Build connection info from database record
    const connectionInfo: DatabaseConnectionInfo = {
      type: dbInfo.type,
      host: dbInfo.host || "",
      port: dbInfo.port || 5432,
      database: dbInfo.database || "",
      username: dbInfo.username || "",
      password: dbInfo.password || "",
      ssl: dbInfo.ssl || false,
    };

    // Additional security check - only allow SELECT queries
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith("select")) {
      return res.status(400).json({
        success: false,
        error: "Only SELECT queries are allowed for security reasons",
      });
    }

    // Execute the query
    const queryService = new QueryExecutionService();
    const result = await queryService.executeQuery(connectionInfo, query);

    res.json({
      success: true,
      data: result.rows,
      rowCount: result.rowCount,
      fields: result.fields,
      query: query,
      databaseType: dbInfo.type,
      databaseId: dbInfo.id,
      databaseName: dbInfo.name,
    });
  } catch (error) {
    console.error("SQL query execution error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to execute SQL query",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Health check endpoint
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "DataLens AI Database Server",
  });
});

// ============================================
// Database Management API Endpoints
// ============================================

/**
 * Get all database connections
 */
app.get("/api/databases", async (req, res) => {
  try {
    const databases = await databaseInfoRepository.getAll();
    res.json({
      success: true,
      data: databases,
    });
  } catch (error) {
    console.error("Failed to get databases:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve databases",
    });
  }
});

/**
 * Get database by ID
 */
app.get("/api/databases/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const database = await databaseInfoRepository.getById(id);

    if (!database) {
      return res.status(404).json({
        success: false,
        error: "Database not found",
      });
    }

    res.json({
      success: true,
      data: database,
    });
  } catch (error) {
    console.error("Failed to get database:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve database",
    });
  }
});

/**
 * Create new database connection
 */
app.post("/api/databases", async (req, res) => {
  try {
    const database = await databaseInfoRepository.create(req.body);
    res.status(201).json({
      success: true,
      data: database,
    });
  } catch (error) {
    console.error("Failed to create database:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create database connection",
    });
  }
});

/**
 * Update database connection
 */
app.put("/api/databases/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const database = await databaseInfoRepository.update(id, req.body);

    if (!database) {
      return res.status(404).json({
        success: false,
        error: "Database not found",
      });
    }

    res.json({
      success: true,
      data: database,
    });
  } catch (error) {
    console.error("Failed to update database:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update database connection",
    });
  }
});

/**
 * Delete database connection
 */
app.delete("/api/databases/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await databaseInfoRepository.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Database not found",
      });
    }

    res.json({
      success: true,
      message: "Database connection deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete database:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete database connection",
    });
  }
});

/**
 * Set active database
 */
app.post("/api/databases/:id/activate", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await databaseInfoRepository.setActive(id);

    res.json({
      success: true,
      message: "Database activated successfully",
    });
  } catch (error) {
    console.error("Failed to activate database:", error);
    res.status(500).json({
      success: false,
      error: "Failed to activate database",
    });
  }
});

/**
 * Get schema for a database
 * Returns all table schemas for the database
 */
app.get("/api/databases/:id/schema", async (req, res) => {
  try {
    const databaseId = parseInt(req.params.id, 10);
    const schemas = await schemaInfoRepository.getByDatabaseId(databaseId);

    if (!schemas || schemas.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No schema found for this database",
      });
    }

    res.json({
      success: true,
      data: {
        databaseId,
        tableCount: schemas.length,
        tables: schemas,
      },
    });
  } catch (error) {
    console.error("Failed to get schema:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve schema",
    });
  }
});

/**
 * Save schema for a database with automatic embedding generation
 * Accepts an array of tables and generates embeddings for each table
 */
app.post("/api/databases/:id/schema", async (req, res) => {
  try {
    const databaseId = parseInt(req.params.id, 10);
    const { tables } = req.body;

    if (!tables || !Array.isArray(tables)) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid 'tables' array in request body",
      });
    }

    // Validate table structure
    // for (const table of tables) {
    //   if (!table.tableName || !table.tableDescription) {
    //     return res.status(400).json({
    //       success: false,
    //       error: "Each table must have 'tableName' and 'tableDescription'",
    //     });
    //   }
    // }

    console.log(`Generating embeddings for ${tables.length} tables...`);

    // Generate embeddings for each table
    const tablesWithEmbeddings: Array<{
      schema: TableSchema;
      embedding: number[];
    }> = [];

    for (const table of tables) {
      try {
        // Generate embedding for this table
        const embedding = await embeddingService.generateTableEmbedding(
          table.tableName,
          table.tableDescription
        );

        tablesWithEmbeddings.push({
          schema: table,
          embedding: embedding,
        });

        console.log(`✓ Generated embedding for table: ${table.tableName}`);
      } catch (error) {
        console.error(
          `Failed to generate embedding for table ${table.tableName}:`,
          error
        );
        // Continue with other tables even if one fails
        tablesWithEmbeddings.push({
          schema: table,
          embedding: [], // Empty embedding if generation fails
        });
      }
    }

    // Save table schemas with embeddings (one record per table)
    const savedCount = await schemaInfoRepository.upsertTableSchemas(
      databaseId,
      tablesWithEmbeddings
    );

    console.log(
      `✓ Saved ${savedCount} table schemas with embeddings for database ${databaseId}`
    );

    res.json({
      success: true,
      data: {
        databaseId: databaseId,
        tablesCount: tables.length,
        savedCount: savedCount,
        tablesWithEmbeddings: tablesWithEmbeddings.length,
      },
      message: `Successfully saved ${savedCount} table schemas with embeddings`,
    });
  } catch (error) {
    console.error("Failed to save schema:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save schema",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Search for similar tables across all databases
 * Uses semantic search based on table embeddings
 */
app.post("/api/database/:id/schema/search-similar-tables", async (req, res) => {
  try {
    const databaseId = parseInt(req.params.id, 10);
    const { query, limit } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid 'query' string in request body",
      });
    }

    // Generate embedding for the search query
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // Find similar tables
    const similarTables = await schemaInfoRepository.findSimilarTables(
      queryEmbedding,
      limit || 10,
      databaseId
    );

    // Transform the data to match expected format
    const formattedResults = similarTables.map((table) => ({
      schema:
        typeof table.columnSchemas === "string"
          ? JSON.parse(table.columnSchemas)
          : table.columnSchemas,
      similarity: table.similarity,
    }));

    console.log(
      `Found ${formattedResults.length} similar tables for query: "${query}"`
    );

    res.json({
      success: true,
      data: formattedResults,
      query,
      resultsCount: formattedResults.length,
    });
  } catch (error) {
    console.error("Failed to search similar tables:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search similar tables",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Initialize database and run migrations before starting server
 */
async function startServer() {
  try {
    console.log("🔧 Initializing DataLens AI Server...");

    // Initialize database connection pool
    initializeFromEnv();
    console.log("✓ Database connection pool initialized");

    // Run migrations if AUTO_RUN_MIGRATIONS is enabled
    if (process.env.AUTO_RUN_MIGRATIONS !== "false") {
      console.log("🔄 Running database migrations...");
      await runMigrationsFromEnv();
      console.log("✓ Migrations completed");
    } else {
      console.log("⚠️  Auto-migrations disabled. Run manually if needed.");
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`🚀 DataLens AI Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  process.exit(0);
});

// Start the server
startServer();

export default app;
