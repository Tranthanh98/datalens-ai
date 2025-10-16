/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Database API Service
 * Handles all database-related API calls to the backend
 */

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
}

export default DatabaseApiService;
