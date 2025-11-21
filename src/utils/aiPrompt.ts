/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ConversationContext {
  question: string;
  answer: string;
  sqlQuery?: string;
  keyFindings?: string[];
  timestamp?: number; // NEW: Track when context was created
}

export const buildPlanPrompt = (
  question: string,
  schema: any,
  databaseType: string,
  conversationHistory: ConversationContext[] = []
): string => {
  // NEW: Limit conversation history to last 5 exchanges for context efficiency
  const recentHistory = conversationHistory.slice(-5);

  // Build conversation history context
  const historyContext =
    recentHistory.length > 0
      ? `
CONVERSATION HISTORY (Last ${recentHistory.length} exchanges):
${recentHistory
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
  "question": "${question}",
  "intent": "Brief description of what user wants",
  "databaseType": "${databaseType}",
  "steps": [
    {
      "id": "step_1",
      "type": "query|analysis|aggregation",
      "description": "What this step does",
      "sql": "SQL query for this step",
      "dependsOn": ["step_ids this depends on"],
      "reasoning": "Why this step is needed"
    }
  ]
}

⚠️ CRITICAL SQL RULES - MUST FOLLOW:

1. **QUERY PLANNING STRATEGY**:
   - Break complex questions into 2-4 logical steps maximum
   - Each step should have a clear purpose (exploration, filtering, aggregation, final result)
   - Steps should build on each other (use dependsOn to specify dependencies)
   - First step: Explore data (LIMIT 10-20 rows)
   - Middle steps: Filter and refine based on findings
   - Final step: Get comprehensive answer with appropriate limit

2. **STEP DEPENDENCIES**:
   - Use "dependsOn": [] to specify which steps must complete first
   - Example: step_2 depends on step_1: "dependsOn": ["step_1"]
   - Steps with no dependencies will execute first
   - This enables parallel execution where possible

3. **COLUMN NAMES**: Use EXACT column names from the schema above
   - DO NOT change case (e.g., keep "Logins_LoginId", not "loginId" or "logins_loginid")
   - DO NOT convert snake_case to camelCase (e.g., keep "user_id", not "userId")
   - DO NOT translate or rename columns
   - DO NOT add spaces or remove underscores
   - If schema shows "Orders.Logins_LoginId", use exactly "Logins_LoginId" in your SQL

4. **TABLE NAMES**: Use EXACT table names from the schema
   - DO NOT change case (e.g., keep "Orders", not "orders" or "ORDERS")
   - DO NOT rename or translate tables
   - Use the exact spelling provided in the schema

5. **ALWAYS USE LIMIT/TOP**: NEVER query all rows without limits
   - Use proper syntax for ${databaseType}:
     * SQL Server (mssql): SELECT TOP N ...
     * PostgreSQL/MySQL: SELECT ... LIMIT N
     * Oracle: SELECT ... FETCH FIRST N ROWS ONLY
   - Default limits based on query type:
     * Exploration queries (step 1): 10-20 rows
     * Filtering queries (middle steps): 20-50 rows
     * Final aggregation: 10-20 rows
     * COUNT queries: Can query all but filter with WHERE first
   - ALWAYS include appropriate limit clause for the database type

6. **USE SEMANTIC SEARCH PATTERNS**: Query by meaning, not exact match
   - For status/error searches: Use LIKE with wildcards for broader context
   - For text searches: Use pattern matching to capture variations
   - For categorical data: Consider using IN with multiple related values
   
   Examples:
   ✅ CORRECT: WHERE Status LIKE '%Error%' OR Status LIKE '%Failed%' OR Status LIKE '%Exception%'
   ✅ CORRECT: WHERE StatusName IN ('Error', 'Failed', 'Timeout', 'Exception')
   ✅ CORRECT: WHERE Description LIKE '%timeout%' OR Description LIKE '%failed%'
   ❌ WRONG: WHERE Status = 'Error' (too narrow, might miss variations)

7. **QUERY RESTRICTIONS**:
   - ONLY generate SELECT statements
   - DO NOT use INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, or any data modification commands
   - This is a read-only system for data analysis and reporting only
   - All queries must be safe and non-destructive

8. **CONVERSATION CONTEXT**:
   - Pay attention to conversation history
   - If the question references previous context (userId, statusId, etc.), incorporate those values
   - Use previous findings to inform current query strategy

Guidelines:
- Break complex questions into 2-4 logical steps
- Each step should build on previous results
- Use proper ${databaseType} SQL syntax
- Copy column and table names EXACTLY as they appear in the schema
- ALWAYS include row limit clauses appropriate for the database type
- Use semantic search patterns (LIKE, IN) for flexible matching
- Start with exploration (10-20 rows), then refine with more data
- Specify dependencies clearly using "dependsOn" array
- Include clear reasoning for each step

Return only valid JSON matching the schema structure above.
    `.trim();
};
