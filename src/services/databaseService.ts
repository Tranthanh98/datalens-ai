/* eslint-disable @typescript-eslint/no-explicit-any */

export type DatabaseType = "mssql" | "postgresql" | "mysql";

export interface DatabaseConnection {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

interface SchemaIntrospectionResult {
  success: boolean;
  schema?: any[];
  error?: string;
  connectionValid?: boolean;
}

/**
 * Database Schema Introspection Service
 */
export class DatabaseSchemaService {
  /**
   * Test database connection using Express server
   */
  static async testConnection(
    connection: DatabaseConnection
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Basic validation
      if (!connection.host || !connection.database || !connection.username) {
        return {
          success: false,
          error: "Missing required connection parameters",
        };
      }

      // Call the Express server to test connection
      const serverUrl =
        import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
      const response = await fetch(`${serverUrl}/api/test-connection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(connection),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Server error: ${response.status} ${response.statusText}`,
        };
      }

      const result = await response.json();
      return {
        success: result.success,
        error: result.success ? undefined : result.error || "Connection failed",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Fetch database schema from API
   */
  static async fetchSchema(
    databaseId: string
  ): Promise<SchemaIntrospectionResult> {
    try {
      // Call schema API endpoint
      const serverUrl =
        import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
      const response = await fetch(`${serverUrl}/api/get-schema-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          databaseId,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Schema fetch failed",
          connectionValid: false,
        };
      }

      return {
        success: true,
        schema: result.schema,
        connectionValid: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Schema fetch failed",
        connectionValid: false,
      };
    }
  }

  /**
   * Save schema data to database via API
   * Stores the complete schema as a single JSON object
   */
  static async saveSchemaToDatabase(
    databaseId: number,
    schemaData: any[]
  ): Promise<any> {
    try {
      // Save schema to PostgreSQL via API
      const serverUrl =
        import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
      const response = await fetch(
        `${serverUrl}/api/databases/${databaseId}/schema`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tables: schemaData,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save schema to database");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to save schema");
      }

      console.log("Schema saved successfully:", result.message);
      return result;
    } catch (error) {
      console.error("Failed to save schema to database:", error);
      throw error;
    }
  }
}

export default DatabaseSchemaService;
