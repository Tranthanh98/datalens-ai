/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TypeScript interfaces for IndexedDB entities
 * Defines the structure for all database tables in DataLens AI
 */

// Database connection information
export interface DatabaseInfo {
  id?: number;
  name: string;
  type: "postgresql" | "mysql" | "mssql";
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Conversation sessions
export interface Conversation {
  id?: number;
  title: string;
  databaseId: number; // Foreign key to DatabaseInfo
  lastMessage?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Chat messages within conversations
export interface Message {
  id?: number;
  conversationId: number; // Foreign key to Conversation
  content: string;
  type: "user" | "ai";
  createdAt: Date;
}

// Query execution results
export interface QueryResult {
  id?: number;
  conversationId: number; // Foreign key to Conversation
  messageId?: number; // Foreign key to Message (optional)
  sqlQuery: string;
  result: {
    data: any[];
    columns: string[];
    rowCount: number;
    executionTime: number;
  };
  chartData?: {
    type: "bar" | "pie" | "line" | "none";
    data: Array<{ name: string; value: number; [key: string]: any }>;
    xAxisKey?: string;
    yAxisKey?: string;
    description?: string;
  };
  status: "success" | "error";
  errorMessage?: string;
  createdAt: Date;
}

// Database schema information (cached)
export interface SchemaInfo {
  id?: number;
  databaseId: number; // Foreign key to DatabaseInfo
  schema: any; // JSON object containing the full schema data
  createdAt: Date;
  updatedAt: Date;
}

// User preferences and settings
export interface UserSettings {
  id?: number;
  theme: "light" | "dark" | "system";
  language: "en" | "vi";
  autoSaveConversations: boolean;
  maxConversationHistory: number;
  defaultDatabase?: number; // Foreign key to DatabaseInfo
  aiModel: string;
  createdAt: Date;
  updatedAt: Date;
}
