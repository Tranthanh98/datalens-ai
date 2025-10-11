// Define the database connection interface for frontend use
export interface DatabaseConnectionInfo {
  type: 'postgresql' | 'mysql' | 'mssql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

/**
 * Service for executing SQL queries via the backend API
 */
export class QueryExecutionApiService {
  private static readonly BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  /**
   * Execute a SQL query using the backend API
   * @param connectionInfo - Database connection information
   * @param query - SQL query to execute
   * @returns Promise with query results
   */
  static async executeQuery(
    connectionInfo: DatabaseConnectionInfo,
    query: string
  ): Promise<any> {
    try {
      const response = await fetch(`${this.BASE_URL}/api/execute-sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionInfo,
          query,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error executing SQL query:', error);
      throw error;
    }
  }

  /**
   * Create an executeSQL function for a specific database connection
   * This function can be passed to runAIQuery
   * @param connectionInfo - Database connection information
   * @returns Function that executes SQL queries for this connection
   */
  static createExecutor(connectionInfo: DatabaseConnectionInfo) {
    return async (sql: string): Promise<any> => {
      return this.executeQuery(connectionInfo, sql);
    };
  }
}

export default QueryExecutionApiService;