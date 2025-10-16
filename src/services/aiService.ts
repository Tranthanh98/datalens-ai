/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI Service using Google Gemini for intelligent SQL query generation
 * Implements multi-step reasoning to handle complex database queries
 */

import { GoogleGenAI, Type } from "@google/genai";
import { SchemaService } from "../db/services";
import type { DatabaseInfo } from "../db/types";
import type { QueryPlanStep as EventQueryPlanStep } from "../utils/queryPlanEvents";
import { queryPlanEvents } from "../utils/queryPlanEvents";

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

export interface ConversationContext {
  question: string;
  answer: string;
  sqlQuery?: string;
  keyFindings?: string[]; // Important info extracted from results
}

export interface QueryPlan {
  id: string;
  question: string;
  intent: string;
  steps: QueryStep[];
  context: Array<{ step: QueryStep; result: any }>;
  conversationHistory?: ConversationContext[]; // Previous Q&A for context
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
    databaseType: string = "postgresql",
    conversationHistory: ConversationContext[] = []
  ): Promise<QueryPlan> {
    try {
      const prompt = this.buildPlanPrompt(
        question,
        schema,
        databaseType,
        conversationHistory
      );
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
        conversationHistory,
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
    executeSQL: (sql: string) => Promise<any>,
    conversationHistory: ConversationContext[] = []
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

      // Step 1: AI analyzes intent and generates plan with conversation context
      const plan = await this.generatePlan(
        question,
        schema,
        databaseType,
        conversationHistory
      );

      // Emit plan generated event
      const eventSteps: EventQueryPlanStep[] = plan.steps.map((step) => ({
        id: step.id,
        type: step.type,
        description: step.description,
        sql: step.sql,
        status: "pending" as const,
      }));

      queryPlanEvents.emit({
        type: "plan_generated",
        planId: plan.id,
        steps: eventSteps,
      });

      // Step 2: Execute each step in the plan
      for (const step of plan.steps) {
        if (step.type === "query" && step.sql) {
          try {
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
            step.result = result;

            // Add to context for next steps
            plan.context.push({ step, result });

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

      // Emit plan completed event
      queryPlanEvents.emit({
        type: "plan_completed",
        planId: plan.id,
      });

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
    databaseType: string,
    conversationHistory: ConversationContext[] = []
  ): string {
    // Build conversation history context
    const historyContext =
      conversationHistory.length > 0
        ? `
CONVERSATION HISTORY (Recent ${conversationHistory.length} exchanges):
${conversationHistory
  .map(
    (ctx, idx) => `
${idx + 1}. USER ASKED: "${ctx.question}"
   AI ANSWERED: ${ctx.answer.substring(0, 200)}...
   SQL USED: ${ctx.sqlQuery || "N/A"}
   KEY FINDINGS: ${ctx.keyFindings?.join(", ") || "N/A"}
`
  )
  .join("\n")}

IMPORTANT: Use the context from previous questions to inform your current query.
- If the user refers to "it", "them", "that user", etc., check the conversation history
- Reuse filters, IDs, or conditions from previous queries when relevant
- The current question may be a follow-up that assumes context from above
`
        : "";

    return `
You are an expert SQL analyst. Analyze the user's question and create a step-by-step query plan.

DATABASE TYPE: ${databaseType}
DATABASE SCHEMA:
${JSON.stringify(schema, null, 2)}

${historyContext}

CURRENT USER QUESTION: "${question}"

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
- **Pay attention to conversation history** - if the question references previous context (userId, statusId, etc.), incorporate those values

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
 * Schema cleaning and enrichment response schema
 */
const SCHEMA_CLEANING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cleanedSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tableName: {
            type: Type.STRING,
            description: "Name of the table",
          },
          tableDescription: {
            type: Type.STRING,
            description:
              "Clear description of table's purpose and business context",
          },
          isRelevant: {
            type: Type.BOOLEAN,
            description: "Whether this table is relevant for business queries",
          },
          category: {
            type: Type.STRING,
            description:
              "Business category (e.g., 'Sales', 'Users', 'Products', 'Analytics', 'System')",
          },
          columns: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                columnName: {
                  type: Type.STRING,
                  description: "Column name",
                },
                dataType: {
                  type: Type.STRING,
                  description: "SQL data type",
                },
                isPrimaryKey: {
                  type: Type.BOOLEAN,
                  description: "Whether column is a primary key",
                },
                isForeignKey: {
                  type: Type.BOOLEAN,
                  description: "Whether column is a foreign key",
                },
                referencedTable: {
                  type: Type.STRING,
                  description: "Referenced table if foreign key",
                },
                isNullable: {
                  type: Type.BOOLEAN,
                  description: "Whether column allows NULL",
                },
                description: {
                  type: Type.STRING,
                  description:
                    "Clear, business-friendly description of the column",
                },
                isRelevant: {
                  type: Type.BOOLEAN,
                  description: "Whether this column is useful for queries",
                },
              },
              required: ["columnName", "dataType", "description", "isRelevant"],
            },
          },
          primaryKey: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Primary key column names",
          },
          foreignKeys: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                columnName: { type: Type.STRING },
                referencedTable: { type: Type.STRING },
                referencedColumn: { type: Type.STRING },
              },
            },
          },
        },
        required: [
          "tableName",
          "tableDescription",
          "isRelevant",
          "category",
          "columns",
        ],
      },
    },
    removedTables: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tableName: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
      },
      description: "List of tables removed and why",
    },
    summary: {
      type: Type.OBJECT,
      properties: {
        totalTables: { type: Type.NUMBER },
        relevantTables: { type: Type.NUMBER },
        removedTables: { type: Type.NUMBER },
        categories: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      description: "Summary statistics",
    },
  },
  required: ["cleanedSchema", "removedTables", "summary"],
};

/**
 * Clean and enrich database schema using AI
 * Removes irrelevant tables and adds meaningful descriptions to improve query context
 */
export async function cleanAndEnrichSchema(
  rawSchema: any[],
  databaseType: string = "postgresql"
): Promise<{
  success: boolean;
  cleanedSchema?: any[];
  error?: string;
  summary?: {
    totalTables: number;
    relevantTables: number;
    removedTables: number;
    categories: string[];
  };
}> {
  try {
    if (!rawSchema || rawSchema.length === 0) {
      return {
        success: false,
        error: "No schema data provided",
      };
    }

    const prompt = `
You are a database schema expert. Clean and enrich this database schema to optimize it for AI-powered query generation.

DATABASE TYPE: ${databaseType}
RAW SCHEMA:
${JSON.stringify(rawSchema, null, 2)}

⚠️ CRITICAL RULES - MUST FOLLOW:
1. **NEVER change table names or column names** - use EXACT names from the raw schema
2. **NEVER rename, modify, or translate any table/column identifiers**
3. **ONLY add descriptions and metadata** - do not alter the actual database identifiers

YOUR TASKS:
1. **Remove irrelevant tables** such as:
   - System/internal tables (migrations, sessions, logs, audit trails)
   - Temporary tables
   - Cache tables
   - Framework-specific tables (e.g., Django admin, Laravel jobs)
   - Any tables that don't contain meaningful business data

2. **Keep relevant tables** that contain:
   - Business entities (users, products, orders, etc.)
   - Transaction data
   - Master data
   - Analytics/reporting data
   - Any tables useful for business queries

3. **Enrich each relevant table** with:
   - **tableName**: EXACT name from raw schema (DO NOT CHANGE)
   - **tableDescription**: Clear, business-friendly description of table's purpose
   - **category**: Business category (Sales, Users, Products, Analytics, etc.)
   - Mark primary keys and foreign keys
   - Relationships to other tables

4. **Enrich each column** with:
   - **columnName**: EXACT name from raw schema (DO NOT CHANGE, DO NOT TRANSLATE)
   - **dataType**: EXACT type from raw schema (DO NOT CHANGE)
   - **description**: Clear explanation of what data it contains (business meaning)
   - Mark if it's relevant for queries
   - Mark primary/foreign keys

5. **Optimize for context**:
   - Focus on columns that help answer business questions
   - Mark technical columns as isRelevant=false instead of removing them
   - Keep column structure intact, only add metadata

IMPORTANT EXAMPLES:
✅ CORRECT:
  "columnName": "user_id"  // Keep exact name from database
  "description": "Unique identifier for the user"

❌ WRONG:
  "columnName": "userId"   // Don't convert snake_case to camelCase
  "columnName": "User ID"  // Don't add spaces
  "columnName": "id_usuario" // Don't translate

✅ CORRECT:
  "tableName": "order_items"
  "tableDescription": "Stores individual line items for each order"

❌ WRONG:
  "tableName": "OrderItems"  // Don't change casing
  "tableName": "order items" // Don't add spaces

GUIDELINES:
- Be aggressive in removing system/technical tables
- Prioritize business value over completeness
- Descriptions should be concise but clear
- Think about what an analyst would ask about this data
- **PRESERVE ALL ORIGINAL NAMES EXACTLY AS THEY ARE IN THE DATABASE**

Return a JSON response following the schema structure.
    `.trim();

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA_CLEANING_SCHEMA,
      },
    });

    const cleanedData = JSON.parse(result.text || "{}");

    // Filter to only return relevant tables
    const relevantSchema = cleanedData.cleanedSchema.filter(
      (table: any) => table.isRelevant
    );

    // Validate that AI didn't change table/column names
    const validationErrors: string[] = [];

    // Extract unique table names from raw schema
    const rawTableNames = new Set(
      rawSchema.map((row: any) => row.table_name || row.tableName)
    );

    // Check each cleaned table
    for (const table of relevantSchema) {
      // Verify table name exists in raw schema
      if (!rawTableNames.has(table.tableName)) {
        validationErrors.push(
          `Table name changed: "${table.tableName}" not found in original schema`
        );
      }

      // Get original columns for this table
      const originalColumns = rawSchema
        .filter(
          (row: any) => (row.table_name || row.tableName) === table.tableName
        )
        .map((row: any) => row.column_name || row.columnName);

      // Check each column name wasn't modified
      for (const column of table.columns) {
        if (!originalColumns.includes(column.columnName)) {
          validationErrors.push(
            `Column name changed in table "${table.tableName}": "${column.columnName}" not found in original schema`
          );
        }
      }
    }

    // If validation errors found, reject the cleaning
    if (validationErrors.length > 0) {
      console.error("Schema cleaning validation failed:", validationErrors);
      return {
        success: false,
        error: `AI modified table/column names. Validation errors:\n${validationErrors.join(
          "\n"
        )}`,
      };
    }

    console.log("Schema cleaning complete:", {
      original: rawSchema.length,
      cleaned: relevantSchema.length,
      removed: cleanedData.removedTables?.length || 0,
      summary: cleanedData.summary,
    });

    return {
      success: true,
      cleanedSchema: relevantSchema,
      summary: cleanedData.summary,
    };
  } catch (error) {
    console.error("Error cleaning schema:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Schema cleaning failed",
    };
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
  executeSQL: (sql: string) => Promise<any>,
  conversationHistory: ConversationContext[] = []
): Promise<{ answer: string; plan: QueryPlan }> {
  return AIService.runAIQuery(
    question,
    databaseInfo,
    executeSQL,
    conversationHistory
  );
}

export default AIService;
