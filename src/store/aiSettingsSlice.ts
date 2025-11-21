import type { StateCreator } from "zustand";
import type { AIProvider } from "../services/simpleAiServiceFactory";

// AI settings state interface
export interface AISettingsSlice {
  selectedProvider: AIProvider;
  setSelectedProvider: (provider: AIProvider) => void;
}

// Create AI settings slice
export const createAISettingsSlice: StateCreator<
  AISettingsSlice,
  [],
  [],
  AISettingsSlice
> = (set) => ({
  // Default to LM Studio (local)
  selectedProvider: "lmstudio",

  setSelectedProvider: (provider: AIProvider) => {
    set({ selectedProvider: provider });
  },
});
