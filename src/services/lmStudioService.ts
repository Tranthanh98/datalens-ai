/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LM Studio Service for local AI models
 * Uses LM Studio's OpenAI-compatible API running locally
 * 
 * This service connects to a local instance of qwen-vl-4b running via LM Studio
 * on http://127.0.0.1:1234
 */

import OpenAI from "openai";
import { buildPlanPrompt, type ConversationContext } from "../utils/aiPrompt";
import type { QueryPlanStep as EventQueryPlanStep } from "../utils/queryPlanEvents";
import { queryPlanEvents } from "../utils/queryPlanEvents";
import { searchSimilarTables } from "./schemaSearchService";

// LM Studio Configuration
const LM_STUDIO_BASE_URL = "http://127.0.0.1:1234/v1";
const LM_STUDIO_MODEL = "qwen/qwen3-4b-2507"; // The model name running in LM Studio

// Initialize OpenAI client pointing to LM Studio
const lmStudioClient = new OpenAI({
  baseURL: LM_STUDIO_BASE_URL,
  apiKey: "lm-studio", // LM Studio doesn't require a real API key, but the client needs something
  dangerouslyAllowBrowser: true,
});

console.log("LM Studio client initialized for:", LM_STUDIO_BASE_URL);

// AI model interface
interface AIModel {
  generateContent(options: {
    model: string;
    contents: string;
    responseFormat?: any;
  }): Promise<{ text: string }>;
}

// LM Studio model wrapper (OpenAI-compatible)
const model: AIModel = {
  async generateContent(options: {
    model: string;
    contents: string;
    responseFormat?: any;
  }) {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "user",
          content: options.contents,
        },
      ];

      const completionOptions: OpenAI.Chat.ChatCompletionCreateParams = {
        model: LM_STUDIO_MODEL, // Use the local model name
        messages,
        temperature: 0.1,
        max_tokens: 32000,
      };

      // Add response format if provided (for structured JSON responses)
      if (options.responseFormat) {
        completionOptions.response_format = { type: "json_object" };
        // Add JSON instruction to system message
        messages.unshift({
          role: "system",
          content:
            "You are a helpful assistant designed to output JSON. Always respond with valid JSON format.",
        });
      }

      const response = await lmStudioClient.chat.completions.create(completionOptions);

      return {
        text: response.choices[0]?.message?.content || "",
      };
    } catch (error) {
      console.error("LM Studio error:", error);
      throw error;
    }
  },
};

/**
 * Types for AI query planning and execution
 */
export interface QueryStep {
  id: string;
  type: "query" | "analysis" | "aggregation" | "removed";
  description: string;
  sql?: string;
  result?: any;
  error?: string;
  dependencies?: string[];
  executionTime?: number;
  rowCount?: number;
  reasoning?: string;
  isRemoved?: boolean;
}

export interface ChartData {
  type: "bar" | "pie" | "line" | "none";
  data: Array<{ name: string; value: number; [key: string]: any }>;
  xAxisKey?: string;
  yAxisKey?: string;
  description?: string;
}

export interface QueryPlan {
  id: string;
  question: string;
  intent: string;
  steps: QueryStep[];
  context: Array<{ step: QueryStep; result: any; timestamp?: number }>;
  conversationHistory?: ConversationContext[];
  finalAnswer?: string;
  finalSQL?: string;
  chartData?: ChartData;
  databaseType: string;
  totalExecutionTime?: number;
  successfulSteps?: number;
  failedSteps?: number;
}

/**
 * LM Studio AI Service class (reuses OpenAI service logic)
 */
export class LMStudioService {
  /**
   * Generate initial query plan from user question
   */
  static async generatePlan(
    question: string,
    schema: any,
    databaseType: string = "postgresql",
    conversationHistory: ConversationContext[] = []
  ): Promise<QueryPlan> {
    try {
      const prompt = buildPlanPrompt(
        question,
        schema,
        databaseType,
        conversationHistory
      );

      const result = await model.generateContent({
        model: LM_STUDIO_MODEL,
        contents: prompt,
        responseFormat: true, // Enable JSON mode
      });

      // Parse structured JSON response
      const planData = JSON.parse(result.text || "{}");

      // Convert to QueryPlan object
      const plan: QueryPlan = {
        id: `plan_${Date.now()}`,
        question: planData.question,
        intent: planData.intent,
        databaseType: planData.databaseType,
        steps: planData.steps.map((step: any) => ({
          ...step,
          dependencies: step.dependsOn || [],
        })),
        context: [],
        conversationHistory,
        successfulSteps: 0,
        failedSteps: 0,
        totalExecutionTime: 0,
      };

      return plan;
    } catch (error) {
      console.error("Error generating AI plan with LM Studio:", error);
      throw new Error("Failed to generate query plan with LM Studio");
    }
  }

  /**
   * Refine query plan based on execution context and results
   */
  static async refinePlan(plan: QueryPlan, schema: any): Promise<QueryPlan> {
    try {
      if (plan.context.length === 0) {
        return plan;
      }

      const pendingSteps = plan.steps.filter(
        (step) => !step.result && !step.error
      );
      if (pendingSteps.length === 0) {
        return plan;
      }

      const prompt = this.buildRefinementPrompt(plan, schema);
      const result = await model.generateContent({
        model: LM_STUDIO_MODEL,
        contents: prompt,
        responseFormat: true,
      });

      const refinementData = JSON.parse(result.text || "{}");
      const refinedPlan = this.applyRefinements(plan, refinementData);

      return refinedPlan;
    } catch (error) {
      console.error("Error refining AI plan with LM Studio:", error);
      return plan;
    }
  }

  /**
   * Check if a step's dependencies are met
   */
  private static canExecuteStep(
    step: QueryStep,
    executedStepIds: Set<string>,
    allSteps?: QueryStep[]
  ): boolean {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true;
    }

    const validDependencies = step.dependencies.filter((depId) => {
      if (allSteps) {
        const depStep = allSteps.find((s) => s.id === depId);
        return depStep && depStep.type !== "removed" && !depStep.isRemoved;
      }
      return true;
    });

    return validDependencies.every((depId) => executedStepIds.has(depId));
  }

  /**
   * Execute multi-step AI query
   */
  static async runAIQuery(
    question: string,
    databaseId: number,
    databaseType: string,
    executeSQL: (sql: string) => Promise<any>,
    conversationHistory: ConversationContext[] = []
  ): Promise<{ answer: string; plan: QueryPlan }> {
    const startTime = Date.now();

    try {
      if (!databaseId) {
        throw new Error("Database ID is required");
      }

      // Search for similar tables using semantic search API
      const searchResult = await searchSimilarTables(databaseId, question, 20);

      console.log("LM Studio - Search result:", searchResult);

      if (!searchResult.success || !searchResult.data) {
        console.error(
          "Failed to retrieve relevant schema:",
          searchResult.error
        );
        throw new Error(
          `Failed to retrieve relevant schema: ${
            searchResult.error || "Unknown error"
          }`
        );
      }

      const schema = searchResult.data.map((item) => item.schema);

      console.log(
        `LM Studio - Found ${schema.length} relevant tables for question: "${question}"`
      );

      if (schema.length === 0) {
        throw new Error(
          "No relevant tables found for this query. Please ensure your database has schema embeddings generated."
        );
      }

      // Generate plan using LM Studio
      const plan = await this.generatePlan(
        question,
        schema,
        databaseType,
        conversationHistory
      );

      // Emit plan generated event
      const eventSteps: EventQueryPlanStep[] = plan.steps
        .filter((step) => step.type !== "removed")
        .map((step) => ({
          id: step.id,
          type: step.type as "query" | "analysis" | "aggregation",
          description: step.description,
          sql: step.sql,
          status: "pending" as const,
        }));

      queryPlanEvents.emit({
        type: "plan_generated",
        planId: plan.id,
        steps: eventSteps,
      });

      const executedStepIds = new Set<string>();
      const maxRetries = 3;

      // Execute steps in order, respecting dependencies
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];

        // Skip removed steps
        if (
          step.type === "removed" ||
          step.isRemoved ||
          !step.sql ||
          step.sql === "REMOVED"
        ) {
          console.log(
            `⏭️ Skipping removed step ${step.id}: ${step.description}`
          );
          executedStepIds.add(step.id);

          plan.context.push({
            step,
            result: {
              skipped: true,
              reason: "Step was removed during refinement",
            },
            timestamp: Date.now(),
          });

          continue;
        }

        // Check if dependencies are met
        if (!this.canExecuteStep(step, executedStepIds, plan.steps)) {
          const validDeps =
            step.dependencies?.filter((depId) => {
              const depStep = plan.steps.find((s) => s.id === depId);
              return (
                depStep && depStep.type !== "removed" && !depStep.isRemoved
              );
            }) || [];

          if (validDeps.length > 0) {
            console.warn(
              `Step ${
                step.id
              } dependencies not met, waiting for: ${validDeps.join(", ")}`
            );
            continue;
          }
        }

        if (
          (step.type === "query" ||
            step.type === "analysis" ||
            step.type === "aggregation") &&
          step.sql
        ) {
          let retryCount = 0;
          let stepSuccess = false;

          while (retryCount < maxRetries && !stepSuccess) {
            try {
              const stepStartTime = Date.now();

              // Emit step started event
              queryPlanEvents.emit({
                type: "step_started",
                planId: plan.id,
                step: {
                  id: step.id,
                  type: step.type,
                  description: step.description,
                  sql: step.sql,
                  status: "running",
                },
              });

              // Execute SQL query
              const result = await executeSQL(step.sql);
              const stepEndTime = Date.now();

              step.result = result;
              step.executionTime = stepEndTime - stepStartTime;
              step.rowCount = result?.data?.length || 0;

              plan.context.push({
                step,
                result,
                timestamp: Date.now(),
              });

              executedStepIds.add(step.id);
              plan.successfulSteps = (plan.successfulSteps || 0) + 1;
              stepSuccess = true;

              // Emit step completed event
              queryPlanEvents.emit({
                type: "step_completed",
                planId: plan.id,
                step: {
                  id: step.id,
                  type: step.type,
                  description: step.description,
                  sql: step.sql,
                  status: "completed",
                },
              });

              // Refine plan based on current results
              const shouldRefine =
                (i + 1) % 2 === 0 ||
                step.rowCount === 0 ||
                (step.rowCount && step.rowCount > 1000);

              if (
                shouldRefine &&
                plan.steps.indexOf(step) < plan.steps.length - 1
              ) {
                const refinedPlan = await this.refinePlan(plan, schema);
                Object.assign(plan, refinedPlan);
              }
            } catch (sqlError) {
              console.error(
                `SQL execution error for step ${step.id} (attempt ${
                  retryCount + 1
                }/${maxRetries}):`,
                sqlError
              );
              const errorMessage =
                sqlError instanceof Error ? sqlError.message : String(sqlError);

              // Try to refine SQL on error
              if (retryCount < maxRetries - 1) {
                try {
                  const errorContext = {
                    ...plan,
                    context: [
                      ...plan.context,
                      {
                        step: { ...step, error: errorMessage },
                        result: { error: errorMessage },
                        timestamp: Date.now(),
                      },
                    ],
                  };
                  const refinedPlan = await this.refinePlan(
                    errorContext,
                    schema
                  );

                  const modifiedStep = refinedPlan.steps.find(
                    (s) => s.id === step.id
                  );
                  if (modifiedStep?.sql && modifiedStep.sql !== step.sql) {
                    console.log(`Retrying step ${step.id} with refined SQL...`);
                    step.sql = modifiedStep.sql;
                    retryCount++;
                    continue;
                  }
                } catch (refinementError) {
                  console.error("Failed to refine SQL:", refinementError);
                }
              }

              // Record error
              step.error = errorMessage;
              step.result = { error: errorMessage };
              plan.context.push({
                step,
                result: step.result,
                timestamp: Date.now(),
              });
              plan.failedSteps = (plan.failedSteps || 0) + 1;

              // Emit step error event
              queryPlanEvents.emit({
                type: "step_error",
                planId: plan.id,
                step: {
                  id: step.id,
                  type: step.type,
                  description: step.description,
                  sql: step.sql,
                  status: "error",
                },
                error: errorMessage,
              });

              break;
            }
          }
        }
      }

      plan.totalExecutionTime = Date.now() - startTime;

      // Generate final answer
      const finalAnswer = await this.generateFinalAnswer(plan);
      plan.finalAnswer = finalAnswer;

      // Extract final SQL
      const lastExecutedStep = plan.steps
        .filter((step) => step.sql && step.result && !step.error)
        .pop();
      if (lastExecutedStep?.sql) {
        plan.finalSQL = lastExecutedStep.sql;
      }

      // Emit plan completed event
      queryPlanEvents.emit({
        type: "plan_completed",
        planId: plan.id,
      });

      return { answer: finalAnswer, plan };
    } catch (error) {
      console.error("Error running AI query with LM Studio:", error);
      throw error;
    }
  }

  /**
   * Apply refinements with step removal handling
   */
  private static applyRefinements(
    plan: QueryPlan,
    refinementData: any
  ): QueryPlan {
    if (!refinementData.shouldRefine) {
      return plan;
    }

    const refinedPlan = { ...plan };

    // Add new steps
    if (refinementData.newSteps && refinementData.newSteps.length > 0) {
      const existingIds = new Set(refinedPlan.steps.map((s) => s.id));
      const newSteps = refinementData.newSteps.filter(
        (step: QueryStep) => !existingIds.has(step.id)
      );

      if (newSteps.length > 0) {
        refinedPlan.steps = [...refinedPlan.steps, ...newSteps];
      }
    }

    // Modify existing steps
    if (
      refinementData.modifiedSteps &&
      refinementData.modifiedSteps.length > 0
    ) {
      const removedStepIds = new Set<string>();

      refinementData.modifiedSteps.forEach((modifiedStep: any) => {
        const index = refinedPlan.steps.findIndex(
          (step) => step.id === modifiedStep.id
        );

        if (index !== -1 && !refinedPlan.steps[index].result) {
          // Check if step is being removed
          if (
            modifiedStep.sql === "REMOVED" ||
            modifiedStep.sql === "" ||
            modifiedStep.description?.includes("removed") ||
            modifiedStep.description?.includes("REMOVED")
          ) {
            console.log(
              `🗑️ Removing step ${modifiedStep.id}: ${
                modifiedStep.reasoning || "No reason provided"
              }`
            );

            refinedPlan.steps[index] = {
              ...refinedPlan.steps[index],
              type: "removed" as any,
              sql: undefined,
              description: `REMOVED: ${
                modifiedStep.description || refinedPlan.steps[index].description
              }`,
              reasoning:
                modifiedStep.reasoning || "Step removed during refinement",
              error: "Step removed during plan refinement",
              isRemoved: true,
            };

            removedStepIds.add(modifiedStep.id);
          } else {
            // Regular modification
            refinedPlan.steps[index] = {
              ...refinedPlan.steps[index],
              ...modifiedStep,
              dependencies:
                modifiedStep.dependsOn || refinedPlan.steps[index].dependencies,
            };
          }
        }
      });

      // Update dependencies
      if (removedStepIds.size > 0) {
        refinedPlan.steps.forEach((step) => {
          if (step.dependencies && step.dependencies.length > 0) {
            const originalDeps = [...step.dependencies];
            step.dependencies = step.dependencies.filter(
              (depId) => !removedStepIds.has(depId)
            );
          }
        });
      }
    }

    return refinedPlan;
  }

  /**
   * Build prompt for plan refinement
   */
  private static buildRefinementPrompt(plan: QueryPlan, schema: any): string {
    const contextSummary = plan.context.map((ctx) => {
      const hasError = ctx.step.error || ctx.result?.error;
      return {
        stepId: ctx.step.id,
        type: ctx.step.type,
        description: ctx.step.description,
        status: hasError ? "failed" : "success",
        error: hasError ? ctx.step.error || ctx.result?.error : undefined,
        rowCount: ctx.step.rowCount || ctx.result?.data?.length || 0,
        executionTime: ctx.step.executionTime,
        hasData: ctx.result?.data && ctx.result.data.length > 0,
      };
    });

    const completedStepIds = new Set(plan.context.map((ctx) => ctx.step.id));
    const pendingSteps = plan.steps.filter(
      (step) => !completedStepIds.has(step.id)
    );

    const getDefaultSchema = (dbType: string): string => {
      switch (dbType.toLowerCase()) {
        case "mssql":
        case "sqlserver":
          return "dbo";
        case "postgresql":
        case "postgres":
          return "public";
        case "mysql":
          return "mysql";
        case "oracle":
          return "public";
        default:
          return "dbo";
      }
    };

    const defaultSchema = getDefaultSchema(plan.databaseType);

    return `
You are refining a multi-step query plan based on execution results.

DATABASE TYPE: ${plan.databaseType}

ORIGINAL QUESTION: "${plan.question}"
ORIGINAL INTENT: ${plan.intent}

EXECUTION SUMMARY:
- Total Steps: ${plan.steps.length}
- Completed: ${contextSummary.length}
- Pending: ${pendingSteps.length}
- Successful: ${contextSummary.filter((s) => s.status === "success").length}
- Failed: ${contextSummary.filter((s) => s.status === "failed").length}

COMPLETED STEPS ANALYSIS:
${JSON.stringify(contextSummary, null, 2)}

PENDING STEPS:
${JSON.stringify(
  pendingSteps.map((s) => ({
    id: s.id,
    type: s.type,
    description: s.description,
    sql: s.sql,
    dependsOn: s.dependencies,
  })),
  null,
  2
)}

Based on the execution results, analyze if the pending steps need modification or if new steps are needed.

Return JSON with:
{
  "shouldRefine": true/false,
  "reasoning": "Clear explanation",
  "newSteps": [],
  "modifiedSteps": []
}

Return only valid JSON matching the refinement schema.
    `.trim();
  }

  /**
   * Generate final answer with chart extraction
   */
  private static async generateFinalAnswer(plan: QueryPlan): Promise<string> {
    try {
      const executionSummary = {
        totalSteps: plan.steps.length,
        successfulSteps: plan.successfulSteps || 0,
        failedSteps: plan.failedSteps || 0,
        totalExecutionTime: plan.totalExecutionTime || 0,
        totalRows: plan.context.reduce(
          (sum, ctx) => sum + (ctx.step.rowCount || 0),
          0
        ),
      };

      const prompt = `
Generate a comprehensive answer to this database query.

ORIGINAL QUESTION: "${plan.question}"

EXECUTION RESULTS:
${plan.context
  .map(
    (ctx, idx) => `
Step ${idx + 1}: ${ctx.step.description}
SQL: ${ctx.step.sql}
Status: ${ctx.step.error ? "FAILED" : "SUCCESS"}
Result: ${JSON.stringify(ctx.result, null, 2).substring(0, 500)}
`
  )
  .join("\n---\n")}

Create a professional markdown answer with:
1. Clear heading
2. Executive summary
3. Key findings with data
4. Insights and analysis

Then include a chartdata block:
\`\`\`chartdata
{
  "type": "bar|pie|line|none",
  "data": [...],
  "xAxisKey": "...",
  "yAxisKey": "...",
  "description": "..."
}
\`\`\`
      `.trim();

      const result = await model.generateContent({
        model: LM_STUDIO_MODEL,
        contents: prompt,
      });

      const fullResponse =
        result.text ||
        "# Unable to Generate Answer\n\nI couldn't generate a comprehensive answer.";

      // Extract chart data
      const chartDataMatch = fullResponse.match(/```chartdata\n([\s\S]*?)```/);
      if (chartDataMatch) {
        try {
          const chartDataText = chartDataMatch[1].trim();
          const chartData = JSON.parse(chartDataText);

          if (
            chartData.type &&
            chartData.data &&
            Array.isArray(chartData.data)
          ) {
            plan.chartData = chartData;
            console.log("Chart data extracted successfully:", chartData.type);
          }
        } catch (e) {
          console.warn("Failed to parse chart data:", e);
        }
      }

      return fullResponse.replace(/```chartdata\n[\s\S]*?```/, "").trim();
    } catch (error) {
      console.error("Error generating final answer with LM Studio:", error);

      const successfulSteps = plan.context.filter((ctx) => !ctx.step.error);
      if (successfulSteps.length > 0) {
        return `# Query Results\n\n## Summary\nExecuted ${
          successfulSteps.length
        } successful query steps for: "${
          plan.question
        }"\n\n## Results\n${successfulSteps
          .map(
            (ctx, idx) =>
              `### Step ${idx + 1}: ${
                ctx.step.description
              }\n\`\`\`json\n${JSON.stringify(ctx.result, null, 2).substring(
                0,
                500
              )}\n\`\`\`\n`
          )
          .join("\n")}`;
      }

      return "# Error\n\nUnable to generate a comprehensive answer.";
    }
  }
}

/**
 * Main function to run AI-powered query using LM Studio
 */
export async function runLMStudioQuery(
  question: string,
  databaseId: number,
  databaseType: string,
  executeSQL: (sql: string) => Promise<any>,
  conversationHistory: ConversationContext[] = []
): Promise<{ answer: string; plan: QueryPlan }> {
  return LMStudioService.runAIQuery(
    question,
    databaseId,
    databaseType,
    executeSQL,
    conversationHistory
  );
}

export default LMStudioService;
