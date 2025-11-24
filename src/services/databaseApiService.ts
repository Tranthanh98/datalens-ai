/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Database API Service
 * Handles all database-related API calls to the backend
 */

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

const getServerUrl = () => {
  return import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
};

export interface DatabaseInfo {
  id: number;
  name: string;
  type: "postgresql" | "mysql" | "mssql";
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  connectionString?: string;
  ssl?: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Database API Service
 */
export class DatabaseApiService {
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

  /**
   * Get all databases
   */
  static async getAllDatabases(): Promise<DatabaseInfo[]> {
    try {
      const response = await fetch(`${getServerUrl()}/api/databases`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<DatabaseInfo[]> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to fetch databases");
      }

      return result.data;
    } catch (error) {
      console.error("Error fetching databases:", error);
      throw error;
    }
  }

  /**
   * Get database by ID
   */
  static async getDatabaseById(id: number): Promise<DatabaseInfo> {
    try {
      const response = await fetch(`${getServerUrl()}/api/databases/${id}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<DatabaseInfo> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to fetch database");
      }

      return result.data;
    } catch (error) {
      console.error("Error fetching database:", error);
      throw error;
    }
  }

  /**
   * Create a new database
   */
  static async createDatabase(
    database: Omit<DatabaseInfo, "id" | "createdAt" | "updatedAt">
  ): Promise<DatabaseInfo> {
    try {
      const response = await fetch(`${getServerUrl()}/api/databases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(database),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<DatabaseInfo> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to create database");
      }

      return result.data;
    } catch (error) {
      console.error("Error creating database:", error);
      throw error;
    }
  }

  /**
   * Update a database
   */
  static async updateDatabase(
    id: number,
    updates: Partial<DatabaseInfo>
  ): Promise<DatabaseInfo> {
    try {
      const response = await fetch(`${getServerUrl()}/api/databases/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<DatabaseInfo> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to update database");
      }

      return result.data;
    } catch (error) {
      console.error("Error updating database:", error);
      throw error;
    }
  }

  /**
   * Delete a database
   */
  static async deleteDatabase(id: number): Promise<void> {
    try {
      const response = await fetch(`${getServerUrl()}/api/databases/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<null> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to delete database");
      }
    } catch (error) {
      console.error("Error deleting database:", error);
      throw error;
    }
  }

  /**
   * Activate a database
   */
  static async activateDatabase(id: number): Promise<DatabaseInfo> {
    try {
      const response = await fetch(
        `${getServerUrl()}/api/databases/${id}/activate`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<DatabaseInfo> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to activate database");
      }

      return result.data;
    } catch (error) {
      console.error("Error activating database:", error);
      throw error;
    }
  }

  /**
   * Get schema for a database
   */
  static async getSchema(id: number): Promise<any> {
    try {
      const response = await fetch(
        `${getServerUrl()}/api/databases/${id}/schema`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<any> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch schema");
      }

      return result.data;
    } catch (error) {
      console.error("Error fetching schema:", error);
      throw error;
    }
  }

  /**
   * Save schema for a database
   */
  static async saveSchema(id: number, schema: any): Promise<void> {
    try {
      const response = await fetch(
        `${getServerUrl()}/api/databases/${id}/schema`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tables: schema }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<null> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to save schema");
      }
    } catch (error) {
      console.error("Error saving schema:", error);
      throw error;
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
}

export default DatabaseApiService;
