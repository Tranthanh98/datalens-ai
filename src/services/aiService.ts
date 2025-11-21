// /* eslint-disable @typescript-eslint/no-explicit-any */
// /**
//  * AI Service using Google Gemini for intelligent SQL query generation
//  * Implements multi-step reasoning to handle complex database queries
//  *
//  * IMPROVEMENTS:
//  * 1. Better error handling and recovery
//  * 2. Enhanced step dependency management
//  * 3. Improved context passing between steps
//  * 4. Better SQL validation and safety checks
//  * 5. Enhanced conversation context handling
//  * 6. Optimized refinement logic
//  * 7. Better chart data extraction
//  * 8. Improved schema cleaning with batch processing
//  */

// import { GoogleGenAI, Type } from "@google/genai";
// import type { QueryPlanStep as EventQueryPlanStep } from "../utils/queryPlanEvents";
// import { queryPlanEvents } from "../utils/queryPlanEvents";
// import { searchSimilarTables } from "./schemaSearchService";

// // Initialize Gemini AI
// const ai = new GoogleGenAI({
//   apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
// });

// /**
//  * Response schemas for structured output
//  */
// const QUERY_PLAN_SCHEMA = {
//   type: Type.OBJECT,
//   properties: {
//     question: {
//       type: Type.STRING,
//       description: "Original user question",
//     },
//     intent: {
//       type: Type.STRING,
//       description: "Analyzed intent of the query",
//     },
//     databaseType: {
//       type: Type.STRING,
//       description: "Database type (postgresql, mysql, etc.)",
//     },
//     steps: {
//       type: Type.ARRAY,
//       items: {
//         type: Type.OBJECT,
//         properties: {
//           id: {
//             type: Type.STRING,
//             description: "Unique step identifier",
//           },
//           type: {
//             type: Type.STRING,
//             description: "Step type: query, analysis, or aggregation",
//           },
//           description: {
//             type: Type.STRING,
//             description: "Human readable description of the step",
//           },
//           sql: {
//             type: Type.STRING,
//             description: "SQL query to execute",
//           },
//           dependsOn: {
//             type: Type.ARRAY,
//             items: {
//               type: Type.STRING,
//             },
//             description: "Array of step IDs this step depends on",
//           },
//           reasoning: {
//             type: Type.STRING,
//             description: "Explanation of why this step is needed",
//           },
//         },
//         required: [
//           "id",
//           "type",
//           "description",
//           "sql",
//           "dependsOn",
//           "reasoning",
//         ],
//       },
//     },
//   },
//   required: ["question", "intent", "databaseType", "steps"],
// };

// const REFINEMENT_SCHEMA = {
//   type: Type.OBJECT,
//   properties: {
//     shouldRefine: {
//       type: Type.BOOLEAN,
//       description: "Whether the plan needs refinement",
//     },
//     reasoning: {
//       type: Type.STRING,
//       description: "Explanation of why refinement is or isn't needed",
//     },
//     newSteps: {
//       type: Type.ARRAY,
//       items: {
//         type: Type.OBJECT,
//         properties: {
//           id: { type: Type.STRING },
//           type: { type: Type.STRING },
//           description: { type: Type.STRING },
//           sql: { type: Type.STRING },
//           dependsOn: {
//             type: Type.ARRAY,
//             items: { type: Type.STRING },
//           },
//           reasoning: { type: Type.STRING },
//         },
//         required: [
//           "id",
//           "type",
//           "description",
//           "sql",
//           "dependsOn",
//           "reasoning",
//         ],
//       },
//       description: "Additional steps to add to the plan",
//     },
//     modifiedSteps: {
//       type: Type.ARRAY,
//       items: {
//         type: Type.OBJECT,
//         properties: {
//           id: { type: Type.STRING },
//           type: { type: Type.STRING },
//           description: { type: Type.STRING },
//           sql: { type: Type.STRING },
//           dependsOn: {
//             type: Type.ARRAY,
//             items: { type: Type.STRING },
//           },
//           reasoning: { type: Type.STRING },
//         },
//         required: [
//           "id",
//           "type",
//           "description",
//           "sql",
//           "dependsOn",
//           "reasoning",
//         ],
//       },
//       description: "Existing steps to modify",
//     },
//   },
//   required: ["shouldRefine", "reasoning", "newSteps", "modifiedSteps"],
// };

// // NEW: SQL Validation Schema
// const SQL_VALIDATION_SCHEMA = {
//   type: Type.OBJECT,
//   properties: {
//     isValid: {
//       type: Type.BOOLEAN,
//       description: "Whether the SQL is valid and safe",
//     },
//     issues: {
//       type: Type.ARRAY,
//       items: {
//         type: Type.OBJECT,
//         properties: {
//           severity: {
//             type: Type.STRING,
//             description: "error, warning, or info",
//           },
//           message: {
//             type: Type.STRING,
//             description: "Description of the issue",
//           },
//         },
//       },
//     },
//     correctedSQL: {
//       type: Type.STRING,
//       description: "Corrected SQL if issues were found",
//     },
//   },
//   required: ["isValid", "issues"],
// };

// // AI model interface
// interface AIModel {
//   generateContent(options: {
//     model: string;
//     contents: string;
//   }): Promise<{ text: string }>;
// }

// // Gemini AI model wrapper
// const model: AIModel = {
//   async generateContent(options: { model: string; contents: string }) {
//     try {
//       const response = await ai.models.generateContent({
//         model: options.model,
//         contents: options.contents,
//       });
//       return { text: response.text || "" };
//     } catch (error) {
//       console.error("Gemini AI error:", error);
//       throw error;
//     }
//   },
// };

// /**
//  * Types for AI query planning and execution
//  */
// export interface QueryStep {
//   id: string;
//   type: "query" | "analysis" | "aggregation";
//   description: string;
//   sql?: string;
//   result?: any;
//   error?: string; // NEW: Track errors per step
//   dependencies?: string[];
//   executionTime?: number; // NEW: Track execution time
//   rowCount?: number; // NEW: Track result size
// }

// export interface ChartData {
//   type: "bar" | "pie" | "line" | "none";
//   data: Array<{ name: string; value: number; [key: string]: any }>;
//   xAxisKey?: string;
//   yAxisKey?: string;
//   description?: string;
// }

// export interface ConversationContext {
//   question: string;
//   answer: string;
//   sqlQuery?: string;
//   keyFindings?: string[];
//   timestamp?: number; // NEW: Track when context was created
// }

// export interface QueryPlan {
//   id: string;
//   question: string;
//   intent: string;
//   steps: QueryStep[];
//   context: Array<{ step: QueryStep; result: any; timestamp?: number }>; // NEW: Add timestamp
//   conversationHistory?: ConversationContext[];
//   finalAnswer?: string;
//   finalSQL?: string;
//   chartData?: ChartData;
//   databaseType: string;
//   totalExecutionTime?: number; // NEW: Track total time
//   successfulSteps?: number; // NEW: Track success rate
//   failedSteps?: number; // NEW: Track failure rate
// }

// /**
//  * AI Service class for intelligent SQL generation
//  */
// export class AIService {
//   /**
//    * Generate initial query plan from user question
//    */
//   static async generatePlan(
//     question: string,
//     schema: any,
//     databaseType: string = "postgresql",
//     conversationHistory: ConversationContext[] = []
//   ): Promise<QueryPlan> {
//     try {
//       const prompt = this.buildPlanPrompt(
//         question,
//         schema,
//         databaseType,
//         conversationHistory
//       );
//       const result = await ai.models.generateContent({
//         model: "gemini-2.5-flash",
//         contents: prompt,
//         config: {
//           responseMimeType: "application/json",
//           responseSchema: QUERY_PLAN_SCHEMA,
//         },
//       });

//       // Parse structured JSON response
//       const planData = JSON.parse(result.text || "{}");

//       // Convert to QueryPlan object
//       const plan: QueryPlan = {
//         id: `plan_${Date.now()}`,
//         question: planData.question,
//         intent: planData.intent,
//         databaseType: planData.databaseType,
//         steps: planData.steps.map((step: any) => ({
//           ...step,
//           dependencies: step.dependsOn || [], // Normalize to dependencies
//         })),
//         context: [],
//         conversationHistory,
//         successfulSteps: 0,
//         failedSteps: 0,
//         totalExecutionTime: 0,
//       };

//       return plan;
//     } catch (error) {
//       console.error("Error generating AI plan:", error);
//       throw new Error("Failed to generate query plan");
//     }
//   }

//   /**
//    * NEW: Validate SQL query for safety and correctness
//    */
//   private static async validateSQL(
//     sql: string,
//     databaseType: string,
//     schema: any
//   ): Promise<{ isValid: boolean; issues: any[]; correctedSQL?: string }> {
//     try {
//       const prompt = `
// You are a SQL validator. Check if this SQL query is safe, correct, and follows best practices.

// DATABASE TYPE: ${databaseType}
// SCHEMA: ${JSON.stringify(schema, null, 2)}
// SQL QUERY:
// ${sql}

// Check for:
// 1. SQL injection risks
// 2. Missing LIMIT/TOP clauses (queries should limit results)
// 3. Syntax errors
// 4. Invalid column or table names
// 5. Dangerous operations (DELETE, DROP, UPDATE without proper conditions)
// 6. Performance issues (SELECT * on large tables, missing indexes hints)

// Return validation result with any issues found and corrected SQL if needed.
//       `.trim();

//       const result = await ai.models.generateContent({
//         model: "gemini-2.5-flash",
//         contents: prompt,
//         config: {
//           responseMimeType: "application/json",
//           responseSchema: SQL_VALIDATION_SCHEMA,
//         },
//       });

//       return JSON.parse(result.text || '{"isValid": true, "issues": []}');
//     } catch (error) {
//       console.error("Error validating SQL:", error);
//       // Default to allowing the query if validation fails
//       return { isValid: true, issues: [] };
//     }
//   }

//   /**
//    * IMPROVED: Refine query plan based on execution context and results
//    * Now includes better context analysis and smarter refinement decisions
//    */
//   static async refinePlan(plan: QueryPlan, schema: any): Promise<QueryPlan> {
//     try {
//       // NEW: Only refine if we have context to work with
//       if (plan.context.length === 0) {
//         return plan;
//       }

//       // NEW: Don't refine if all steps completed successfully
//       const pendingSteps = plan.steps.filter(
//         (step) => !step.result && !step.error
//       );
//       if (pendingSteps.length === 0) {
//         return plan;
//       }

//       const prompt = this.buildRefinementPrompt(plan, schema);
//       const result = await ai.models.generateContent({
//         model: "gemini-2.5-flash",
//         contents: prompt,
//         config: {
//           responseMimeType: "application/json",
//           responseSchema: REFINEMENT_SCHEMA,
//         },
//       });

//       // Parse structured JSON response
//       const refinementData = JSON.parse(result.text || "{}");

//       // Apply refinements to the plan
//       const refinedPlan = this.applyRefinements(plan, refinementData);

//       return refinedPlan;
//     } catch (error) {
//       console.error("Error refining AI plan:", error);
//       return plan; // Return original plan if refinement fails
//     }
//   }

//   /**
//    * NEW: Check if a step's dependencies are met
//    */
//   private static canExecuteStep(
//     step: QueryStep,
//     executedStepIds: Set<string>
//   ): boolean {
//     if (!step.dependencies || step.dependencies.length === 0) {
//       return true;
//     }
//     return step.dependencies.every((depId) => executedStepIds.has(depId));
//   }

//   /**
//    * NEW: Build context for step execution with results from dependencies
//    */
//   private static buildStepContext(
//     step: QueryStep,
//     plan: QueryPlan
//   ): Record<string, any> {
//     const context: Record<string, any> = {};

//     if (step.dependencies && step.dependencies.length > 0) {
//       step.dependencies.forEach((depId) => {
//         const depContext = plan.context.find((ctx) => ctx.step.id === depId);
//         if (depContext) {
//           context[depId] = depContext.result;
//         }
//       });
//     }

//     return context;
//   }

//   /**
//    * IMPROVED: Execute multi-step AI query with better dependency handling
//    */
//   static async runAIQuery(
//     question: string,
//     databaseId: number,
//     databaseType: string,
//     executeSQL: (sql: string) => Promise<any>,
//     conversationHistory: ConversationContext[] = []
//   ): Promise<{ answer: string; plan: QueryPlan }> {
//     const startTime = Date.now();

//     try {
//       if (!databaseId) {
//         throw new Error("Database ID is required");
//       }

//       // Search for similar tables using semantic search API
//       const searchResult = await searchSimilarTables(databaseId, question, 20);

//       console.log("Search result:", searchResult);

//       if (!searchResult.success || !searchResult.data) {
//         console.error(
//           "Failed to retrieve relevant schema:",
//           searchResult.error
//         );
//         throw new Error(
//           `Failed to retrieve relevant schema: ${
//             searchResult.error || "Unknown error"
//           }`
//         );
//       }

//       // Extract schema from similar tables
//       const schema = searchResult.data.map((item) => item.schema);

//       console.log(
//         `Found ${schema.length} relevant tables for question: "${question}"`
//       );

//       // Check if schema is empty
//       if (schema.length === 0) {
//         throw new Error(
//           "No relevant tables found for this query. Please ensure your database has schema embeddings generated."
//         );
//       }

//       console.log("Schema sample:", JSON.stringify(schema[0], null, 2));

//       // Step 1: AI analyzes intent and generates plan with conversation context
//       const plan = await this.generatePlan(
//         question,
//         schema,
//         databaseType,
//         conversationHistory
//       );

//       // Emit plan generated event
//       const eventSteps: EventQueryPlanStep[] = plan.steps.map((step) => ({
//         id: step.id,
//         type: step.type,
//         description: step.description,
//         sql: step.sql,
//         status: "pending" as const,
//       }));

//       queryPlanEvents.emit({
//         type: "plan_generated",
//         planId: plan.id,
//         steps: eventSteps,
//       });

//       // NEW: Track executed steps for dependency checking
//       const executedStepIds = new Set<string>();
//       const maxRetries = 3;

//       // Step 2: Execute steps in order, respecting dependencies
//       for (let i = 0; i < plan.steps.length; i++) {
//         const step = plan.steps[i];

//         // NEW: Check if dependencies are met
//         if (!this.canExecuteStep(step, executedStepIds)) {
//           console.warn(
//             `Step ${
//               step.id
//             } dependencies not met, waiting for: ${step.dependencies?.join(
//               ", "
//             )}`
//           );
//           continue;
//         }

//         if (step.type === "query" && step.sql) {
//           let retryCount = 0;
//           let stepSuccess = false;

//           while (retryCount < maxRetries && !stepSuccess) {
//             try {
//               const stepStartTime = Date.now();

//               // Emit step started event
//               queryPlanEvents.emit({
//                 type: "step_started",
//                 planId: plan.id,
//                 step: {
//                   id: step.id,
//                   type: step.type,
//                   description: step.description,
//                   sql: step.sql,
//                   status: "running",
//                 },
//               });

//               // NEW: Validate SQL before execution (optional, can be disabled for performance)
//               // const validation = await this.validateSQL(step.sql, databaseType, schema);
//               // if (!validation.isValid) {
//               //   console.warn(`SQL validation issues for step ${step.id}:`, validation.issues);
//               //   if (validation.correctedSQL) {
//               //     step.sql = validation.correctedSQL;
//               //   }
//               // }

//               // Execute SQL query
//               const result = await executeSQL(step.sql);
//               const stepEndTime = Date.now();

//               step.result = result;
//               step.executionTime = stepEndTime - stepStartTime;
//               step.rowCount = result?.data?.length || 0;

//               // Add to context for next steps
//               plan.context.push({
//                 step,
//                 result,
//                 timestamp: Date.now(),
//               });

//               // Mark as executed
//               executedStepIds.add(step.id);
//               plan.successfulSteps = (plan.successfulSteps || 0) + 1;
//               stepSuccess = true;

//               // Emit step completed event
//               queryPlanEvents.emit({
//                 type: "step_completed",
//                 planId: plan.id,
//                 step: {
//                   id: step.id,
//                   type: step.type,
//                   description: step.description,
//                   sql: step.sql,
//                   status: "completed",
//                 },
//               });

//               // Step 3: Refine plan based on current results (only if needed)
//               // NEW: Only refine after every 2 steps or if step returned unexpected results
//               const shouldRefine =
//                 (i + 1) % 2 === 0 ||
//                 step.rowCount === 0 ||
//                 (step.rowCount && step.rowCount > 1000);

//               if (
//                 shouldRefine &&
//                 plan.steps.indexOf(step) < plan.steps.length - 1
//               ) {
//                 const refinedPlan = await this.refinePlan(plan, schema);
//                 // Update remaining steps with refined plan
//                 Object.assign(plan, refinedPlan);
//               }
//             } catch (sqlError) {
//               console.error(
//                 `SQL execution error for step ${step.id} (attempt ${
//                   retryCount + 1
//                 }/${maxRetries}):`,
//                 sqlError
//               );
//               const errorMessage =
//                 sqlError instanceof Error ? sqlError.message : String(sqlError);

//               // NEW: Try to refine SQL on error
//               if (retryCount < maxRetries - 1) {
//                 try {
//                   const errorContext = {
//                     ...plan,
//                     context: [
//                       ...plan.context,
//                       {
//                         step: { ...step, error: errorMessage },
//                         result: { error: errorMessage },
//                         timestamp: Date.now(),
//                       },
//                     ],
//                   };
//                   const refinedPlan = await this.refinePlan(
//                     errorContext,
//                     schema
//                   );

//                   // Update the SQL for retry
//                   const modifiedStep = refinedPlan.steps.find(
//                     (s) => s.id === step.id
//                   );
//                   if (modifiedStep?.sql && modifiedStep.sql !== step.sql) {
//                     console.log(`Retrying step ${step.id} with refined SQL...`);
//                     step.sql = modifiedStep.sql;
//                     retryCount++;
//                     continue;
//                   }
//                 } catch (refinementError) {
//                   console.error("Failed to refine SQL:", refinementError);
//                 }
//               }

//               // If all retries failed, record the error
//               step.error = errorMessage;
//               step.result = { error: errorMessage };
//               plan.context.push({
//                 step,
//                 result: step.result,
//                 timestamp: Date.now(),
//               });
//               plan.failedSteps = (plan.failedSteps || 0) + 1;

//               // Emit step error event
//               queryPlanEvents.emit({
//                 type: "step_error",
//                 planId: plan.id,
//                 step: {
//                   id: step.id,
//                   type: step.type,
//                   description: step.description,
//                   sql: step.sql,
//                   status: "error",
//                 },
//                 error: errorMessage,
//               });

//               // Exit retry loop
//               break;
//             }
//           }
//         }
//       }

//       // NEW: Calculate total execution time
//       plan.totalExecutionTime = Date.now() - startTime;

//       // Generate final answer based on all results
//       const finalAnswer = await this.generateFinalAnswer(plan);
//       plan.finalAnswer = finalAnswer;

//       // Extract final SQL from the last successfully executed step
//       const lastExecutedStep = plan.steps
//         .filter((step) => step.sql && step.result && !step.error)
//         .pop();
//       if (lastExecutedStep?.sql) {
//         plan.finalSQL = lastExecutedStep.sql;
//       }

//       // Emit plan completed event
//       queryPlanEvents.emit({
//         type: "plan_completed",
//         planId: plan.id,
//       });

//       return { answer: finalAnswer, plan };
//     } catch (error) {
//       console.error("Error running AI query:", error);
//       throw error;
//     }
//   }

//   /**
//    * IMPROVED: Apply refinements with better validation
//    */
//   private static applyRefinements(
//     plan: QueryPlan,
//     refinementData: any
//   ): QueryPlan {
//     if (!refinementData.shouldRefine) {
//       return plan;
//     }

//     const refinedPlan = { ...plan };

//     // Add new steps (ensure they have unique IDs)
//     if (refinementData.newSteps && refinementData.newSteps.length > 0) {
//       const existingIds = new Set(refinedPlan.steps.map((s) => s.id));
//       const newSteps = refinementData.newSteps.filter(
//         (step: QueryStep) => !existingIds.has(step.id)
//       );

//       if (newSteps.length > 0) {
//         refinedPlan.steps = [...refinedPlan.steps, ...newSteps];
//       }
//     }

//     // Modify existing steps (only modify steps that haven't been executed yet)
//     if (
//       refinementData.modifiedSteps &&
//       refinementData.modifiedSteps.length > 0
//     ) {
//       refinementData.modifiedSteps.forEach((modifiedStep: any) => {
//         const index = refinedPlan.steps.findIndex(
//           (step) => step.id === modifiedStep.id
//         );
//         if (index !== -1 && !refinedPlan.steps[index].result) {
//           // Only modify if not yet executed
//           refinedPlan.steps[index] = {
//             ...refinedPlan.steps[index],
//             ...modifiedStep,
//           };
//         }
//       });
//     }

//     return refinedPlan;
//   }

//   /**
//    * Build prompt for initial plan generation
//    */
//   private static buildPlanPrompt(
//     question: string,
//     schema: any,
//     databaseType: string,
//     conversationHistory: ConversationContext[] = []
//   ): string {
//     // NEW: Limit conversation history to last 5 exchanges for context efficiency
//     const recentHistory = conversationHistory.slice(-5);

//     // Build conversation history context
//     const historyContext =
//       recentHistory.length > 0
//         ? `
// CONVERSATION HISTORY (Last ${recentHistory.length} exchanges):
// ${recentHistory
//   .map(
//     (ctx, idx) => `
// ${idx + 1}. USER ASKED: "${ctx.question}"
//    AI ANSWERED: ${ctx.answer.substring(0, 200)}...
//    SQL USED: ${ctx.sqlQuery || "N/A"}
//    KEY FINDINGS: ${ctx.keyFindings?.join(", ") || "N/A"}
// `
//   )
//   .join("\n")}

// IMPORTANT: Use the context from previous questions to inform your current query.
// - If the user refers to "it", "them", "that user", etc., check the conversation history
// - Reuse filters, IDs, or conditions from previous queries when relevant
// - The current question may be a follow-up that assumes context from above
// `
//         : "";

//     return `
// You are an expert SQL analyst. Analyze the user's question and create a step-by-step query plan.

// DATABASE TYPE: ${databaseType}
// DATABASE SCHEMA:
// ${JSON.stringify(schema, null, 2)}

// ${historyContext}

// CURRENT USER QUESTION: "${question}"

// Create a JSON response with this structure:
// {
//   "question": "${question}",
//   "intent": "Brief description of what user wants",
//   "databaseType": "${databaseType}",
//   "steps": [
//     {
//       "id": "step_1",
//       "type": "query|analysis|aggregation",
//       "description": "What this step does",
//       "sql": "SQL query for this step",
//       "dependsOn": ["step_ids this depends on"],
//       "reasoning": "Why this step is needed"
//     }
//   ]
// }

// ⚠️ CRITICAL SQL RULES - MUST FOLLOW:

// 1. **QUERY PLANNING STRATEGY**:
//    - Break complex questions into 2-4 logical steps maximum
//    - Each step should have a clear purpose (exploration, filtering, aggregation, final result)
//    - Steps should build on each other (use dependsOn to specify dependencies)
//    - First step: Explore data (LIMIT 10-20 rows)
//    - Middle steps: Filter and refine based on findings
//    - Final step: Get comprehensive answer with appropriate limit

// 2. **STEP DEPENDENCIES**:
//    - Use "dependsOn": [] to specify which steps must complete first
//    - Example: step_2 depends on step_1: "dependsOn": ["step_1"]
//    - Steps with no dependencies will execute first
//    - This enables parallel execution where possible

// 3. **COLUMN NAMES**: Use EXACT column names from the schema above
//    - DO NOT change case (e.g., keep "Logins_LoginId", not "loginId" or "logins_loginid")
//    - DO NOT convert snake_case to camelCase (e.g., keep "user_id", not "userId")
//    - DO NOT translate or rename columns
//    - DO NOT add spaces or remove underscores
//    - If schema shows "Orders.Logins_LoginId", use exactly "Logins_LoginId" in your SQL

// 4. **TABLE NAMES**: Use EXACT table names from the schema
//    - DO NOT change case (e.g., keep "Orders", not "orders" or "ORDERS")
//    - DO NOT rename or translate tables
//    - Use the exact spelling provided in the schema

// 5. **ALWAYS USE LIMIT/TOP**: NEVER query all rows without limits
//    - Use proper syntax for ${databaseType}:
//      * SQL Server (mssql): SELECT TOP N ...
//      * PostgreSQL/MySQL: SELECT ... LIMIT N
//      * Oracle: SELECT ... FETCH FIRST N ROWS ONLY
//    - Default limits based on query type:
//      * Exploration queries (step 1): 10-20 rows
//      * Filtering queries (middle steps): 20-50 rows
//      * Final aggregation: 10-20 rows
//      * COUNT queries: Can query all but filter with WHERE first
//    - ALWAYS include appropriate limit clause for the database type

// 6. **USE SEMANTIC SEARCH PATTERNS**: Query by meaning, not exact match
//    - For status/error searches: Use LIKE with wildcards for broader context
//    - For text searches: Use pattern matching to capture variations
//    - For categorical data: Consider using IN with multiple related values

//    Examples:
//    ✅ CORRECT: WHERE Status LIKE '%Error%' OR Status LIKE '%Failed%' OR Status LIKE '%Exception%'
//    ✅ CORRECT: WHERE StatusName IN ('Error', 'Failed', 'Timeout', 'Exception')
//    ✅ CORRECT: WHERE Description LIKE '%timeout%' OR Description LIKE '%failed%'
//    ❌ WRONG: WHERE Status = 'Error' (too narrow, might miss variations)

// 7. **QUERY RESTRICTIONS**:
//    - ONLY generate SELECT statements
//    - DO NOT use INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, or any data modification commands
//    - This is a read-only system for data analysis and reporting only
//    - All queries must be safe and non-destructive

// 8. **CONVERSATION CONTEXT**:
//    - Pay attention to conversation history
//    - If the question references previous context (userId, statusId, etc.), incorporate those values
//    - Use previous findings to inform current query strategy

// Guidelines:
// - Break complex questions into 2-4 logical steps
// - Each step should build on previous results
// - Use proper ${databaseType} SQL syntax
// - Copy column and table names EXACTLY as they appear in the schema
// - ALWAYS include row limit clauses appropriate for the database type
// - Use semantic search patterns (LIKE, IN) for flexible matching
// - Start with exploration (10-20 rows), then refine with more data
// - Specify dependencies clearly using "dependsOn" array
// - Include clear reasoning for each step

// Return only valid JSON matching the schema structure above.
//     `.trim();
//   }

//   /**
//    * IMPROVED: Build prompt for plan refinement with better context
//    */
//   private static buildRefinementPrompt(plan: QueryPlan, schema: any): string {
//     // NEW: Build more detailed context summary
//     const contextSummary = plan.context.map((ctx) => {
//       const hasError = ctx.step.error || ctx.result?.error;
//       return {
//         stepId: ctx.step.id,
//         type: ctx.step.type,
//         description: ctx.step.description,
//         status: hasError ? "failed" : "success",
//         error: hasError ? ctx.step.error || ctx.result?.error : undefined,
//         rowCount: ctx.step.rowCount || ctx.result?.data?.length || 0,
//         executionTime: ctx.step.executionTime,
//         hasData: ctx.result?.data && ctx.result.data.length > 0,
//       };
//     });

//     // NEW: Identify completed and pending steps
//     const completedStepIds = new Set(plan.context.map((ctx) => ctx.step.id));
//     const pendingSteps = plan.steps.filter(
//       (step) => !completedStepIds.has(step.id)
//     );

//     // Extract default schema for database type
//     const getDefaultSchema = (dbType: string): string => {
//       switch (dbType.toLowerCase()) {
//         case "mssql":
//         case "sqlserver":
//           return "dbo";
//         case "postgresql":
//         case "postgres":
//           return "public";
//         case "mysql":
//           return "mysql";
//         case "oracle":
//           return "public";
//         default:
//           return "dbo";
//       }
//     };

//     const defaultSchema = getDefaultSchema(plan.databaseType);

//     return `
// You are refining a multi-step query plan based on execution results.

// DATABASE TYPE: ${plan.databaseType}
// DEFAULT SCHEMA: ${defaultSchema}
// DATABASE SCHEMA:
// ${JSON.stringify(schema, null, 2)}

// ORIGINAL QUESTION: "${plan.question}"
// ORIGINAL INTENT: ${plan.intent}

// EXECUTION SUMMARY:
// - Total Steps: ${plan.steps.length}
// - Completed: ${contextSummary.length}
// - Pending: ${pendingSteps.length}
// - Successful: ${contextSummary.filter((s) => s.status === "success").length}
// - Failed: ${contextSummary.filter((s) => s.status === "failed").length}

// COMPLETED STEPS ANALYSIS:
// ${JSON.stringify(contextSummary, null, 2)}

// PENDING STEPS:
// ${JSON.stringify(
//   pendingSteps.map((s) => ({
//     id: s.id,
//     type: s.type,
//     description: s.description,
//     sql: s.sql,
//     dependsOn: s.dependencies,
//   })),
//   null,
//   2
// )}

// Based on the execution results, analyze if the pending steps need modification or if new steps are needed.

// ⚠️ CRITICAL REFINEMENT RULES:

// 1. **WHEN TO REFINE**:
//    - If a step failed: Modify it with corrected SQL
//    - If a step returned 0 rows: Check if query was too restrictive, broaden the search
//    - If a step returned >1000 rows: Add filtering steps or modify to be more specific
//    - If results don't fully answer the question: Add new steps to complete the analysis
//    - If all steps succeeded and fully answer the question: shouldRefine = false

// 2. **COLUMN/TABLE NAMES**: Use EXACT names from schema and original plan
//    - DO NOT change case, format, or translate any identifiers
//    - Copy names EXACTLY as they appear in the database schema

// 3. **TABLE NAMES WITH SCHEMA**: ALWAYS include schema prefix
//    - MANDATORY format: [schema].[tableName] or schema.tableName
//    - Use default schema "${defaultSchema}" if not specified
//    - Examples for ${plan.databaseType}:
//      * ✅ SELECT TOP 10 * FROM ${defaultSchema}.Users
//      * ✅ SELECT u.* FROM ${defaultSchema}.Users u JOIN ${defaultSchema}.Orders o ON u.Id = o.UserId
//      * ❌ SELECT * FROM Users (missing schema)

// 4. **ALWAYS USE LIMIT/TOP**:
//    - Every SELECT must have appropriate row limit
//    - Use correct syntax for ${plan.databaseType}
//    - Adjust limits based on previous results:
//      * If previous step had 0 rows: Increase limit or broaden WHERE clause
//      * If previous step had many rows: Decrease limit or add filters

// 5. **ERROR RECOVERY STRATEGIES**:
//    - Column not found: Check schema for correct column name
//    - Table not found: Verify schema prefix is included
//    - Syntax error: Check database-specific SQL syntax
//    - Permission denied: Ensure only SELECT queries are used
//    - Timeout: Add more specific WHERE clauses or reduce limit

// 6. **STEP DEPENDENCIES**:
//    - New steps must specify correct "dependsOn" array
//    - Don't create circular dependencies
//    - Modified steps should maintain their original dependencies

// 7. **QUERY RESTRICTIONS**:
//    - ONLY use SELECT statements
//    - NO data modification commands (INSERT, UPDATE, DELETE, etc.)
//    - All queries must be safe and read-only

// 8. **SMART REFINEMENT**:
//    - Don't modify steps that succeeded unless their results indicate a need
//    - Focus refinement on failed steps or gaps in data coverage
//    - Consider adding aggregation steps if raw data needs summarization
//    - If question is fully answered, set shouldRefine = false

// Return JSON with:
// {
//   "shouldRefine": true/false,
//   "reasoning": "Clear explanation of why refinement is/isn't needed based on execution results",
//   "newSteps": [
//     // New steps to add (each with SELECT query only, exact names, schema prefix, proper limit)
//     {
//       "id": "step_X",
//       "type": "query|analysis|aggregation",
//       "description": "What this new step does",
//       "sql": "SELECT ... with schema prefix and LIMIT/TOP",
//       "dependsOn": ["step_ids"],
//       "reasoning": "Why this step is needed"
//     }
//   ],
//   "modifiedSteps": [
//     // Existing steps to modify (only pending or failed steps)
//     {
//       "id": "existing_step_id",
//       "type": "query|analysis|aggregation",
//       "description": "Updated description if needed",
//       "sql": "Corrected SELECT query with schema prefix and LIMIT/TOP",
//       "dependsOn": ["step_ids"],
//       "reasoning": "Why this modification is needed"
//     }
//   ]
// }

// **CRITICAL**:
// - Ensure all SQL uses exact column/table names with schema prefixes
// - Include LIMIT/TOP in every SELECT query
// - Only use SELECT statements
// - Focus on fixing actual issues, don't over-refine

// Return only valid JSON matching the refinement schema.
//     `.trim();
//   }

//   /**
//    * IMPROVED: Generate final answer with better chart extraction
//    */
//   private static async generateFinalAnswer(plan: QueryPlan): Promise<string> {
//     try {
//       // NEW: Build execution summary for context
//       const executionSummary = {
//         totalSteps: plan.steps.length,
//         successfulSteps: plan.successfulSteps || 0,
//         failedSteps: plan.failedSteps || 0,
//         totalExecutionTime: plan.totalExecutionTime || 0,
//         totalRows: plan.context.reduce(
//           (sum, ctx) => sum + (ctx.step.rowCount || 0),
//           0
//         ),
//       };

//       const prompt = `
// You are generating a comprehensive answer to a database query with professional formatting and visualization suggestions.

// ORIGINAL QUESTION: "${plan.question}"
// QUERY INTENT: ${plan.intent}

// EXECUTION SUMMARY:
// - Total Steps Executed: ${executionSummary.totalSteps}
// - Successful: ${executionSummary.successfulSteps}
// - Failed: ${executionSummary.failedSteps}
// - Total Execution Time: ${executionSummary.totalExecutionTime}ms
// - Total Rows Retrieved: ${executionSummary.totalRows}

// DETAILED EXECUTION RESULTS:
// ${plan.context
//   .map(
//     (ctx, idx) => `
// Step ${idx + 1}: ${ctx.step.description}
// Type: ${ctx.step.type}
// SQL: ${ctx.step.sql}
// Status: ${ctx.step.error ? "❌ FAILED" : "✅ SUCCESS"}
// ${ctx.step.error ? `Error: ${ctx.step.error}` : ""}
// ${ctx.step.executionTime ? `Execution Time: ${ctx.step.executionTime}ms` : ""}
// ${ctx.step.rowCount !== undefined ? `Rows: ${ctx.step.rowCount}` : ""}
// Result: ${JSON.stringify(ctx.result, null, 2).substring(0, 1000)}${
//       JSON.stringify(ctx.result, null, 2).length > 1000 ? "..." : ""
//     }
// `
//   )
//   .join("\n---\n")}

// INSTRUCTIONS:
// Your response MUST have TWO sections:

// 1. **MARKDOWN ANSWER** - Professional formatted answer with:
//    - Clear heading (# Query Results)
//    - Executive summary paragraph
//    - Key findings with bullet points or numbered lists
//    - Data tables (if applicable) using markdown tables
//    - Insights and analysis section
//    - Note any errors or limitations at the end

// 2. **CHART DATA BLOCK** - After your markdown, include:
// \`\`\`chartdata
// {
//   "type": "bar|pie|line|none",
//   "data": [...],
//   "xAxisKey": "...",
//   "yAxisKey": "...",
//   "description": "..."
// }
// \`\`\`

// FORMAT GUIDELINES FOR MARKDOWN:
// - Use # for main heading, ## for sections, ### for subsections
// - Use **bold** for emphasis on key numbers/findings
// - Use tables for structured data comparison
// - Use bullet points (- or *) for lists
// - Use code blocks for SQL if relevant
// - Use > for important notes or warnings
// - Keep it concise but comprehensive

// CHART DATA GUIDELINES:
// - **"bar"**: Best for comparing categories, time series with few periods (2-20 data points)
//   * Use when comparing quantities across different categories
//   * Example: Sales by region, orders by status, users by country

// - **"pie"**: Best for showing proportions/percentages (3-8 slices max)
//   * Use when showing parts of a whole
//   * Example: Market share, order status distribution, user type breakdown
//   * Avoid if there are too many categories (>8) or very similar values

// - **"line"**: Best for trends over time (5+ time points)
//   * Use for time series data
//   * Example: Sales over months, user growth, daily orders

// - **"none"**: When data isn't suitable for visualization
//   * Use for: Single values, very detailed text data, error results, non-numeric data
//   * Use if: Less than 2 data points, data is not comparable

// CHART DATA EXTRACTION RULES:
// 1. Analyze the query results and extract numeric data suitable for charts
// 2. For bar charts: Extract category names and their values
//    - data: [{"name": "Category1", "value": 123}, {"name": "Category2", "value": 456}]
// 3. For pie charts: Calculate percentages if needed
//    - data: [{"name": "Status A", "value": 45}, {"name": "Status B", "value": 55}]
// 4. For line charts: Extract time series or sequential data
//    - data: [{"name": "Jan", "value": 100}, {"name": "Feb", "value": 150}]
// 5. Limit data points to 20 maximum for readability
// 6. Use clear, human-readable names (not column names like "col_1")
// 7. If multiple numeric columns exist, choose the most relevant one for the chart

// EXAMPLE RESPONSE FORMAT:

// # Query Results for "${plan.question}"

// ## Summary
// Based on the analysis of ${executionSummary.totalRows} records across ${
//         executionSummary.successfulSteps
//       } query steps, here's what I found...

// ## Key Findings
// - **Finding 1**: [Insight with data]
// - **Finding 2**: [Insight with data]
// - **Finding 3**: [Insight with data]

// ## Detailed Analysis
// [More detailed explanation of results]

// ### Data Breakdown
// | Category | Count | Percentage |
// |----------|-------|------------|
// | Item 1   | 100   | 45%        |
// | Item 2   | 120   | 55%        |

// ## Insights & Recommendations
// [Analysis, patterns, recommendations]

// ---
// *Query completed in ${executionSummary.totalExecutionTime}ms | ${
//         executionSummary.totalRows
//       } rows analyzed*
// ${
//   executionSummary.failedSteps > 0
//     ? `\n> ⚠️ Note: ${executionSummary.failedSteps} step(s) encountered errors`
//     : ""
// }

// \`\`\`chartdata
// {
//   "type": "bar",
//   "data": [
//     {"name": "Category 1", "value": 100},
//     {"name": "Category 2", "value": 120}
//   ],
//   "xAxisKey": "name",
//   "yAxisKey": "value",
//   "description": "Distribution of [metric] across [categories]"
// }
// \`\`\`

// NOW GENERATE YOUR RESPONSE:
//       `.trim();

//       const result = await model.generateContent({
//         model: "gemini-2.5-flash",
//         contents: prompt,
//       });

//       const fullResponse =
//         result.text ||
//         "# Unable to Generate Answer\n\nI couldn't generate a comprehensive answer based on the query results. Please try rephrasing your question or check your database connection.";

//       // Extract chart data from response
//       const chartDataMatch = fullResponse.match(/```chartdata\n([\s\S]*?)```/);
//       if (chartDataMatch) {
//         try {
//           const chartDataText = chartDataMatch[1].trim();
//           const chartData = JSON.parse(chartDataText);

//           // NEW: Validate chart data structure
//           if (
//             chartData.type &&
//             chartData.data &&
//             Array.isArray(chartData.data)
//           ) {
//             plan.chartData = chartData;
//             console.log("Chart data extracted successfully:", chartData.type);
//           } else {
//             console.warn("Invalid chart data structure");
//           }
//         } catch (e) {
//           console.warn("Failed to parse chart data:", e);
//         }
//       }

//       // Return response without the chartdata block
//       return fullResponse.replace(/```chartdata\n[\s\S]*?```/, "").trim();
//     } catch (error) {
//       console.error("Error generating final answer:", error);

//       // NEW: Generate fallback answer from context
//       const successfulSteps = plan.context.filter((ctx) => !ctx.step.error);
//       if (successfulSteps.length > 0) {
//         return `# Query Results\n\n## Summary\nExecuted ${
//           successfulSteps.length
//         } successful query steps for: "${
//           plan.question
//         }"\n\n## Results\n${successfulSteps
//           .map(
//             (ctx, idx) =>
//               `### Step ${idx + 1}: ${
//                 ctx.step.description
//               }\n\`\`\`json\n${JSON.stringify(ctx.result, null, 2).substring(
//                 0,
//                 500
//               )}\n\`\`\`\n`
//           )
//           .join("\n")}`;
//       }

//       return "# Error\n\nUnable to generate a comprehensive answer based on the query results.";
//     }
//   }
// }

// /**
//  * Schema cleaning and enrichment response schema
//  */
// const SCHEMA_CLEANING_SCHEMA = {
//   type: Type.OBJECT,
//   properties: {
//     cleanedSchema: {
//       type: Type.ARRAY,
//       items: {
//         type: Type.OBJECT,
//         properties: {
//           tableName: {
//             type: Type.STRING,
//             description: "Name of the table",
//           },
//           tableDescription: {
//             type: Type.STRING,
//             description:
//               "Clear description of table's purpose and business context",
//           },
//           isRelevant: {
//             type: Type.BOOLEAN,
//             description: "Whether this table is relevant for business queries",
//           },
//           category: {
//             type: Type.STRING,
//             description:
//               "Business category (e.g., 'Sales', 'Users', 'Products', 'Analytics', 'System')",
//           },
//           columns: {
//             type: Type.ARRAY,
//             items: {
//               type: Type.OBJECT,
//               properties: {
//                 columnName: {
//                   type: Type.STRING,
//                   description: "Column name",
//                 },
//                 dataType: {
//                   type: Type.STRING,
//                   description: "SQL data type",
//                 },
//                 isPrimaryKey: {
//                   type: Type.BOOLEAN,
//                   description: "Whether column is a primary key",
//                 },
//                 isForeignKey: {
//                   type: Type.BOOLEAN,
//                   description: "Whether column is a foreign key",
//                 },
//                 referencedTable: {
//                   type: Type.STRING,
//                   description: "Referenced table if foreign key",
//                 },
//                 isNullable: {
//                   type: Type.BOOLEAN,
//                   description: "Whether column allows NULL",
//                 },
//                 description: {
//                   type: Type.STRING,
//                   description:
//                     "Clear, business-friendly description of the column",
//                 },
//                 isRelevant: {
//                   type: Type.BOOLEAN,
//                   description: "Whether this column is useful for queries",
//                 },
//               },
//               required: ["columnName", "dataType", "description", "isRelevant"],
//             },
//           },
//           primaryKey: {
//             type: Type.ARRAY,
//             items: { type: Type.STRING },
//             description: "Primary key column names",
//           },
//           foreignKeys: {
//             type: Type.ARRAY,
//             items: {
//               type: Type.OBJECT,
//               properties: {
//                 columnName: { type: Type.STRING },
//                 referencedTable: { type: Type.STRING },
//                 referencedColumn: { type: Type.STRING },
//               },
//             },
//           },
//         },
//         required: [
//           "tableName",
//           "tableDescription",
//           "isRelevant",
//           "category",
//           "columns",
//         ],
//       },
//     },
//     removedTables: {
//       type: Type.ARRAY,
//       items: {
//         type: Type.OBJECT,
//         properties: {
//           tableName: { type: Type.STRING },
//           reason: { type: Type.STRING },
//         },
//       },
//       description: "List of tables removed and why",
//     },
//     summary: {
//       type: Type.OBJECT,
//       properties: {
//         totalTables: { type: Type.NUMBER },
//         relevantTables: { type: Type.NUMBER },
//         removedTables: { type: Type.NUMBER },
//         categories: {
//           type: Type.ARRAY,
//           items: { type: Type.STRING },
//         },
//       },
//       description: "Summary statistics",
//     },
//   },
//   required: ["cleanedSchema", "removedTables", "summary"],
// };

// /**
//  * IMPROVED: Clean and enrich database schema using AI with batch processing
//  */
// export async function cleanAndEnrichSchema(
//   rawSchema: any[],
//   databaseType: string = "postgresql"
// ): Promise<{
//   success: boolean;
//   cleanedSchema?: any[];
//   error?: string;
//   summary?: {
//     totalTables: number;
//     relevantTables: number;
//     removedTables: number;
//     categories: string[];
//   };
// }> {
//   try {
//     if (!rawSchema || rawSchema.length === 0) {
//       return {
//         success: false,
//         error: "No schema data provided",
//       };
//     }

//     // NEW: Process in batches if schema is large
//     const BATCH_SIZE = 50;
//     const batches = [];

//     for (let i = 0; i < rawSchema.length; i += BATCH_SIZE) {
//       batches.push(rawSchema.slice(i, i + BATCH_SIZE));
//     }

//     console.log(
//       `Processing ${rawSchema.length} tables in ${batches.length} batch(es)...`
//     );

//     const allCleanedSchemas = [];
//     const allRemovedTables = [];
//     let totalRelevant = 0;

//     for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
//       const batch = batches[batchIdx];
//       console.log(
//         `Processing batch ${batchIdx + 1}/${batches.length} (${
//           batch.length
//         } tables)...`
//       );

//       const prompt = `
// You are a database schema expert. Clean and enrich this database schema to optimize it for AI-powered query generation.

// DATABASE TYPE: ${databaseType}
// RAW SCHEMA (Batch ${batchIdx + 1}/${batches.length}):
// ${JSON.stringify(batch, null, 2)}

// ⚠️ CRITICAL RULES - MUST FOLLOW:
// 1. **NEVER change table names or column names** - use EXACT names from the raw schema
// 2. **NEVER rename, modify, or translate any table/column identifiers**
// 3. **ONLY add descriptions and metadata** - do not alter the actual database identifiers
// 4. **Be conservative with removal** - only remove obviously irrelevant tables (<10% removal rate)

// YOUR TASKS:
// 1. **Remove irrelevant tables** such as:
//    - System/internal tables (migrations, sessions, logs, audit trails)
//    - Temporary tables (temp_, tmp_, #)
//    - Cache tables
//    - Framework-specific tables (e.g., Django migrations, Laravel jobs, AspNet internal tables)
//    - Any tables that don't contain meaningful business data
//    - **IMPORTANT**: Delete ratio should be below 10% to preserve context

// 2. **Keep relevant tables** that contain:
//    - Business entities (users, customers, products, orders, etc.)
//    - Transaction data (sales, payments, shipments)
//    - Master data (categories, regions, statuses)
//    - Analytics/reporting data
//    - Any tables useful for business queries

// 3. **Enrich each relevant table** with:
//    - **tableName**: EXACT name from raw schema (DO NOT CHANGE)
//    - **tableDescription**: Clear, business-friendly description (2-3 sentences max)
//    - **category**: Business category (Sales, Users, Products, Finance, Analytics, Operations, etc.)
//    - **isRelevant**: true if useful for queries
//    - Mark primary keys and foreign keys accurately

// 4. **Enrich each column** with:
//    - **columnName**: EXACT name from raw schema (DO NOT CHANGE, DO NOT TRANSLATE)
//    - **dataType**: EXACT type from raw schema (DO NOT CHANGE)
//    - **description**: Clear explanation of business meaning (1 sentence)
//    - **isRelevant**: false for technical columns (created_at, updated_at, internal IDs with no business meaning)
//    - Mark primary/foreign keys

// 5. **Optimize for context**:
//    - Focus on columns that help answer business questions
//    - Mark technical audit columns as isRelevant=false
//    - Keep all columns in the structure, just mark relevance

// IMPORTANT EXAMPLES:
// ✅ CORRECT:
//   "columnName": "user_id"  // Keep exact name from database
//   "description": "Unique identifier for the user"
//   "isRelevant": true

// ❌ WRONG:
//   "columnName": "userId"   // Don't convert snake_case to camelCase
//   "columnName": "User ID"  // Don't add spaces

// ✅ CORRECT:
//   "tableName": "order_items"
//   "tableDescription": "Stores individual line items for each customer order with product details and quantities"
//   "category": "Sales"
//   "isRelevant": true

// ❌ WRONG:
//   "tableName": "OrderItems"  // Don't change casing
//   "isRelevant": false  // Don't mark business tables as irrelevant

// GUIDELINES:
// - Be selective but not overly aggressive in removing tables
// - Prioritize business value and query usefulness
// - Descriptions should be concise but informative
// - Think about what questions analysts would ask
// - **PRESERVE ALL ORIGINAL NAMES EXACTLY AS THEY ARE**
// - Categorize tables logically for better organization

// Return a JSON response following the schema structure.
//     `.trim();

//       const result = await ai.models.generateContent({
//         model: "gemini-2.5-flash",
//         contents: prompt,
//         config: {
//           responseMimeType: "application/json",
//           responseSchema: SCHEMA_CLEANING_SCHEMA,
//         },
//       });

//       const cleanedData = JSON.parse(result.text || "{}");

//       // Filter to only return relevant tables
//       const relevantTables = cleanedData.cleanedSchema.filter(
//         (table: any) => table.isRelevant
//       );

//       allCleanedSchemas.push(...relevantTables);
//       allRemovedTables.push(...cleanedData.removedTables);
//       totalRelevant += relevantTables.length;

//       console.log(
//         `Batch ${batchIdx + 1}: ${
//           relevantTables.length
//         } relevant tables kept, ${cleanedData.removedTables.length} removed`
//       );
//     }

//     // NEW: Extract unique categories
//     const categories = [
//       ...new Set(allCleanedSchemas.map((t: any) => t.category)),
//     ];

//     const summary = {
//       totalTables: rawSchema.length,
//       relevantTables: totalRelevant,
//       removedTables: allRemovedTables.length,
//       categories,
//     };

//     console.log("Schema cleaning complete:", summary);

//     return {
//       success: true,
//       cleanedSchema: allCleanedSchemas,
//       summary,
//     };
//   } catch (error) {
//     console.error("Error cleaning schema:", error);
//     return {
//       success: false,
//       error: error instanceof Error ? error.message : "Schema cleaning failed",
//     };
//   }
// }

// /**
//  * Main function to run AI-powered query
//  * This is the primary interface for the AI service
//  * Returns both the answer text and the full plan with metadata
//  */
// export async function runAIQuery(
//   question: string,
//   databaseId: number,
//   databaseType: string,
//   executeSQL: (sql: string) => Promise<any>,
//   conversationHistory: ConversationContext[] = []
// ): Promise<{ answer: string; plan: QueryPlan }> {
//   return AIService.runAIQuery(
//     question,
//     databaseId,
//     databaseType,
//     executeSQL,
//     conversationHistory
//   );
// }

// export default AIService;
