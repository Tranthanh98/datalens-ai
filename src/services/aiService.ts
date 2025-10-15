/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI Service using Google Gemini for intelligent SQL query generation
 * Implements multi-step reasoning to handle complex database queries
 */

import { GoogleGenAI, Type } from "@google/genai";
import { SchemaService } from "../db/services";
import type { DatabaseInfo } from "../db/types";

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
});

/**
 * Response schemas for structured output
 */
const QUERY_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    question: {
      type: Type.STRING,
      description: "Original user question",
    },
    intent: {
      type: Type.STRING,
      description: "Analyzed intent of the query",
    },
    databaseType: {
      type: Type.STRING,
      description: "Database type (postgresql, mysql, etc.)",
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique step identifier",
          },
          type: {
            type: Type.STRING,
            description: "Step type: query, analysis, or aggregation",
          },
          description: {
            type: Type.STRING,
            description: "Human readable description of the step",
          },
          sql: {
            type: Type.STRING,
            description: "SQL query to execute",
          },
          dependsOn: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: "Array of step IDs this step depends on",
          },
          reasoning: {
            type: Type.STRING,
            description: "Explanation of why this step is needed",
          },
        },
        required: [
          "id",
          "type",
          "description",
          "sql",
          "dependsOn",
          "reasoning",
        ],
      },
    },
    context: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          step: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              type: { type: Type.STRING },
              description: { type: Type.STRING },
              sql: { type: Type.STRING },
              dependsOn: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              reasoning: { type: Type.STRING },
            },
          },
          result: {
            type: Type.STRING,
            description: "JSON string of execution result",
          },
          error: {
            type: Type.STRING,
            description: "Error message if step failed",
          },
        },
      },
    },
  },
  required: ["question", "intent", "databaseType", "steps", "context"],
};

const REFINEMENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    shouldRefine: {
      type: Type.BOOLEAN,
      description: "Whether the plan needs refinement",
    },
    reasoning: {
      type: Type.STRING,
      description: "Explanation of why refinement is or isn't needed",
    },
    newSteps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING },
          description: { type: Type.STRING },
          sql: { type: Type.STRING },
          dependsOn: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          reasoning: { type: Type.STRING },
        },
        required: [
          "id",
          "type",
          "description",
          "sql",
          "dependsOn",
          "reasoning",
        ],
      },
      description: "Additional steps to add to the plan",
    },
    modifiedSteps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING },
          description: { type: Type.STRING },
          sql: { type: Type.STRING },
          dependsOn: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          reasoning: { type: Type.STRING },
        },
        required: [
          "id",
          "type",
          "description",
          "sql",
          "dependsOn",
          "reasoning",
        ],
      },
      description: "Existing steps to modify",
    },
  },
  required: ["shouldRefine", "reasoning", "newSteps", "modifiedSteps"],
};

// AI model interface
interface AIModel {
  generateContent(options: {
    model: string;
    contents: string;
  }): Promise<{ text: string }>;
}

// Gemini AI model wrapper
const model: AIModel = {
  async generateContent(options: { model: string; contents: string }) {
    try {
      const response = await ai.models.generateContent({
        model: options.model,
        contents: options.contents,
      });
      return { text: response.text || "" };
    } catch (error) {
      console.error("Gemini AI error:", error);
      throw error;
    }
  },
};

/**
 * Types for AI query planning and execution
 */
export interface QueryStep {
  id: string;
  type: "query" | "analysis" | "aggregation";
  description: string;
  sql?: string;
  result?: any;
  dependencies?: string[];
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
  context: Array<{ step: QueryStep; result: any }>;
  finalAnswer?: string;
  finalSQL?: string;
  chartData?: ChartData;
  databaseType: string;
}

/**
 * AI Service class for intelligent SQL generation
 */
export class AIService {
  /**
   * Generate initial query plan from user question
   */
  static async generatePlan(
    question: string,
    schema: any,
    databaseType: string = "postgresql"
  ): Promise<QueryPlan> {
    try {
      const prompt = this.buildPlanPrompt(question, schema, databaseType);
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: QUERY_PLAN_SCHEMA,
        },
      });

      // Parse structured JSON response
      const planData = JSON.parse(result.text || "{}");

      // Convert to QueryPlan object
      const plan: QueryPlan = {
        id: `plan_${Date.now()}`,
        question: planData.question,
        intent: planData.intent,
        databaseType: planData.databaseType,
        steps: planData.steps,
        context: planData.context || [],
      };

      return plan;
    } catch (error) {
      console.error("Error generating AI plan:", error);
      throw new Error("Failed to generate query plan");
    }
  }

  /**
   * Refine query plan based on execution context and results
   */
  static async refinePlan(plan: QueryPlan): Promise<QueryPlan> {
    try {
      const prompt = this.buildRefinementPrompt(plan);
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: REFINEMENT_SCHEMA,
        },
      });

      // Parse structured JSON response
      const refinementData = JSON.parse(result.text || "{}");

      // Apply refinements to the plan
      const refinedPlan = this.applyRefinements(plan, refinementData);

      return refinedPlan;
    } catch (error) {
      console.error("Error refining AI plan:", error);
      return plan; // Return original plan if refinement fails
    }
  }

  /**
   * Execute multi-step AI query with reasoning
   */
  static async runAIQuery(
    question: string,
    databaseInfo: DatabaseInfo,
    executeSQL: (sql: string) => Promise<any>
  ): Promise<{ answer: string; plan: QueryPlan }> {
    try {
      // Extract database ID and type from databaseInfo
      const databaseId = databaseInfo.id;
      if (!databaseId) {
        throw new Error("Database ID is required");
      }

      // Get database schema
      const schemaInfo = await SchemaService.getByDatabase(databaseId);
      if (!schemaInfo) {
        throw new Error("Database schema not found");
      }

      const schema = schemaInfo.schema;
      // Use the actual database type from databaseInfo
      const databaseType = databaseInfo.type;

      // Step 1: AI analyzes intent and generates plan
      const plan = await this.generatePlan(question, schema, databaseType);

      // Step 2: Execute each step in the plan
      for (const step of plan.steps) {
        if (step.type === "query" && step.sql) {
          try {
            // Execute SQL query
            const result = await executeSQL(step.sql);
            step.result = result;

            // Add to context for next steps
            plan.context.push({ step, result });

            // Step 3: Refine plan based on current results
            if (plan.steps.indexOf(step) < plan.steps.length - 1) {
              const refinedPlan = await this.refinePlan(plan);
              // Update remaining steps with refined plan
              Object.assign(plan, refinedPlan);
            }
          } catch (sqlError) {
            console.error(`SQL execution error for step ${step.id}:`, sqlError);
            const errorMessage =
              sqlError instanceof Error ? sqlError.message : String(sqlError);
            step.result = { error: errorMessage };
            plan.context.push({ step, result: step.result });
          }
        }
      }

      // Generate final answer based on all results
      const finalAnswer = await this.generateFinalAnswer(plan);
      plan.finalAnswer = finalAnswer;

      // Extract final SQL from the last executed step
      const lastExecutedStep = plan.steps
        .filter((step) => step.sql && step.result)
        .pop();
      if (lastExecutedStep?.sql) {
        plan.finalSQL = lastExecutedStep.sql;
      }

      return { answer: finalAnswer, plan };
    } catch (error) {
      console.error("Error running AI query:", error);
      throw error;
    }
  }

  /**
   * Apply refinements to existing query plan
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
      refinedPlan.steps = [...refinedPlan.steps, ...refinementData.newSteps];
    }

    // Modify existing steps
    if (
      refinementData.modifiedSteps &&
      refinementData.modifiedSteps.length > 0
    ) {
      refinementData.modifiedSteps.forEach((modifiedStep: any) => {
        const index = refinedPlan.steps.findIndex(
          (step) => step.id === modifiedStep.id
        );
        if (index !== -1) {
          refinedPlan.steps[index] = modifiedStep;
        }
      });
    }

    return refinedPlan;
  }

  /**
   * Build prompt for initial plan generation
   */
  private static buildPlanPrompt(
    question: string,
    schema: any,
    databaseType: string
  ): string {
    return `
You are an expert SQL analyst. Analyze the user's question and create a step-by-step query plan.

DATABASE TYPE: ${databaseType}
DATABASE SCHEMA:
${JSON.stringify(schema, null, 2)}

USER QUESTION: "${question}"

Create a JSON response with this structure:
{
  "intent": "Brief description of what user wants",
  "steps": [
    {
      "id": "step_1",
      "type": "query|analysis|aggregation",
      "description": "What this step does",
      "sql": "SQL query for this step (if applicable)",
      "dependencies": ["step_ids this depends on"]
    }
  ]
}

IMPORTANT SQL RESTRICTIONS:
- ONLY generate SELECT statements
- DO NOT use INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, or any data modification commands
- This is a read-only system for data analysis and reporting only
- All queries must be safe and non-destructive
- Focus on data retrieval, filtering, aggregation, and analysis

Guidelines:
- Break complex questions into logical steps
- Each step should build on previous results
- Use proper ${databaseType} SQL syntax
- Include table and column names from the schema
- For aggregations, ensure proper GROUP BY clauses
- Handle JOINs carefully based on schema relationships
- Ensure all SQL queries are SELECT statements only

Return only valid JSON.
    `.trim();
  }

  /**
   * Build prompt for plan refinement
   */
  private static buildRefinementPrompt(plan: QueryPlan): string {
    const contextSummary = plan.context.map((ctx) => ({
      step: ctx.step.description,
      result_summary: ctx.result?.data
        ? `${ctx.result.data.length} rows`
        : "error",
    }));

    return `
You are refining a multi-step query plan based on execution results.

ORIGINAL QUESTION: "${plan.question}"
CURRENT PLAN: ${JSON.stringify(plan.steps, null, 2)}
EXECUTION CONTEXT: ${JSON.stringify(contextSummary, null, 2)}

Based on the results so far, should any remaining steps be modified?

IMPORTANT SQL RESTRICTIONS:
- ONLY generate SELECT statements
- DO NOT use INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, or any data modification commands
- This is a read-only system for data analysis and reporting only
- All queries must be safe and non-destructive
- Focus on data retrieval, filtering, aggregation, and analysis

Return JSON with:
{
  "shouldRefine": true/false,
  "reasoning": "explanation of refinement decision",
  "newSteps": [
    // Any new steps needed (with SELECT queries only)
  ],
  "modifiedSteps": [
    // Modified existing steps (with SELECT queries only)
  ]
}

Ensure all SQL queries in new or modified steps are SELECT statements only.

Return only valid JSON.
    `.trim();
  }

  /**
   * Generate final answer based on all execution results
   */
  private static async generateFinalAnswer(plan: QueryPlan): Promise<string> {
    try {
      const prompt = `
Based on the query execution results, provide a clear answer to the user's question in well-formatted Markdown.

ORIGINAL QUESTION: "${plan.question}"
EXECUTION RESULTS:
${plan.context
  .map(
    (ctx) => `
Step: ${ctx.step.description}
Result: ${JSON.stringify(ctx.result, null, 2)}
`
  )
  .join("\n")}

IMPORTANT: After your markdown answer, you MUST provide chart data suggestion in a special JSON block.

Format your response as professional Markdown with:
1. A clear heading for the main answer
2. Use tables for data presentation when appropriate
3. Use bullet points or numbered lists for key insights
4. Use code blocks for SQL queries if mentioned
5. Use bold/italic for emphasis
6. Include a summary section if there are multiple insights

Structure example:
# Query Results

## Summary
Brief overview of what was found...

## Key Findings
- **Finding 1**: Description with data
- **Finding 2**: Description with data

## Data Details
| Column | Value | Description |
|--------|-------|-------------|
| ... | ... | ... |

## Insights
Additional analysis or recommendations...

---
*Note: Any limitations or assumptions*

CHART DATA SECTION (REQUIRED):
After your markdown answer, add this JSON block for chart visualization:

\`\`\`chartdata
{
  "type": "bar|pie|line|none",
  "data": [
    {"name": "Category1", "value": 100},
    {"name": "Category2", "value": 200}
  ],
  "xAxisKey": "name",
  "yAxisKey": "value",
  "description": "Brief description of what the chart shows"
}
\`\`\`

Guidelines for chart data:
- Use "bar" for comparisons, time series with multiple categories
- Use "pie" for percentage/proportion distributions (max 6-8 slices)
- Use "line" for trends over time
- Use "none" if data is not suitable for visualization
- Extract data from the query results to populate the chart
- Keep data points between 3-20 for readability
- Use meaningful names for categories

Generate the response following this structure.

Answer (in Markdown format with chartdata block):
      `.trim();

      const result = await model.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const fullResponse =
        result.text ||
        "# Unable to Generate Answer\n\nI couldn't generate a comprehensive answer based on the query results. Please try rephrasing your question or check your database connection.";

      // Extract chart data from response
      const chartDataMatch = fullResponse.match(/```chartdata\n([\s\S]*?)```/);
      if (chartDataMatch) {
        try {
          const chartData = JSON.parse(chartDataMatch[1]);
          plan.chartData = chartData;
        } catch (e) {
          console.warn("Failed to parse chart data:", e);
        }
      }

      // Return response without the chartdata block
      return fullResponse.replace(/```chartdata\n[\s\S]*?```/, "").trim();
    } catch (error) {
      console.error("Error generating final answer:", error);
      return "# Error\n\nUnable to generate a comprehensive answer based on the query results.";
    }
  }
}

/**
 * Main function to run AI-powered query
 * This is the primary interface for the AI service
 * Returns both the answer text and the full plan with metadata
 */
export async function runAIQuery(
  question: string,
  databaseInfo: DatabaseInfo,
  executeSQL: (sql: string) => Promise<any>
): Promise<{ answer: string; plan: QueryPlan }> {
  return AIService.runAIQuery(question, databaseInfo, executeSQL);
}

export default AIService;
