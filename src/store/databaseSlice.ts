import { type StateCreator } from "zustand";
import {
  ConversationService,
  DatabaseService,
  MessageService,
  QueryResultService,
} from "../db";
import {
  conversationArrayToLegacy,
  databaseArrayToLegacy,
  databaseInfoToLegacy,
  legacyToDatabase,
  messageArrayToLegacy,
  queryResultArrayToLegacy,
  type LegacyConversation,
  type LegacyDatabase,
  type LegacyMessage,
  type LegacyQueryResult,
} from "../db/adapters";

export interface DatabaseSlice {
  // State
  databases: LegacyDatabase[];
  selectedDatabase: LegacyDatabase | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initializeDatabases: () => Promise<void>;
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
 * Create database slice for Zustand store
 * Handles database selection, loading, and CRUD operations
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
   * Initialize databases from IndexedDB on app startup
   */
  initializeDatabases: async () => {
    set({ isLoading: true, error: null });

    try {
      // Load databases
      const dbList = await DatabaseService.getAll();
      const legacyDatabases = databaseArrayToLegacy(dbList);

      // Set active database if available
      const activeDb = await DatabaseService.getActive();
      let selectedDb = null;

      if (activeDb) {
        selectedDb = databaseInfoToLegacy(activeDb);
      } else if (dbList.length > 0) {
        // If no active database, use first available
        selectedDb = databaseInfoToLegacy(dbList[0]);
      }

      set({
        databases: legacyDatabases,
        selectedDatabase: selectedDb,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to initialize databases:", error);
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
      const { selectedDatabase } = get();

      // Update active database
      if (selectedDatabase) {
        await DatabaseService.update(parseInt(selectedDatabase.id), {
          isActive: false,
        });
      }
      await DatabaseService.update(dbId, { isActive: true });

      set({ selectedDatabase: database });

      // Load conversations for selected database
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
   * Add a new database
   */
  addDatabase: async (database: LegacyDatabase): Promise<number> => {
    set({ isLoading: true, error: null });

    try {
      const dbData = legacyToDatabase(database);
      const dbId = await DatabaseService.add({
        ...dbData,
        isActive: true,
      });

      const newDb = await DatabaseService.getById(dbId);
      if (newDb) {
        const legacyDb = databaseInfoToLegacy(newDb);
        const { databases } = get();

        set({
          databases: [...databases, legacyDb],
          selectedDatabase: legacyDb,
          isLoading: false,
        });
      }
      return dbId;
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
