/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Adapter functions to bridge IndexedDB types with existing component interfaces
 * These functions convert between database entities and UI component props
 */

import type { Conversation, DatabaseInfo, Message, QueryResult } from "./types";

// Legacy interfaces for components (to maintain compatibility)
export interface LegacyDatabase {
  id: string;
  name: string;
  type?: "mssql" | "postgresql" | "mysql";
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface LegacyMessage {
  id: string;
  content: string;
  type: "user" | "ai";
  timestamp: Date;
}

export interface LegacyConversation {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: Date;
  messageCount: number;
}

export interface LegacyQueryResult {
  id: string;
  query: string;
  data: any[];
  chartType?: "bar" | "line" | "pie";
  timestamp: Date;
}

/**
 * Convert DatabaseInfo to legacy Database interface
 */
export const databaseInfoToLegacy = (dbInfo: DatabaseInfo): LegacyDatabase => ({
  id: dbInfo.id?.toString() || "",
  name: dbInfo.name,
  type: dbInfo.type,
  connectionString: dbInfo.connectionString,
  host: dbInfo.host,
  port: dbInfo.port,
  database: dbInfo.database,
  username: dbInfo.username,
  password: dbInfo.password,
  ssl: dbInfo.ssl,
});

/**
 * Convert legacy Database to DatabaseInfo
 */
export const legacyToDatabase = (
  legacy: LegacyDatabase
): Omit<DatabaseInfo, "id" | "createdAt" | "updatedAt"> => ({
  name: legacy.name,
  type: legacy.type || "postgresql",
  connectionString: legacy.connectionString,
  host: legacy.host,
  port: legacy.port,
  database: legacy.database,
  username: legacy.username,
  password: legacy.password,
  ssl: legacy.ssl,
  isActive: false, // Default to inactive
});

/**
 * Convert Message to legacy Message interface
 */
export const messageToLegacy = (message: Message): LegacyMessage => ({
  id: message.id?.toString() || "",
  content: message.content,
  type: message.type,
  timestamp: message.createdAt,
});

/**
 * Convert Conversation to legacy Conversation interface
 */
export const conversationToLegacy = (
  conversation: Conversation
): LegacyConversation => ({
  id: conversation.id?.toString() || "",
  title: conversation.title,
  lastMessage: conversation.lastMessage,
  timestamp: conversation.updatedAt,
  messageCount: conversation.messageCount,
});

/**
 * Convert QueryResult to legacy QueryResult interface
 */
export const queryResultToLegacy = (
  queryResult: QueryResult
): LegacyQueryResult => ({
  id: queryResult.id?.toString() || "",
  query: queryResult.sqlQuery,
  data: queryResult.result.data,
  timestamp: queryResult.createdAt,
});

/**
 * Convert arrays of database entities to legacy format
 */
export const databaseArrayToLegacy = (
  databases: DatabaseInfo[]
): LegacyDatabase[] => databases.map(databaseInfoToLegacy);

export const messageArrayToLegacy = (messages: Message[]): LegacyMessage[] =>
  messages.map(messageToLegacy);

export const conversationArrayToLegacy = (
  conversations: Conversation[]
): LegacyConversation[] => conversations.map(conversationToLegacy);

export const queryResultArrayToLegacy = (
  queryResults: QueryResult[]
): LegacyQueryResult[] => queryResults.map(queryResultToLegacy);
