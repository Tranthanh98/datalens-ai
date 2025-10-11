import cors from "cors";
import express from "express";
// @ts-ignore
import { Express } from "express";
import { SchemaService } from "./services/schemaService";
import { DatabaseConnectionInfo } from "./utils/schemaQueries";

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

import {
  testMySQLConnection,
  testPostgreSQLConnection,
  testSQLServerConnection,
} from "./services/testDbService";
import { QueryExecutionService } from "./services/queryExecutionService";

// Interface for database connection
export interface DatabaseConnection {
  type: "postgresql" | "mysql" | "mssql";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  connectionString?: string;
}

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
    const connectionInfo: DatabaseConnectionInfo = req.body;

    console.log("Received connection info:", connectionInfo);

    // Validate required fields
    if (
      !connectionInfo.type ||
      !connectionInfo.host ||
      !connectionInfo.database ||
      !connectionInfo.username ||
      !connectionInfo.password
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required connection parameters (type, host, database, username, password)",
      });
    }

    // Validate database type
    const supportedTypes: string[] = ["postgresql", "mysql", "mssql"];
    if (!supportedTypes.includes(connectionInfo.type)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported database type: ${
          connectionInfo.type
        }. Supported types: ${supportedTypes.join(", ")}`,
      });
    }

    // Execute schema query and return JSON result
    const schemaService = new SchemaService();
    const schemaData = await schemaService.executeSchemaQuery(connectionInfo);

    res.json({
      success: true,
      schema: schemaData,
      databaseType: connectionInfo.type,
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
    const { connectionInfo, query } = req.body;

    // Validate required fields
    if (!connectionInfo || !query) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: connectionInfo and query",
      });
    }

    // Validate connection info
    if (
      !connectionInfo.type ||
      !connectionInfo.host ||
      !connectionInfo.database ||
      !connectionInfo.username ||
      !connectionInfo.password
    ) {
      return res.status(400).json({
        success: false,
        error: "Missing required connection parameters (type, host, database, username, password)",
      });
    }

    // Validate database type
    const supportedTypes: string[] = ["postgresql", "mysql", "mssql"];
    if (!supportedTypes.includes(connectionInfo.type)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported database type: ${connectionInfo.type}. Supported types: ${supportedTypes.join(", ")}`,
      });
    }

    // Additional security check - only allow SELECT queries
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery.startsWith('select')) {
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
      databaseType: connectionInfo.type,
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Database server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
