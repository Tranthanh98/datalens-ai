import { GoogleGenAI, Type } from "@google/genai";
import { DatabaseSchema } from "../types";

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
      description: "Database type (postgresql, mssql, etc.)",
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

/**
 * Types for AI query planning and execution
 */
export interface QueryStep {
  id: string;
  type: "query" | "analysis" | "aggregation";
  description: string;
  sql?: string;
  result?: Record<string, unknown>[];
  dependsOn?: string[];
  reasoning?: string;
}

export interface QueryPlan {
  id: string;
  question: string;
  intent: string;
  steps: QueryStep[];
  context: Array<{
    step: QueryStep;
    result: Record<string, unknown>[] | { error: string };
  }>;
  finalAnswer?: string;
  databaseType: string;
}

/**
 * AI Service for intelligent SQL query generation using Gemini
 */
export class AIService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generate initial query plan from user question
   */
  async generatePlan(
    question: string,
    schema: DatabaseSchema[],
    databaseType: "postgresql" | "mssql"
  ): Promise<QueryPlan> {
    try {
      const prompt = this.buildPlanPrompt(question, schema, databaseType);
      const result = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: QUERY_PLAN_SCHEMA,
        },
      });

      // Parse structured JSON response
      const planData = JSON.parse(result.text || "{}");

      console.log("plan steps", planData.steps);

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
  async refinePlan(plan: QueryPlan): Promise<QueryPlan> {
    try {
      const prompt = this.buildRefinementPrompt(plan);
      const result = await this.ai.models.generateContent({
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
   * Execute multi-step AI query with reasoning (main interface)
   */
  async runAIQuery(
    question: string,
    schema: DatabaseSchema[],
    databaseType: "postgresql" | "mssql",
    executeSQL: (sql: string) => Promise<Record<string, unknown>[]>
  ): Promise<string> {
    try {
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
            const refinedPlan = await this.refinePlan(plan);
            // Update remaining steps with refined plan
            Object.assign(plan, refinedPlan);
          } catch (sqlError) {
            console.error(`SQL execution error for step ${step.id}:`, sqlError);
            const errorMessage =
              sqlError instanceof Error ? sqlError.message : String(sqlError);
            step.result = [];
            plan.context.push({ step, result: { error: errorMessage } });
          }
        }
      }

      // Generate final answer based on all results
      const finalAnswer = await this.generateFinalAnswer(plan);
      plan.finalAnswer = finalAnswer;

      return finalAnswer;
    } catch (error) {
      console.error("Error running AI query:", error);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility (now uses multi-step reasoning)
   */
  async generateSQLQuery(
    question: string,
    schema: DatabaseSchema[],
    databaseType: "postgresql" | "mssql"
  ): Promise<{ success: boolean; sql?: string; error?: string }> {
    try {
      // Use the new plan-based approach but return only the first query
      const plan = await this.generatePlan(question, schema, databaseType);

      if (plan.steps.length > 0 && plan.steps[0].sql) {
        return {
          success: true,
          sql: plan.steps[0].sql,
        };
      }

      return {
        success: false,
        error: "No SQL query generated in plan",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate query",
      };
    }
  }

  /**
   * Generate final answer from query results
   */
  async generateAnswer(
    question: string,
    sqlQuery: string,
    queryResults: Record<string, unknown>[]
  ): Promise<string> {
    try {
      const prompt = `
Based on the following information, provide a clear and well-formatted Markdown response to the user's question.

USER QUESTION: "${question}"

SQL QUERY EXECUTED:
${sqlQuery}

QUERY RESULTS:
${JSON.stringify(queryResults, null, 2)}

Format your response as professional Markdown with:
1. A clear heading for the main answer
2. Use tables for data presentation when appropriate
3. Use bullet points or numbered lists for key insights
4. Use code blocks for SQL queries if mentioned
5. Use bold/italic for emphasis
6. Include key statistics or findings

Structure example:
# Query Results

## Summary
Brief overview of what was found...

## Key Findings
- **Total records**: X
- **Key insight**: Description

## Data Details
| Column | Value | Notes |
|--------|-------|-------|
| ... | ... | ... |

## SQL Query Used
\`\`\`sql
${sqlQuery}
\`\`\`

---
*Generated from database query*

Generate the response following this structure but adapt it naturally to the specific data and question.

Answer (in Markdown format):
      `.trim();

      const result = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return (
        result.text ||
        "# Unable to Generate Answer\n\nI couldn't generate an answer based on the query results. Please try rephrasing your question or check your database connection."
      );
    } catch (error) {
      console.error("Error generating answer:", error);
      return "# Error\n\nUnable to generate an answer based on the query results.";
    }
  }

  /**
   * Apply refinements to existing query plan
   */
  private applyRefinements(
    plan: QueryPlan,
    refinementData: {
      shouldRefine: boolean;
      reasoning: string;
      newSteps: QueryStep[];
      modifiedSteps: QueryStep[];
    }
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
      refinementData.modifiedSteps.forEach((modifiedStep) => {
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
  private buildPlanPrompt(
    question: string,
    schema: DatabaseSchema[],
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
  "question": "${question}",
  "intent": "Brief description of what user wants",
  "databaseType": "${databaseType}",
  "steps": [
    {
      "id": "step_1",
      "type": "query|analysis|aggregation",
      "description": "What this step does",
      "sql": "SQL query for this step (if applicable)",
      "dependsOn": ["step_ids this depends on"],
      "reasoning": "Why this step is needed"
    }
  ],
  "context": []
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
  private buildRefinementPrompt(plan: QueryPlan): string {
    const contextSummary = plan.context.map((ctx) => ({
      step: ctx.step.description,
      result_summary:
        Array.isArray(ctx.result) && ctx.result.length > 0
          ? `${ctx.result.length} rows`
          : "error" in ctx.result
          ? `error: ${ctx.result.error}`
          : "no data",
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
  private async generateFinalAnswer(plan: QueryPlan): Promise<string> {
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

Generate the response following this structure but adapt it naturally to the specific data and question.

Answer (in Markdown format):
      `.trim();

      const result = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return (
        result.text ||
        "# Unable to Generate Answer\n\nI couldn't generate a comprehensive answer based on the query results. Please try rephrasing your question or check your database connection."
      );
    } catch (error) {
      console.error("Error generating final answer:", error);
      return "# Error\n\nUnable to generate a comprehensive answer based on the query results.";
    }
  }

  /**
   * Build prompt for SQL query generation (legacy)
   */
  private buildQueryPrompt(
    question: string,
    schema: DatabaseSchema[],
    databaseType: string
  ): string {
    return `
You are an expert SQL analyst. Generate a SQL query to answer the user's question.

DATABASE TYPE: ${databaseType}

DATABASE SCHEMA:
${JSON.stringify(schema, null, 2)}

USER QUESTION: "${question}"

IMPORTANT RESTRICTIONS:
- ONLY generate SELECT statements
- DO NOT use INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, or any data modification commands
- This is a read-only system for data analysis only
- All queries must be safe and non-destructive

Guidelines:
- Use proper ${databaseType} SQL syntax
- Include only relevant tables and columns from the schema
- Use appropriate JOINs based on foreign key relationships
- Add necessary WHERE, GROUP BY, and ORDER BY clauses
- Ensure the query is efficient and correct
- Return ONLY the SQL query without any markdown code blocks or explanations

SQL Query:
    `.trim();
  }

  /**
   * Extract SQL query from AI response
   */
  private extractSQLFromResponse(response: string): string | null {
    // Remove markdown code blocks if present
    let sql = response.trim();

    // Remove ```sql and ``` markers
    sql = sql.replace(/```sql\s*/gi, "").replace(/```\s*/g, "");

    // Remove any leading/trailing whitespace
    sql = sql.trim();

    return sql;
  }
}
