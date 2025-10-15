import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createChatSlice, type ChatSlice } from "./chatSlice";
import { createDatabaseSlice, type DatabaseSlice } from "./databaseSlice";

// Combined store interface
export interface AppStore extends DatabaseSlice, ChatSlice {}

// Create the combined store
export const useAppStore = create<AppStore>()(
  devtools(
    (...a) => ({
      ...createDatabaseSlice(...a),
      ...createChatSlice(...a),
    }),
    {
      name: "datalens-store",
    }
  )
);

// Convenience hooks for specific slices with proper selectors
export const useDatabaseStore = () => {
  const databases = useAppStore((state) => state.databases);
  const selectedDatabase = useAppStore((state) => state.selectedDatabase);
  const isLoading = useAppStore((state) => state.isLoading);
  const error = useAppStore((state) => state.error);
  const initializeDatabases = useAppStore((state) => state.initializeDatabases);
  const addDatabase = useAppStore((state) => state.addDatabase);
  const selectDatabase = useAppStore((state) => state.selectDatabase);
  const setError = useAppStore((state) => state.setError);
  const setLoading = useAppStore((state) => state.setLoading);

  return {
    databases,
    selectedDatabase,
    isLoading,
    error,
    initializeDatabases,
    addDatabase,
    selectDatabase,
    setError,
    setLoading,
  };
};

export const useChatStore = () => {
  const selectedConversationId = useAppStore(
    (state) => state.selectedConversationId
  );
  const setSelectedConversationId = useAppStore(
    (state) => state.setSelectedConversationId
  );
  const selectedMessageId = useAppStore((state) => state.selectedMessageId);
  const setSelectedMessageId = useAppStore(
    (state) => state.setSelectedMessageId
  );

  return {
    selectedConversationId,
    setSelectedConversationId,
    selectedMessageId,
    setSelectedMessageId,
  };
};
