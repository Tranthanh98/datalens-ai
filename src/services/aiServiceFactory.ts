/**
 * Simple AI Service Factory
 * Provides unified interface to switch between OpenAI and Gemini services
 */

import type { ConversationContext } from "../utils/aiPrompt";
import type { QueryPlan } from "./openAiService";

// Service configuration types
export type AIProvider = "openai" | "gemini";

// Service configuration interface
export interface AIServiceConfig {
  provider: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retryAttempts?: number;
}

// Service performance metrics
export interface AIServiceMetrics {
  averageResponseTime: number;
  successRate: number;
  errorCount: number;
  queryCount: number;
  lastUsed: Date;
}

// Query analysis result type
interface QueryAnalysis {
  complexity: number;
  isBusinessCritical: boolean;
  hasContext: boolean;
  wordCount: number;
  hasMultipleQuestions: boolean;
}

// Database execution result type
export interface DatabaseExecutionResult {
  data: Record<string, unknown>[];
  rowCount?: number;
  executionTime?: number;
  error?: string;
}

// Unified query function type
export type AIQueryFunction = (
  question: string,
  databaseId: number,
  databaseType: string,
  executeSQL: (sql: string) => Promise<DatabaseExecutionResult>,
  conversationHistory?: ConversationContext[]
) => Promise<{ answer: string; plan: QueryPlan }>;

/**
 * AI Service Factory - provides unified interface for different AI providers
 */
export class AIServiceFactory {
  private static metrics: Map<string, AIServiceMetrics> = new Map();

  /**
   * Get the appropriate AI service based on configuration
   */
  static async getAIService(config?: AIServiceConfig): Promise<{
    query: AIQueryFunction;
    provider: string;
    config: AIServiceConfig;
  }> {
    const finalConfig = this.resolveConfig(config);

    switch (finalConfig.provider) {
      case "openai": {
        const { runOpenAIQuery } = await import("./openAiService");
        return {
          query: runOpenAIQuery,
          provider: "OpenAI",
          config: finalConfig,
        };
      }

      case "gemini":
      default: {
        const { runAIQuery } = await import("./aiService2");
        return {
          query: runAIQuery,
          provider: "Gemini",
          config: finalConfig,
        };
      }
    }
  }

  /**
   * Resolve configuration from environment and user preferences
   */
  private static resolveConfig(userConfig?: AIServiceConfig): AIServiceConfig {
    const envProvider = (import.meta.env.VITE_AI_SERVICE || "gemini") as
      | "openai"
      | "gemini";

    return {
      provider: userConfig?.provider || envProvider,
      model:
        userConfig?.model ||
        this.getDefaultModel(userConfig?.provider || envProvider),
      temperature: userConfig?.temperature || 0.1,
      maxTokens: userConfig?.maxTokens || 4000,
      timeout: userConfig?.timeout || 30000,
      retryAttempts: userConfig?.retryAttempts || 3,
      ...userConfig,
    };
  }

  /**
   * Get default model for each provider
   */
  private static getDefaultModel(provider: "openai" | "gemini"): string {
    switch (provider) {
      case "openai":
        return "gpt-4o";
      case "gemini":
        return "gemini-2.5-flash";
    }
  }

  /**
   * Execute query with automatic service selection and metrics tracking
   */
  static async executeQuery(
    question: string,
    databaseId: number,
    databaseType: string,
    executeSQL: (sql: string) => Promise<DatabaseExecutionResult>,
    conversationHistory?: ConversationContext[],
    config?: AIServiceConfig
  ): Promise<{
    answer: string;
    plan: QueryPlan;
    metadata: { provider: string; duration: number };
  }> {
    const startTime = Date.now();
    const service = await this.getAIService(config);

    try {
      const result = await service.query(
        question,
        databaseId,
        databaseType,
        executeSQL,
        conversationHistory
      );

      const duration = Date.now() - startTime;
      this.updateMetrics(service.provider, duration, true);

      return {
        ...result,
        metadata: {
          provider: service.provider,
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(service.provider, duration, false);
      throw error;
    }
  }

  /**
   * Execute query with intelligent service selection based on query characteristics
   */
  static async executeSmartQuery(
    question: string,
    databaseId: number,
    databaseType: string,
    executeSQL: (sql: string) => Promise<DatabaseExecutionResult>,
    conversationHistory?: ConversationContext[]
  ): Promise<{
    answer: string;
    plan: QueryPlan;
    metadata: { provider: string; duration: number; reasoning: string };
  }> {
    const analysis = this.analyzeQuery(question, conversationHistory);
    const selectedService = this.selectOptimalService(analysis);

    const result = await this.executeQuery(
      question,
      databaseId,
      databaseType,
      executeSQL,
      conversationHistory,
      { provider: selectedService.provider }
    );

    return {
      ...result,
      metadata: {
        ...result.metadata,
        reasoning: selectedService.reasoning,
      },
    };
  }

  /**
   * Analyze query to determine optimal service
   */
  private static analyzeQuery(
    question: string,
    conversationHistory?: ConversationContext[]
  ): QueryAnalysis {
    const complexity = this.calculateComplexity(question);
    const isBusinessCritical = this.isBusinessCritical(question);
    const hasContext = (conversationHistory?.length || 0) > 0;

    return {
      complexity,
      isBusinessCritical,
      hasContext,
      wordCount: question.split(" ").length,
      hasMultipleQuestions:
        question.includes("?") && question.split("?").length > 2,
    };
  }

  /**
   * Calculate query complexity score (0-1)
   */
  private static calculateComplexity(question: string): number {
    let complexity = 0;

    // Keywords that increase complexity
    const complexKeywords = [
      "join",
      "aggregate",
      "group by",
      "having",
      "subquery",
      "nested",
      "union",
      "intersect",
      "except",
      "window function",
      "recursive",
      "correlation",
      "pivot",
      "unpivot",
      "case when",
      "exists",
    ];

    complexKeywords.forEach((keyword) => {
      if (question.toLowerCase().includes(keyword)) {
        complexity += 0.15;
      }
    });

    // Length factor
    if (question.length > 200) complexity += 0.2;
    if (question.length > 500) complexity += 0.3;

    // Multiple conditions
    const conditionWords = ["and", "or", "where", "when", "if"];
    const conditionCount = conditionWords.reduce((count, word) => {
      return (
        count +
        (question.toLowerCase().match(new RegExp(word, "g"))?.length || 0)
      );
    }, 0);

    complexity += Math.min(conditionCount * 0.1, 0.3);

    return Math.min(complexity, 1);
  }

  /**
   * Determine if query is business critical
   */
  private static isBusinessCritical(question: string): boolean {
    const criticalKeywords = [
      "revenue",
      "profit",
      "loss",
      "financial",
      "budget",
      "forecast",
      "compliance",
      "audit",
      "security",
      "customer",
      "client",
      "performance",
      "kpi",
      "metric",
      "dashboard",
      "report",
    ];

    return criticalKeywords.some((keyword) =>
      question.toLowerCase().includes(keyword)
    );
  }

  /**
   * Select optimal service based on query analysis
   */
  private static selectOptimalService(analysis: QueryAnalysis): {
    provider: "openai" | "gemini";
    reasoning: string;
  } {
    // High complexity or business critical -> OpenAI
    if (analysis.complexity > 0.7 || analysis.isBusinessCritical) {
      return {
        provider: "openai",
        reasoning: `Selected OpenAI for ${
          analysis.isBusinessCritical ? "business-critical" : "high-complexity"
        } query`,
      };
    }

    // Multiple questions or complex context -> OpenAI
    if (
      analysis.hasMultipleQuestions ||
      (analysis.hasContext && analysis.complexity > 0.4)
    ) {
      return {
        provider: "openai",
        reasoning: "Selected OpenAI for multi-part query with context",
      };
    }

    // Default to Gemini for speed and cost
    return {
      provider: "gemini",
      reasoning: "Selected Gemini for fast, cost-effective processing",
    };
  }

  /**
   * Update service metrics
   */
  private static updateMetrics(
    provider: string,
    duration: number,
    success: boolean
  ) {
    const key = provider.toLowerCase();
    const current = this.metrics.get(key) || {
      averageResponseTime: 0,
      successRate: 0,
      errorCount: 0,
      queryCount: 0,
      lastUsed: new Date(),
    };

    current.queryCount++;
    current.averageResponseTime =
      (current.averageResponseTime * (current.queryCount - 1) + duration) /
      current.queryCount;

    if (!success) {
      current.errorCount++;
    }

    current.successRate =
      ((current.queryCount - current.errorCount) / current.queryCount) * 100;
    current.lastUsed = new Date();

    this.metrics.set(key, current);
  }

  /**
   * Get performance metrics for all services
   */
  static getMetrics(): Map<string, AIServiceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Reset metrics (useful for testing)
   */
  static resetMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Get service health status
   */
  static async getServiceHealth(): Promise<{
    openai: { available: boolean; error?: string };
    gemini: { available: boolean; error?: string };
  }> {
    const health = {
      openai: { available: false, error: undefined as string | undefined },
      gemini: { available: false, error: undefined as string | undefined },
    };

    // Check OpenAI
    try {
      const hasOpenAIKey = !!import.meta.env.VITE_OPENAI_API_KEY;
      health.openai.available = hasOpenAIKey;
      if (!hasOpenAIKey) {
        health.openai.error = "API key not configured";
      }
    } catch (error) {
      health.openai.error =
        error instanceof Error ? error.message : "Service unavailable";
    }

    // Check Gemini
    try {
      const hasGeminiKey = !!import.meta.env.VITE_GEMINI_API_KEY;
      health.gemini.available = hasGeminiKey;
      if (!hasGeminiKey) {
        health.gemini.error = "API key not configured";
      }
    } catch (error) {
      health.gemini.error =
        error instanceof Error ? error.message : "Service unavailable";
    }

    return health;
  }
}

/**
 * Simple wrapper for easy usage
 */
export async function runSmartAIQuery(
  question: string,
  databaseId: number,
  databaseType: string,
  executeSQL: (sql: string) => Promise<DatabaseExecutionResult>,
  conversationHistory?: ConversationContext[]
): Promise<{
  answer: string;
  plan: QueryPlan;
  metadata: { provider: string; duration: number; reasoning: string };
}> {
  return AIServiceFactory.executeSmartQuery(
    question,
    databaseId,
    databaseType,
    executeSQL,
    conversationHistory
  );
}

/**
 * Configuration-based query execution
 */
export async function runConfiguredAIQuery(
  question: string,
  databaseId: number,
  databaseType: string,
  executeSQL: (sql: string) => Promise<DatabaseExecutionResult>,
  config: AIServiceConfig,
  conversationHistory?: ConversationContext[]
): Promise<{
  answer: string;
  plan: QueryPlan;
  metadata: { provider: string; duration: number };
}> {
  return AIServiceFactory.executeQuery(
    question,
    databaseId,
    databaseType,
    executeSQL,
    conversationHistory,
    config
  );
}

export default AIServiceFactory;
