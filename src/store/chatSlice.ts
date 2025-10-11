/**
 * Simplified chat slice for managing selected conversation ID only
 * Other components handle their own data fetching using useLiveQuery
 */

import { type StateCreator } from 'zustand';

export interface ChatSlice {
  // State - only manage selected conversation ID
  selectedConversationId: string | null;

  // Actions
  setSelectedConversationId: (conversationId: string | null) => void;
}

export const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (set) => ({
  // Initial state
  selectedConversationId: null,

  // Actions
  setSelectedConversationId: (conversationId: string | null) => {
    set({ selectedConversationId: conversationId });
  },
});