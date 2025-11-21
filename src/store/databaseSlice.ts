import { type StateCreator } from "zustand";
import { ConversationService, MessageService, QueryResultService } from "../db";
import {
  conversationArrayToLegacy,
  messageArrayToLegacy,
  queryResultArrayToLegacy,
  type LegacyConversation,
  type LegacyDatabase,
  type LegacyMessage,
  type LegacyQueryResult,
} from "../db/adapters";
import {
  DatabaseApiService,
  type DatabaseInfo,
} from "../services/databaseApiService";

export interface DatabaseSlice {
  // State
  databases: LegacyDatabase[];
  selectedDatabase: LegacyDatabase | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadDatabases: () => Promise<void>;
  selectDatabase: (database: LegacyDatabase) => Promise<{
    conversations: LegacyConversation[];
    messages: LegacyMessage[];
    queryResults: LegacyQueryResult[];
    activeConversationId: string;
  }>;
  addDatabase: (database: LegacyDatabase) => Promise<number>;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Convert DatabaseInfo to LegacyDatabase
 */
const databaseInfoToLegacy = (db: DatabaseInfo): LegacyDatabase => ({
  id: db.id.toString(),
  name: db.name,
  type: db.type,
  host: db.host,
  port: db.port,
  database: db.database,
  username: db.username,
  password: db.password,
  connectionString: db.connectionString,
  ssl: db.ssl,
});

/**
 * Create database slice for Zustand store
 * Handles database selection, loading, and CRUD operations using API
 */
export const createDatabaseSlice: StateCreator<
  DatabaseSlice,
  [],
  [],
  DatabaseSlice
> = (set, get) => ({
  // Initial state
  databases: [],
  selectedDatabase: null,
  isLoading: false,
  error: null,

  /**
   * Load databases from API and select active one
   */
  loadDatabases: async () => {
    set({ isLoading: true, error: null });

    try {
      // Load databases from API
      const dbList = await DatabaseApiService.getAllDatabases();
      const legacyDatabases = dbList.map(databaseInfoToLegacy);

      // Find active databases
      const activeDatabases = dbList.filter((db) => db.isActive);
      let selectedDb = null;

      if (activeDatabases.length === 1) {
        // Single active database - select it
        selectedDb = databaseInfoToLegacy(activeDatabases[0]);
      } else if (activeDatabases.length >= 2) {
        // Multiple active databases - select first one
        selectedDb = databaseInfoToLegacy(activeDatabases[0]);
      } else if (dbList.length > 0) {
        // No active database - select first available
        selectedDb = databaseInfoToLegacy(dbList[0]);
      }

      set({
        databases: legacyDatabases,
        selectedDatabase: selectedDb,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to load databases:", error);
      set({
        error: "Failed to load databases",
        isLoading: false,
      });
    }
  },

  /**
   * Select a database and load its related data
   */
  selectDatabase: async (database: LegacyDatabase) => {
    set({ isLoading: true, error: null });

    try {
      const dbId = parseInt(database.id);

      // Activate the selected database via API
      await DatabaseApiService.activateDatabase(dbId);

      set({ selectedDatabase: database });

      // Load conversations for selected database (from IndexedDB)
      const convList = await ConversationService.getByDatabase(dbId);
      const conversations = conversationArrayToLegacy(convList);

      let messages: LegacyMessage[] = [];
      let queryResults: LegacyQueryResult[] = [];
      let activeConversationId = "";

      if (convList.length > 0) {
        activeConversationId = convList[0].id!.toString();
        const msgList = await MessageService.getByConversation(convList[0].id!);
        messages = messageArrayToLegacy(msgList);
        const results = await QueryResultService.getByConversation(
          convList[0].id!
        );
        queryResults = queryResultArrayToLegacy(results);
      }

      set({ isLoading: false });

      return {
        conversations,
        messages,
        queryResults,
        activeConversationId,
      };
    } catch (error) {
      console.error("Failed to select database:", error);
      set({
        error: "Failed to select database",
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Add a new database via API
   */
  addDatabase: async (database: LegacyDatabase): Promise<number> => {
    set({ isLoading: true, error: null });

    try {
      // Convert legacy to API format
      const dbData = {
        name: database.name,
        type: database.type || ("postgresql" as const),
        host: database.host,
        port: database.port,
        database: database.database,
        username: database.username,
        password: database.password,
        connectionString: database.connectionString,
        ssl: database.ssl,
        isActive: true,
      };

      const newDb = await DatabaseApiService.createDatabase(dbData);
      const legacyDb = databaseInfoToLegacy(newDb);
      const { databases } = get();

      set({
        databases: [...databases, legacyDb],
        selectedDatabase: legacyDb,
        isLoading: false,
      });

      return newDb.id;
    } catch (error) {
      console.error("Failed to add database:", error);
      set({
        error: "Failed to add database",
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Set error state
   */
  setError: (error: string | null) => {
    set({ error });
  },

  /**
   * Set loading state
   */
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
});
