/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Smart AI Agent using Google Gemini with Function Calling
 *
 * ARCHITECTURE:
 * - Single intelligent agent that decides when to query database
 * - Uses function calling to execute SQL only when needed
 * - Handles both data queries and general conversation
 * - Iterative refinement with context awareness
 *
 * IMPROVEMENTS OVER MULTI-STEP APPROACH:
 * 1. Simpler: One agent call instead of complex planning
 * 2. Smarter: AI decides if SQL is needed
 * 3. Faster: No unnecessary query steps
 * 4. Natural: Better conversation flow
 * 5. Flexible: Handles mixed queries (data + chat)
 */

import { GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import type { ConversationContext } from "../utils/aiPrompt";
import { searchSimilarTables } from "./schemaSearchService";

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
});

/**
 * Function declarations for AI agent
 */
const EXECUTE_SQL_FUNCTION: FunctionDeclaration = {
  name: "execute_sql",
  description:
    "Execute a SQL SELECT query to retrieve data from the database. Use this when you need actual data to answer the user's question.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      sql: {
        type: Type.STRING,
        description: "SQL SELECT query with schema prefix and LIMIT/TOP clause",
      },
      purpose: {
        type: Type.STRING,
        description: "What this query will accomplish",
      },
    },
    required: ["sql", "purpose"],
  },
};

/**
 * Types
 */
export interface QueryExecution {
  sql: string;
  purpose: string;
  result?: any;
  error?: string;
  executionTime?: number;
  rowCount?: number;
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
  finalAnswer: string;
  finalSQL?: string;
  chartData?: ChartData;
  databaseType: string;
  totalExecutionTime: number;
  queryCount: number;
  queries: QueryExecution[];
}

// /**
//  * Schema cleaning and enrichment response schema
//  */
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
 * Smart AI Agent Service
 */
export class AIService {
  /**
   * Main entry point - smart agent with function calling
   */
  static async runSmartAgent(
    question: string,
    databaseId: number,
    databaseType: string,
    executeSQL: (sql: string) => Promise<any>,
    conversationHistory: ConversationContext[] = []
  ): Promise<{ answer: string; plan: QueryPlan }> {
    const startTime = Date.now();
    const planId = `plan_${Date.now()}`;
    const queries: QueryExecution[] = [];

    try {
      // Validate input
      if (!databaseId) {
        throw new Error("Database ID is required");
      }

      // Get relevant schema
      const schemaResult = await searchSimilarTables(databaseId, question, 15);

      if (
        !schemaResult.success ||
        !schemaResult.data ||
        schemaResult.data.length === 0
      ) {
        // No schema - answer without database
        const answer = this.createNoSchemaResponse(question);
        return {
          answer,
          plan: {
            id: planId,
            question,
            finalAnswer: answer,
            databaseType,
            totalExecutionTime: Date.now() - startTime,
            queryCount: 0,
            queries: [],
          },
        };
      }

      const schema = schemaResult.data.map((item) => item.schema);
      console.log(`📊 Found ${schema.length} relevant tables`);

      // Build agent prompt
      const systemPrompt = this.buildAgentPrompt(schema, databaseType);
      const conversationMessages = this.buildConversationMessages(
        conversationHistory,
        question
      );

      // Call AI agent with function calling capability
      let agentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [...conversationMessages],
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: [EXECUTE_SQL_FUNCTION] }],
          temperature: 0.1,
        },
      });

      // Iterative execution (max 5 iterations to prevent loops)
      const maxIterations = 5;
      let iteration = 0;
      let finalText = "";

      while (iteration < maxIterations) {
        iteration++;

        // Check if agent wants to call function
        const functionCall = agentResponse.functionCalls?.[0];

        if (!functionCall) {
          // No function call - agent has final answer
          finalText = agentResponse.text || "";
          break;
        }

        console.log(`🔄 Iteration ${iteration}: ${functionCall.name}`);

        if (functionCall.name === "execute_sql") {
          // Execute SQL
          const sql = functionCall.args.sql as string;
          const purpose = functionCall.args.purpose as string;

          const queryExecution = await this.executeSQLWithRetry(
            sql,
            purpose,
            executeSQL,
            databaseType
          );

          queries.push(queryExecution);

          // Continue conversation with query result
          conversationMessages.push({
            role: "model",
            parts: [{ functionCall }],
          });

          conversationMessages.push({
            role: "user",
            parts: [
              {
                functionResponse: {
                  name: functionCall.name,
                  response: queryExecution.error
                    ? {
                        error: queryExecution.error,
                        suggestion: "Try a different query or approach",
                      }
                    : {
                        data: queryExecution.result,
                        rowCount: queryExecution.rowCount,
                        executionTime: queryExecution.executionTime,
                      },
                },
              },
            ],
          });

          // Get next response
          agentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: conversationMessages,
            config: {
              systemInstruction: systemPrompt,
              tools: [{ functionDeclarations: [EXECUTE_SQL_FUNCTION] }],
              temperature: 0.1,
            },
          });
        } else {
          // Unknown function
          break;
        }
      }

      if (!finalText && queries.length > 0) {
        // Fallback if agent didn't provide final text
        finalText =
          agentResponse.text ||
          (await this.generateEnhancedAnswer(question, queries));
      }

      // Extract chart data
      const chartData = this.extractChartData(finalText);
      if (chartData) {
        finalText = finalText.replace(/```chartdata\n[\s\S]*?```/, "").trim();
      }

      // Get final SQL
      const finalSQL =
        queries.length > 0 ? queries[queries.length - 1].sql : undefined;

      const plan: QueryPlan = {
        id: planId,
        question,
        finalAnswer: finalText,
        finalSQL,
        chartData,
        databaseType,
        totalExecutionTime: Date.now() - startTime,
        queryCount: queries.length,
        queries,
      };

      return { answer: finalText, plan };
    } catch (error) {
      console.error("❌ Agent error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      const answer = `# Error\n\nI encountered an error:\n\n**${errorMessage}**\n\nPlease try again or rephrase your question.`;

      return {
        answer,
        plan: {
          id: planId,
          question,
          finalAnswer: answer,
          databaseType,
          totalExecutionTime: Date.now() - startTime,
          queryCount: queries.length,
          queries,
        },
      };
    }
  }

  /**
   * Execute SQL with retry logic
   */
  private static async executeSQLWithRetry(
    sql: string,
    purpose: string,
    executeSQL: (sql: string) => Promise<any>,
    databaseType: string,
    maxRetries: number = 2
  ): Promise<QueryExecution> {
    const startTime = Date.now();
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`  📝 SQL: ${sql.substring(0, 100)}...`);
        const result = await executeSQL(sql);
        const executionTime = Date.now() - startTime;
        const rowCount = result?.data?.length || 0;

        console.log(`  ✅ Success: ${rowCount} rows in ${executionTime}ms`);

        return {
          sql,
          purpose,
          result,
          executionTime,
          rowCount,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.log(`  ⚠️  Attempt ${attempt + 1} failed: ${lastError}`);

        if (attempt < maxRetries) {
          // Try to fix common issues
          sql = this.fixCommonSQLErrors(sql, lastError, databaseType);
        }
      }
    }

    // All attempts failed
    return {
      sql,
      purpose,
      error: lastError,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Fix common SQL errors
   */
  private static fixCommonSQLErrors(
    sql: string,
    error: string,
    databaseType: string
  ): string {
    // Add schema prefix if missing
    if (
      error.toLowerCase().includes("table") &&
      error.toLowerCase().includes("not found")
    ) {
      const defaultSchema = this.getDefaultSchema(databaseType);
      // Simple fix: add schema prefix to first table name
      return sql.replace(/FROM\s+(\w+)/i, `FROM ${defaultSchema}.$1`);
    }

    return sql;
  }

  /**
   * Get default schema for database type
   */
  private static getDefaultSchema(databaseType: string): string {
    switch (databaseType.toLowerCase()) {
      case "mssql":
      case "sqlserver":
        return "dbo";
      case "postgresql":
      case "postgres":
        return "public";
      case "mysql":
        return "mysql";
      default:
        return "dbo";
    }
  }

  /**
   * Build agent system prompt
   */
  private static buildAgentPrompt(schema: any[], databaseType: string): string {
    const defaultSchema = this.getDefaultSchema(databaseType);

    return `You are an intelligent database assistant that helps users query and understand their data.

**DATABASE CONTEXT:**
- Type: ${databaseType}
- Default Schema: ${defaultSchema}
- Available Tables: ${schema.length}

**AVAILABLE SCHEMA:**
${JSON.stringify(schema, null, 2)}

**YOUR CAPABILITIES:**
1. **Data Queries**: When users ask about data, use the execute_sql function to query the database
2. **General Chat**: When users ask general questions, greet, or clarify, respond directly without querying
3. **Context Aware**: Use conversation history to provide relevant answers

**SQL QUERY GUIDELINES:**
- ALWAYS use SELECT statements only (no INSERT, UPDATE, DELETE, DROP)
- ALWAYS include schema prefix: ${defaultSchema}.TableName
- ALWAYS include LIMIT/TOP clause to limit results (typically 10-100 rows)
- Use exact table and column names from the schema
- For ${databaseType}, use appropriate syntax:
  ${
    databaseType.toLowerCase().includes("mssql") ||
    databaseType.toLowerCase().includes("sqlserver")
      ? "* Use TOP N syntax: SELECT TOP 10 * FROM ..."
      : "* Use LIMIT syntax: SELECT * FROM ... LIMIT 10"
  }

**WHEN TO QUERY vs RESPOND:**
- Query: User asks about specific data, statistics, counts, analysis
- Respond: User greets, asks clarification, general questions, thanks you

**ANSWER FORMAT:**
- Use clear, professional markdown formatting
- Include relevant data in tables when appropriate
- Provide insights and analysis beyond raw data
- If query fails, explain what went wrong and suggest alternatives

**CHART DATA (IMPORTANT):**
After your markdown answer, you can include chart data for visualization:

\`\`\`chartdata
{
  "type": "bar|pie|line|none",
  "data": [{"name": "...", "value": ...}],
  "xAxisKey": "name",
  "yAxisKey": "value",
  "description": "Chart description"
}
\`\`\`

**Chart Type Guidelines:**
- **bar**: Comparing categories (2-20 items). Example: Sales by region, orders by status
- **pie**: Showing proportions (3-8 slices). Example: Market share, status distribution
- **line**: Trends over time (5+ points). Example: Monthly sales, user growth
- **none**: Single values, non-numeric data, or when charts don't make sense

**Chart Data Rules:**
1. Extract numeric data suitable for visualization
2. Use clear, human-readable names (not raw column names)
3. Limit to 20 data points maximum
4. Calculate percentages for pie charts if needed
5. Only include chartdata block if data is suitable for visualization

**IMPORTANT:**
- Always explain your reasoning
- If data is unclear, query first then analyze
- Be helpful and conversational
- Respond in the same language as the user's question`;
  }

  /**
   * Build conversation messages
   */
  private static buildConversationMessages(
    history: ConversationContext[],
    currentQuestion: string
  ): any[] {
    const messages: any[] = [];

    // Add conversation history
    history.forEach((ctx) => {
      if (ctx.question) {
        messages.push({
          role: "user",
          parts: [{ text: ctx.question }],
        });
      }
      if (ctx.answer) {
        messages.push({
          role: "model",
          parts: [{ text: ctx.answer }],
        });
      }
    });

    // Add current question
    messages.push({
      role: "user",
      parts: [{ text: currentQuestion }],
    });

    return messages;
  }

  /**
   * Extract chart data from markdown response
   */
  private static extractChartData(text: string): ChartData | undefined {
    const match = text.match(/```chartdata\n([\s\S]*?)```/);
    if (!match) return undefined;

    try {
      const chartData = JSON.parse(match[1].trim());
      if (chartData.type && chartData.data && Array.isArray(chartData.data)) {
        return chartData;
      }
    } catch (e) {
      console.warn("Failed to parse chart data:", e);
    }

    return undefined;
  }

  /**
   * Create response when no schema is available
   */
  private static createNoSchemaResponse(question: string): string {
    return `# No Database Schema Available

I don't have access to relevant database tables to answer your question:

> "${question}"

**Possible reasons:**
- Database schema hasn't been indexed yet
- No tables match your question
- Database connection issues

**Next steps:**
- Check your database connection
- Ensure schema embeddings are generated
- Try rephrasing your question`;
  }

  /**
   * Create fallback answer from query results
   */
  private static createFallbackAnswer(
    question: string,
    queries: QueryExecution[]
  ): string {
    const successfulQueries = queries.filter((q) => !q.error && q.result);

    if (successfulQueries.length === 0) {
      return `# Query Results

I attempted to answer your question but encountered errors with all queries.

**Your question:** ${question}

**Attempted queries:** ${queries.length}

Please try rephrasing your question or check your database schema.`;
    }

    let answer = `# Query Results\n\n`;
    answer += `Based on ${successfulQueries.length} database ${
      successfulQueries.length === 1 ? "query" : "queries"
    }:\n\n`;

    successfulQueries.forEach((q, idx) => {
      answer += `## Query ${idx + 1}: ${q.purpose}\n\n`;
      answer += `**SQL:**\n\`\`\`sql\n${q.sql}\n\`\`\`\n\n`;
      answer += `**Results:** ${q.rowCount} rows\n\n`;

      if (q.result?.data && q.result.data.length > 0) {
        const data = q.result.data.slice(0, 5);
        const columns = Object.keys(data[0]);

        answer += `| ${columns.join(" | ")} |\n`;
        answer += `| ${columns.map(() => "---").join(" | ")} |\n`;
        data.forEach((row) => {
          answer += `| ${columns.map((col) => row[col]).join(" | ")} |\n`;
        });
        answer += `\n`;
      }
    });

    return answer;
  }

  /**
   * Generate enhanced answer with AI analysis for better insights and chart data
   */
  private static async generateEnhancedAnswer(
    question: string,
    queries: QueryExecution[]
  ): Promise<string> {
    const successfulQueries = queries.filter((q) => !q.error && q.result);

    if (successfulQueries.length === 0) {
      return this.createFallbackAnswer(question, queries);
    }

    try {
      const totalRows = successfulQueries.reduce(
        (sum, q) => sum + (q.rowCount || 0),
        0
      );
      const totalTime = queries.reduce(
        (sum, q) => sum + (q.executionTime || 0),
        0
      );

      const prompt = `You are analyzing database query results to provide comprehensive insights.

**ORIGINAL QUESTION:** "${question}"

**EXECUTION SUMMARY:**
- Total Queries: ${queries.length}
- Successful: ${successfulQueries.length}
- Failed: ${queries.length - successfulQueries.length}
- Total Rows: ${totalRows}
- Execution Time: ${totalTime}ms

**QUERY RESULTS:**
${successfulQueries
  .map(
    (q, idx) => `
### Query ${idx + 1}: ${q.purpose}
**SQL:** ${q.sql}
**Status:** ✅ Success (${q.rowCount} rows in ${q.executionTime}ms)
**Data Sample:**
${JSON.stringify(q.result?.data?.slice(0, 10), null, 2)}
`
  )
  .join("\n---\n")}

**YOUR TASK:**
Generate a comprehensive, professional answer with:

1. **Executive Summary** - Brief overview of findings
2. **Key Findings** - Bullet points with important insights
3. **Data Tables** - Format data as markdown tables when appropriate
4. **Analysis & Insights** - Interpretation of the data
5. **Chart Data Block** - If data is suitable for visualization

**CHART DATA FORMAT:**
If the data can be visualized, include at the end:

\`\`\`chartdata
{
  "type": "bar|pie|line|none",
  "data": [{"name": "Category", "value": 123}, ...],
  "xAxisKey": "name",
  "yAxisKey": "value",
  "description": "What this chart shows"
}
\`\`\`

**Guidelines:**
- Use clear, professional markdown
- Answer in the same language as the question
- Include specific numbers and data points
- Provide actionable insights
- Only add chartdata if data is numeric and suitable

Generate your response now:`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { temperature: 0.2 },
      });

      return result.text || this.createFallbackAnswer(question, queries);
    } catch (error) {
      console.error("Error generating enhanced answer:", error);
      return this.createFallbackAnswer(question, queries);
    }
  }
}

/**
 * Main export function - maintains compatibility with existing code
 */
export async function runAIQuery(
  question: string,
  databaseId: number,
  databaseType: string,
  executeSQL: (sql: string) => Promise<any>,
  conversationHistory: ConversationContext[] = []
): Promise<{ answer: string; plan: QueryPlan }> {
  return AIService.runSmartAgent(
    question,
    databaseId,
    databaseType,
    executeSQL,
    conversationHistory
  );
}

/**
 * IMPROVED: Clean and enrich database schema using AI with batch processing
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

    // NEW: Process in batches if schema is large
    const BATCH_SIZE = 50;
    const batches = [];

    for (let i = 0; i < rawSchema.length; i += BATCH_SIZE) {
      batches.push(rawSchema.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `Processing ${rawSchema.length} tables in ${batches.length} batch(es)...`
    );

    const allCleanedSchemas = [];
    const allRemovedTables = [];
    let totalRelevant = 0;

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(
        `Processing batch ${batchIdx + 1}/${batches.length} (${
          batch.length
        } tables)...`
      );

      const prompt = `
You are a database schema expert. Clean and enrich this database schema to optimize it for AI-powered query generation.

DATABASE TYPE: ${databaseType}
RAW SCHEMA (Batch ${batchIdx + 1}/${batches.length}):
${JSON.stringify(batch, null, 2)}

⚠️ CRITICAL RULES - MUST FOLLOW:
1. **NEVER change table names or column names** - use EXACT names from the raw schema
2. **NEVER rename, modify, or translate any table/column identifiers**
3. **ONLY add descriptions and metadata** - do not alter the actual database identifiers
4. **Be conservative with removal** - only remove obviously irrelevant tables (<10% removal rate)

YOUR TASKS:
1. **Remove irrelevant tables** such as:
   - System/internal tables (migrations, sessions, logs, audit trails)
   - Temporary tables (temp_, tmp_, #)
   - Cache tables
   - Framework-specific tables (e.g., Django migrations, Laravel jobs, AspNet internal tables)
   - Any tables that don't contain meaningful business data
   - **IMPORTANT**: Delete ratio should be below 10% to preserve context

2. **Keep relevant tables** that contain:
   - Business entities (users, customers, products, orders, etc.)
   - Transaction data (sales, payments, shipments)
   - Master data (categories, regions, statuses)
   - Analytics/reporting data
   - Any tables useful for business queries

3. **Enrich each relevant table** with:
   - **tableName**: EXACT name from raw schema (DO NOT CHANGE)
   - **tableDescription**: Clear, business-friendly description (2-3 sentences max)
   - **category**: Business category (Sales, Users, Products, Finance, Analytics, Operations, etc.)
   - **isRelevant**: true if useful for queries
   - Mark primary keys and foreign keys accurately

4. **Enrich each column** with:
   - **columnName**: EXACT name from raw schema (DO NOT CHANGE, DO NOT TRANSLATE)
   - **dataType**: EXACT type from raw schema (DO NOT CHANGE)
   - **description**: Clear explanation of business meaning (1 sentence)
   - **isRelevant**: false for technical columns (created_at, updated_at, internal IDs with no business meaning)
   - Mark primary/foreign keys

5. **Optimize for context**:
   - Focus on columns that help answer business questions
   - Mark technical audit columns as isRelevant=false
   - Keep all columns in the structure, just mark relevance

IMPORTANT EXAMPLES:
✅ CORRECT:
  "columnName": "user_id"  // Keep exact name from database
  "description": "Unique identifier for the user"
  "isRelevant": true

❌ WRONG:
  "columnName": "userId"   // Don't convert snake_case to camelCase
  "columnName": "User ID"  // Don't add spaces

✅ CORRECT:
  "tableName": "order_items"
  "tableDescription": "Stores individual line items for each customer order with product details and quantities"
  "category": "Sales"
  "isRelevant": true

❌ WRONG:
  "tableName": "OrderItems"  // Don't change casing
  "isRelevant": false  // Don't mark business tables as irrelevant

GUIDELINES:
- Be selective but not overly aggressive in removing tables
- Prioritize business value and query usefulness
- Descriptions should be concise but informative
- Think about what questions analysts would ask
- **PRESERVE ALL ORIGINAL NAMES EXACTLY AS THEY ARE**
- Categorize tables logically for better organization

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
      const relevantTables = cleanedData.cleanedSchema.filter(
        (table: any) => table.isRelevant
      );

      allCleanedSchemas.push(...relevantTables);
      allRemovedTables.push(...cleanedData.removedTables);
      totalRelevant += relevantTables.length;

      console.log(
        `Batch ${batchIdx + 1}: ${
          relevantTables.length
        } relevant tables kept, ${cleanedData.removedTables.length} removed`
      );
    }

    // NEW: Extract unique categories
    const categories = [
      ...new Set(allCleanedSchemas.map((t: any) => t.category)),
    ];

    const summary = {
      totalTables: rawSchema.length,
      relevantTables: totalRelevant,
      removedTables: allRemovedTables.length,
      categories,
    };

    console.log("Schema cleaning complete:", summary);

    return {
      success: true,
      cleanedSchema: allCleanedSchemas,
      summary,
    };
  } catch (error) {
    console.error("Error cleaning schema:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Schema cleaning failed",
    };
  }
}

export default AIService;
