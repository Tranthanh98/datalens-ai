/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Dexie IndexedDB configuration for DataLens AI
 * Manages local storage for database connections, conversations, messages, and query results
 */

import Dexie, { type EntityTable } from "dexie";
import type {
  Conversation,
  DatabaseInfo,
  Message,
  QueryResult,
  SchemaInfo,
  UserSettings,
} from "./types";

/**
 * DataLens AI Database class extending Dexie
 * Provides structured access to IndexedDB with proper TypeScript support
 */
export class DataLensDatabase extends Dexie {
  // Database tables with proper typing
  databaseInfo!: EntityTable<DatabaseInfo, "id">;
  conversations!: EntityTable<Conversation, "id">;
  messages!: EntityTable<Message, "id">;
  queryResults!: EntityTable<QueryResult, "id">;
  schemaInfo!: EntityTable<SchemaInfo, "id">;
  userSettings!: EntityTable<UserSettings, "id">;

  constructor() {
    super("DataLensAI");

    // Define database schema with indexes for optimal performance
    this.version(1).stores({
      // Database connections
      databaseInfo: "++id, name, type, isActive, createdAt, updatedAt",

      // Conversations
      conversations:
        "++id, title, databaseId, createdAt, updatedAt, messageCount",

      // Messages within conversations
      messages: "++id, conversationId, type, createdAt",

      // Query execution results
      queryResults: "++id, conversationId, messageId, status, createdAt",

      // Cached database schema information
      schemaInfo: "++id, databaseId, createdAt, updatedAt",

      // User preferences and settings
      userSettings: "++id, theme, language, createdAt, updatedAt",
    });

    // Add hooks for automatic timestamp management
    this.databaseInfo.hook("creating", (primKey, obj: DatabaseInfo, trans) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.databaseInfo.hook(
      "updating",
      (modifications: Partial<DatabaseInfo>, primKey, obj, trans) => {
        modifications.updatedAt = new Date();
      }
    );

    this.conversations.hook("creating", (primKey, obj: Conversation, trans) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
      if (!obj.messageCount) obj.messageCount = 0;
    });

    this.conversations.hook(
      "updating",
      (modifications: Partial<Conversation>, primKey, obj, trans) => {
        modifications.updatedAt = new Date();
      }
    );

    this.messages.hook("creating", (primKey, obj: Message, trans) => {
      obj.createdAt = new Date();
    });

    this.queryResults.hook("creating", (primKey, obj: QueryResult, trans) => {
      obj.createdAt = new Date();
    });

    this.schemaInfo.hook("creating", (primKey, obj: SchemaInfo, trans) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.schemaInfo.hook(
      "updating",
      (modifications: Partial<SchemaInfo>, primKey, obj, trans) => {
        modifications.updatedAt = new Date();
      }
    );

    this.userSettings.hook("creating", (primKey, obj: UserSettings, trans) => {
      obj.createdAt = new Date();
      obj.updatedAt = new Date();
    });

    this.userSettings.hook(
      "updating",
      (modifications: Partial<UserSettings>, primKey, obj, trans) => {
        modifications.updatedAt = new Date();
      }
    );
  }

  /**
   * Initialize database with default settings
   */
  async initializeDefaults() {
    try {
      // Check if user settings exist, if not create default
      const settingsCount = await this.userSettings.count();
      if (settingsCount === 0) {
        await this.userSettings.add({
          theme: "system",
          language: "vi",
          autoSaveConversations: true,
          maxConversationHistory: 100,
          aiModel: "gpt-4",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Failed to initialize database defaults:", error);
    }
  }

  /**
   * Clear all data (useful for development/testing)
   */
  async clearAllData() {
    await this.transaction("rw", this.tables, async () => {
      await Promise.all(this.tables.map((table) => table.clear()));
    });
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const [
      databaseCount,
      conversationCount,
      messageCount,
      queryResultCount,
      schemaCount,
    ] = await Promise.all([
      this.databaseInfo.count(),
      this.conversations.count(),
      this.messages.count(),
      this.queryResults.count(),
      this.schemaInfo.count(),
    ]);

    return {
      databases: databaseCount,
      conversations: conversationCount,
      messages: messageCount,
      queryResults: queryResultCount,
      schemas: schemaCount,
    };
  }
}

// Create and export database instance
export const db = new DataLensDatabase();

// Initialize defaults when database is opened
db.open().then(() => {
  db.initializeDefaults();
});

export default db;
