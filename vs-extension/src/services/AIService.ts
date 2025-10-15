import { GoogleGenAI } from "@google/genai";
import { DatabaseSchema } from "../types";

/**
 * AI Service for intelligent SQL query generation using Gemini
 */
export class AIService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generate SQL query from natural language question
   */
  async generateSQLQuery(
    question: string,
    schema: DatabaseSchema[],
    databaseType: "postgresql" | "mssql"
  ): Promise<{ success: boolean; sql?: string; error?: string }> {
    try {
      const prompt = this.buildQueryPrompt(question, schema, databaseType);

      const result = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const sqlQuery = this.extractSQLFromResponse(result.text || "");

      if (!sqlQuery) {
        return {
          success: false,
          error: "Failed to generate SQL query",
        };
      }

      return {
        success: true,
        sql: sqlQuery,
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
Based on the following information, provide a clear and concise answer to the user's question.

USER QUESTION: "${question}"

SQL QUERY EXECUTED:
${sqlQuery}

QUERY RESULTS:
${JSON.stringify(queryResults, null, 2)}

Provide a natural language answer that:
1. Directly answers the user's question
2. Includes relevant data from the results
3. Is easy to understand
4. Mentions any important insights from the data

Answer:
      `.trim();

      const result = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return (
        result.text ||
        "Unable to generate an answer based on the query results."
      );
    } catch (error) {
      console.error("Error generating answer:", error);
      return "Unable to generate an answer based on the query results.";
    }
  }

  /**
   * Build prompt for SQL query generation
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
