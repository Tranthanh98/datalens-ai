/**
 * Simple AI Service Factory
 * Provides unified interface to switch between OpenAI and Gemini services
 */

import type { ConversationContext } from "../utils/aiPrompt";
import type { QueryPlan as GeminiQueryPlan } from "./aiService2";
import type { QueryPlan as OpenAIQueryPlan } from "./openAiService";

// Service provider types
export type AIProvider = "openai" | "gemini" | "lmstudio";

// Unified QueryPlan type
export type QueryPlan = GeminiQueryPlan | OpenAIQueryPlan;

// Database execution result type
export interface DatabaseExecutionResult {
  data: Record<string, unknown>[];
  rowCount?: number;
  executionTime?: number;
  error?: string;
}

/**
 * Simple AI Service Factory
 */
export class SimpleAIServiceFactory {
  /**
   * Execute query with specified provider
   */
  static async executeQuery(
    provider: AIProvider,
    question: string,
    databaseId: number,
    databaseType: string,
    executeSQL: (sql: string) => Promise<DatabaseExecutionResult>,
    conversationHistory?: ConversationContext[]
  ): Promise<{ answer: string; plan: QueryPlan }> {
    switch (provider) {
      case "openai": {
        const { runOpenAIQuery } = await import("./openAiService");
        return runOpenAIQuery(
          question,
          databaseId,
          databaseType,
          executeSQL,
          conversationHistory
        );
      }

      case "gemini": {
        const { runAIQuery } = await import("./aiService2");
        return runAIQuery(
          question,
          databaseId,
          databaseType,
          executeSQL,
          conversationHistory
        );
      }

      case "lmstudio": {
        const { runLMStudioQuery } = await import("./lmStudioService");
        return runLMStudioQuery(
          question,
          databaseId,
          databaseType,
          executeSQL,
          conversationHistory
        );
      }

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * Get available providers
   */
  static getAvailableProviders(): { value: AIProvider; label: string }[] {
    return [
      { value: "lmstudio", label: "LM Studio (Local)" },
      { value: "gemini", label: "Google Gemini" },
      { value: "openai", label: "OpenAI GPT-4o" },
    ];
  }

  /**
   * Check if provider is available (has API key)
   */
  static isProviderAvailable(provider: AIProvider): boolean {
    switch (provider) {
      case "openai":
        return !!import.meta.env.VITE_OPENAI_API_KEY;
      case "gemini":
        return !!import.meta.env.VITE_GEMINI_API_KEY;
      case "lmstudio":
        // LM Studio is always available if running locally
        // Could add a health check here if needed
        return true;
      default:
        return false;
    }
  }
}

export default SimpleAIServiceFactory;
