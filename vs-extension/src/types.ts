/**
 * Database connection types
 */
export type DatabaseType = "postgresql" | "mssql";

/**
 * Database connection information
 */
export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

/**
 * Database schema information
 */
export interface DatabaseSchema {
  table_name: string;
  table_schema: string;
  columns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: boolean;
    is_primary_key: boolean;
    is_foreign_key: boolean;
    references?: {
      referenced_table: string;
      referenced_column: string;
    };
  }>;
}

/**
 * Chat message types
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

/**
 * Query execution result
 */
export interface QueryResult {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
}
