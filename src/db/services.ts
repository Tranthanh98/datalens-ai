/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Database service functions for CRUD operations
 * Provides high-level API for interacting with IndexedDB through Dexie
 */

import { db } from "./database";
import type {
  Conversation,
  DatabaseInfo,
  Message,
  QueryResult,
  SchemaInfo,
  UserSettings,
} from "./types";

// ==================== DATABASE INFO SERVICES ====================

/**
 * Database connection management services
 */
export const DatabaseService = {
  /**
   * Add a new database connection
   */
  async add(
    database: Omit<DatabaseInfo, "id" | "createdAt" | "updatedAt">
  ): Promise<number> {
    const id = await db.databaseInfo.add(database as DatabaseInfo);
    return typeof id === "number" ? id : Number(id);
  },

  /**
   * Get all database connections
   */
  async getAll(): Promise<DatabaseInfo[]> {
    return await db.databaseInfo.orderBy("createdAt").reverse().toArray();
  },

  /**
   * Get active database connection
   */
  async getActive(): Promise<DatabaseInfo | undefined> {
    return await db.databaseInfo.where("isActive").equals(1).first();
  },

  /**
   * Get database by ID
   */
  async getById(id: number): Promise<DatabaseInfo | undefined> {
    return await db.databaseInfo.get(id);
  },

  /**
   * Update database connection
   */
  async update(id: number, changes: Partial<DatabaseInfo>): Promise<number> {
    return await db.databaseInfo.update(id, changes);
  },

  /**
   * Set active database (deactivates others)
   */
  async setActive(id: number): Promise<void> {
    await db.transaction("rw", db.databaseInfo, async () => {
      // Deactivate all databases
      await db.databaseInfo.toCollection().modify({ isActive: false });
      // Activate the selected one
      await db.databaseInfo.update(id, { isActive: true });
    });
  },

  /**
   * Delete database connection
   */
  async delete(id: number): Promise<void> {
    await db.transaction(
      "rw",
      [
        db.databaseInfo,
        db.conversations,
        db.messages,
        db.queryResults,
        db.schemaInfo,
      ],
      async () => {
        // Delete related data
        const conversations = await db.conversations
          .where("databaseId")
          .equals(id)
          .toArray();
        const conversationIds = conversations.map((c) => c.id!);

        if (conversationIds.length > 0) {
          await db.messages
            .where("conversationId")
            .anyOf(conversationIds)
            .delete();
          await db.queryResults
            .where("conversationId")
            .anyOf(conversationIds)
            .delete();
        }

        await db.conversations.where("databaseId").equals(id).delete();
        await db.schemaInfo.where("databaseId").equals(id).delete();
        await db.databaseInfo.delete(id);
      }
    );
  },
};

// ==================== CONVERSATION SERVICES ====================

/**
 * Conversation management services
 */
export const ConversationService = {
  /**
   * Create a new conversation
   */
  async create(
    databaseId: number,
    title: string = "New Conversation"
  ): Promise<number> {
    const id = await db.conversations.add({
      title,
      databaseId,
      messageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return typeof id === "number" ? id : Number(id);
  },

  /**
   * Get all conversations for a database
   */
  async getByDatabase(databaseId: number): Promise<Conversation[]> {
    return await db.conversations
      .where("databaseId")
      .equals(databaseId)
      .reverse()
      .sortBy("updatedAt");
  },

  /**
   * Get conversation by ID
   */
  async getById(id: number): Promise<Conversation | undefined> {
    return await db.conversations.get(id);
  },

  /**
   * Update conversation
   */
  async update(id: number, changes: Partial<Conversation>): Promise<number> {
    return await db.conversations.update(id, changes);
  },

  /**
   * Update conversation title
   */
  async updateTitle(id: number, title: string): Promise<number> {
    return await db.conversations.update(id, { title });
  },

  /**
   * Increment message count
   */
  async incrementMessageCount(id: number): Promise<void> {
    const conversation = await db.conversations.get(id);
    if (conversation) {
      await db.conversations.update(id, {
        messageCount: conversation.messageCount + 1,
        updatedAt: new Date(),
      });
    }
  },

  /**
   * Delete conversation and all related data
   */
  async delete(id: number): Promise<void> {
    await db.transaction(
      "rw",
      [db.conversations, db.messages, db.queryResults],
      async () => {
        await db.messages.where("conversationId").equals(id).delete();
        await db.queryResults.where("conversationId").equals(id).delete();
        await db.conversations.delete(id);
      }
    );
  },
};

// ==================== MESSAGE SERVICES ====================

/**
 * Message management services
 */
export const MessageService = {
  /**
   * Add a new message
   */
  async add(message: Omit<Message, "id" | "createdAt">): Promise<number> {
    const messageId = await db.messages.add(message as Message);
    const id = typeof messageId === "number" ? messageId : Number(messageId);

    // Update conversation message count and last message
    await ConversationService.incrementMessageCount(message.conversationId);
    await ConversationService.update(message.conversationId, {
      lastMessage: message.content.substring(0, 100),
      updatedAt: new Date(),
    });

    return id;
  },

  /**
   * Get all messages for a conversation
   */
  async getByConversation(conversationId: number): Promise<Message[]> {
    return await db.messages
      .where("conversationId")
      .equals(conversationId)
      .sortBy("createdAt");
  },

  /**
   * Get message by ID
   */
  async getById(id: number): Promise<Message | undefined> {
    return await db.messages.get(id);
  },

  /**
   * Update message
   */
  async update(id: number, changes: Partial<Message>): Promise<number> {
    return await db.messages.update(id, changes);
  },

  /**
   * Delete message
   */
  async delete(id: number): Promise<void> {
    await db.messages.delete(id);
  },

  /**
   * Get recent messages across all conversations
   */
  async getRecent(limit: number = 50): Promise<Message[]> {
    return await db.messages
      .orderBy("createdAt")
      .reverse()
      .limit(limit)
      .toArray();
  },
};

// ==================== QUERY RESULT SERVICES ====================

/**
 * Query result management services
 */
export const QueryResultService = {
  /**
   * Save query result
   */
  async save(result: Omit<QueryResult, "id" | "createdAt">): Promise<number> {
    const id = await db.queryResults.add(result as QueryResult);
    return typeof id === "number" ? id : Number(id);
  },

  /**
   * Get results for a conversation
   */
  async getByConversation(conversationId: number): Promise<QueryResult[]> {
    return await db.queryResults
      .where("conversationId")
      .equals(conversationId)
      .reverse()
      .sortBy("createdAt");
  },

  /**
   * Get result by message ID
   */
  async getByMessageId(messageId: number): Promise<QueryResult | undefined> {
    return await db.queryResults.where("messageId").equals(messageId).first();
  },

  /**
   * Get result by ID
   */
  async getById(id: number): Promise<QueryResult | undefined> {
    return await db.queryResults.get(id);
  },

  /**
   * Get recent successful queries
   */
  async getRecentSuccessful(limit: number = 20): Promise<QueryResult[]> {
    const results = await db.queryResults
      .where("status")
      .equals("success")
      .reverse()
      .sortBy("createdAt");
    return results.slice(0, limit);
  },

  /**
   * Delete query result
   */
  async delete(id: number): Promise<void> {
    await db.queryResults.delete(id);
  },
};

// ==================== SCHEMA INFO SERVICES ====================

/**
 * Database schema management services
 */
export const SchemaService = {
  /**
   * Save schema information for a database
   */
  async save(
    schema: Omit<SchemaInfo, "id" | "createdAt" | "updatedAt">
  ): Promise<number> {
    // Check if schema already exists for this database
    const existing = await db.schemaInfo
      .where("databaseId")
      .equals(schema.databaseId)
      .first();

    if (existing) {
      await db.schemaInfo.update(existing.id!, schema);
      return existing.id!;
    } else {
      const id = await db.schemaInfo.add(schema as SchemaInfo);
      return typeof id === "number" ? id : Number(id);
    }
  },

  /**
   * Get schema for a database
   */
  async getByDatabase(databaseId: number): Promise<SchemaInfo | undefined> {
    return await db.schemaInfo.where("databaseId").equals(databaseId).first();
  },

  /**
   * Clear schema for a database
   */
  async clearForDatabase(databaseId: number): Promise<void> {
    await db.schemaInfo.where("databaseId").equals(databaseId).delete();
  },
};

// ==================== USER SETTINGS SERVICES ====================

/**
 * User settings management services
 */
export const SettingsService = {
  /**
   * Get user settings
   */
  async get(): Promise<UserSettings | undefined> {
    return await db.userSettings.orderBy("id").first();
  },

  /**
   * Update user settings
   */
  async update(settings: Partial<UserSettings>): Promise<void> {
    const existing = await this.get();
    if (existing) {
      await db.userSettings.update(existing.id!, settings);
    } else {
      await db.userSettings.add(settings as UserSettings);
    }
  },

  /**
   * Reset to default settings
   */
  async reset(): Promise<void> {
    await db.userSettings.clear();
    await db.userSettings.add({
      theme: "system",
      language: "vi",
      autoSaveConversations: true,
      maxConversationHistory: 100,
      aiModel: "gpt-4",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  },
};

// ==================== UTILITY SERVICES ====================

/**
 * Utility functions for database management
 */
export const UtilityService = {
  /**
   * Get database statistics
   */
  async getStats() {
    return await db.getStats();
  },

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    await db.clearAllData();
  },

  /**
   * Export data for backup
   */
  async exportData() {
    const [
      databases,
      conversations,
      messages,
      queryResults,
      schemas,
      settings,
    ] = await Promise.all([
      db.databaseInfo.toArray(),
      db.conversations.toArray(),
      db.messages.toArray(),
      db.queryResults.toArray(),
      db.schemaInfo.toArray(),
      db.userSettings.toArray(),
    ]);

    return {
      version: 1,
      exportDate: new Date().toISOString(),
      data: {
        databases,
        conversations,
        messages,
        queryResults,
        schemas,
        settings,
      },
    };
  },

  /**
   * Import data from backup
   */
  async importData(backupData: any): Promise<void> {
    if (!backupData.data) {
      throw new Error("Invalid backup data format");
    }

    await db.transaction("rw", db.tables, async () => {
      // Clear existing data
      await db.clearAllData();

      // Import data
      const { data } = backupData;
      if (data.databases?.length) await db.databaseInfo.bulkAdd(data.databases);
      if (data.conversations?.length)
        await db.conversations.bulkAdd(data.conversations);
      if (data.messages?.length) await db.messages.bulkAdd(data.messages);
      if (data.queryResults?.length)
        await db.queryResults.bulkAdd(data.queryResults);
      if (data.schemas?.length) await db.schemaInfo.bulkAdd(data.schemas);
      if (data.settings?.length) await db.userSettings.bulkAdd(data.settings);
    });
  },
};
