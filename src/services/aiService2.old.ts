// /* eslint-disable @typescript-eslint/no-unused-vars */
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
// import { type ConversationContext } from "../utils/aiPrompt";
// import {
//   REFINEMENT_SCHEMA,
//   SQL_VALIDATION_SCHEMA,
// } from "../utils/aiResponseSchema";
// import type { QueryPlanStep as EventQueryPlanStep } from "../utils/queryPlanEvents";
// import { queryPlanEvents } from "../utils/queryPlanEvents";
// import { searchSimilarTables } from "./schemaSearchService";

// // Initialize Gemini AI
// const ai = new GoogleGenAI({
//   apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
// });

// /**
//  * Types for the smart AI agent
//  */
// export interface QueryExecution {
//   sql: string;
//   reasoning: string;
//   result?: any;
//   error?: string;
//   executionTime?: number;
//   rowCount?: number;
// }

// export interface AgentResponse {
//   type: "sql_query" | "direct_response" | "error";
//   content: string;
//   queries?: QueryExecution[];
//   conversationContext?: ConversationContext;
// }

// export interface ChartData {
//   type: "bar" | "pie" | "line" | "none";
//   data: Array<{ name: string; value: number; [key: string]: any }>;
//   xAxisKey?: string;
//   yAxisKey?: string;
//   description?: string;
// }

// export interface QueryPlan {
//   id: string;
//   question: string;
//   agentResponse: AgentResponse;
//   finalAnswer: string;
//   finalSQL?: string;
//   chartData?: ChartData;
//   databaseType: string;
//   totalExecutionTime: number;
//   queryCount: number;
// }

// /**
//  * Smart AI Agent Service
//  */
// export class AIService {
//   /**
//    * Main agent execution with function calling
//    */
//   static async runSmartAgent(
//     question: string,
//     databaseId: number,
//     databaseType: string,
//     executeSQL: (sql: string) => Promise<any>,
//     conversationHistory: ConversationContext[] = []
//   ): Promise<{ answer: string; plan: QueryPlan }> {
//     const startTime = Date.now();
//     const planId = `plan_${Date.now()}`;
//     const executedQueries: QueryExecution[] = [];

//     try {
//       if (!databaseId) {
//         throw new Error("Database ID is required");
//       }

//       // Search for relevant schema
//       const searchResult = await searchSimilarTables(databaseId, question, 15);

//       if (
//         !searchResult.success ||
//         !searchResult.data ||
//         searchResult.data.length === 0
//       ) {
//         // No schema found - respond without database access
//         return this.createDirectResponse(
//           question,
//           databaseType,
//           "I don't have access to relevant database schema to answer this question. Please make sure your database schema is properly indexed.",
//           startTime
//         );
//       }

//       const schema = searchResult.data.map((item) => item.schema);
//       console.log(`Found ${schema.length} relevant tables for: "${question}"`);

//       // Build system prompt with schema context
//       const systemPrompt = this.buildSystemPrompt(
//         schema,
//         databaseType,
//         conversationHistory
//       );

//       // Initial agent call with function calling
//       let currentResponse = await this.callAgentWithFunctions(
//         systemPrompt,
//         question,
//         conversationHistory
//       );

//       // Handle function calls iteratively (max 3 iterations to prevent loops)
//       const maxIterations = 3;
//       let iteration = 0;

//       while (currentResponse.functionCalls && iteration < maxIterations) {
//         iteration++;
//         console.log(
//           `Agent iteration ${iteration}:`,
//           currentResponse.functionCalls
//         );

//         const functionResults: any[] = [];

//         for (const fnCall of currentResponse.functionCalls) {
//           if (fnCall.name === "execute_sql_query") {
//             // Execute SQL query
//             const queryExecution = await this.executeSQLQuery(
//               fnCall.args.sql,
//               fnCall.args.reasoning,
//               executeSQL
//             );
//             executedQueries.push(queryExecution);
//             functionResults.push({
//               name: fnCall.name,
//               response: queryExecution.error
//                 ? { error: queryExecution.error }
//                 : {
//                     data: queryExecution.result,
//                     rowCount: queryExecution.rowCount,
//                   },
//             });
//           } else if (fnCall.name === "respond_directly") {
//             // Direct response - no more iterations needed
//             const finalAnswer = await this.formatFinalAnswer(
//               question,
//               fnCall.args.response,
//               executedQueries,
//               databaseType
//             );

//             return this.createPlanResponse(
//               planId,
//               question,
//               databaseType,
//               finalAnswer,
//               executedQueries,
//               startTime
//             );
//           }
//         }

//         // Call agent again with function results
//         if (functionResults.length > 0) {
//           currentResponse = await this.callAgentWithFunctionResults(
//             systemPrompt,
//             question,
//             conversationHistory,
//             currentResponse.functionCalls,
//             functionResults
//           );
//         } else {
//           break;
//         }
//       }

//       // Generate final answer from all executed queries
//       const finalAnswer = await this.generateFinalAnswerFromQueries(
//         question,
//         executedQueries,
//         currentResponse.text || ""
//       );

//       return this.createPlanResponse(
//         planId,
//         question,
//         databaseType,
//         finalAnswer,
//         executedQueries,
//         startTime
//       );
//     } catch (error) {
//       console.error("Smart agent error:", error);
//       const errorMessage =
//         error instanceof Error ? error.message : "Unknown error";

//       return this.createPlanResponse(
//         planId,
//         question,
//         databaseType,
//         `# Error\n\nI encountered an error while processing your request:\n\n${errorMessage}\n\nPlease try rephrasing your question or check your database connection.`,
//         executedQueries,
//         startTime
//       );
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
//    * NEW: Check if a step's dependencies are met (considering removed steps)
//    */
//   private static canExecuteStep(
//     step: QueryStep,
//     executedStepIds: Set<string>,
//     allSteps?: QueryStep[]
//   ): boolean {
//     if (!step.dependencies || step.dependencies.length === 0) {
//       return true;
//     }

//     // Filter out dependencies that refer to removed steps
//     const validDependencies = step.dependencies.filter((depId) => {
//       if (allSteps) {
//         const depStep = allSteps.find((s) => s.id === depId);
//         return depStep && depStep.type !== "removed" && !depStep.isRemoved;
//       }
//       return true; // If no step info, assume valid
//     });

//     // Check if all valid dependencies are met
//     return validDependencies.every((depId) => executedStepIds.has(depId));
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
//       const eventSteps: EventQueryPlanStep[] = plan.steps
//         .filter((step) => step.type !== "removed") // Filter out removed steps from events
//         .map((step) => ({
//           id: step.id,
//           type: step.type as "query" | "analysis" | "aggregation",
//           description: step.description,
//           sql: step.sql,
//           status: "pending" as const,
//         }));

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

//         // NEW: Skip removed steps
//         if (
//           step.type === "removed" ||
//           step.isRemoved ||
//           !step.sql ||
//           step.sql === "REMOVED"
//         ) {
//           console.log(
//             `⏭️ Skipping removed step ${step.id}: ${step.description}`
//           );
//           // Mark as executed so other steps don't wait for it
//           executedStepIds.add(step.id);

//           // Add to context for tracking
//           plan.context.push({
//             step,
//             result: {
//               skipped: true,
//               reason: "Step was removed during refinement",
//             },
//             timestamp: Date.now(),
//           });

//           continue;
//         }

//         // NEW: Check if dependencies are met
//         if (!this.canExecuteStep(step, executedStepIds, plan.steps)) {
//           // Filter valid dependencies (non-removed)
//           const validDeps =
//             step.dependencies?.filter((depId) => {
//               const depStep = plan.steps.find((s) => s.id === depId);
//               return (
//                 depStep && depStep.type !== "removed" && !depStep.isRemoved
//               );
//             }) || [];

//           if (validDeps.length > 0) {
//             console.warn(
//               `Step ${
//                 step.id
//               } dependencies not met, waiting for: ${validDeps.join(", ")}`
//             );
//             continue;
//           }
//           // If no valid dependencies, proceed with execution
//         }

//         if (
//           (step.type === "query" ||
//             step.type === "analysis" ||
//             step.type === "aggregation") &&
//           step.sql
//         ) {
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
//    * IMPROVED: Apply refinements with step removal handling
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

//     // Process modified steps with removal handling
//     if (
//       refinementData.modifiedSteps &&
//       refinementData.modifiedSteps.length > 0
//     ) {
//       const removedStepIds = new Set<string>();

//       refinementData.modifiedSteps.forEach((modifiedStep: any) => {
//         const index = refinedPlan.steps.findIndex(
//           (step) => step.id === modifiedStep.id
//         );

//         if (index !== -1 && !refinedPlan.steps[index].result) {
//           // Check if step is being removed
//           if (
//             modifiedStep.sql === "REMOVED" ||
//             modifiedStep.sql === "" ||
//             modifiedStep.description?.includes("removed") ||
//             modifiedStep.description?.includes("REMOVED")
//           ) {
//             console.log(
//               `🗑️ Removing step ${modifiedStep.id}: ${
//                 modifiedStep.reasoning || "No reason provided"
//               }`
//             );

//             // Mark step as removed
//             refinedPlan.steps[index] = {
//               ...refinedPlan.steps[index],
//               type: "removed" as any,
//               sql: undefined,
//               description: `REMOVED: ${
//                 modifiedStep.description || refinedPlan.steps[index].description
//               }`,
//               reasoning:
//                 modifiedStep.reasoning || "Step removed during refinement",
//               error: "Step removed during plan refinement",
//               isRemoved: true,
//             };

//             removedStepIds.add(modifiedStep.id);
//           } else {
//             // Regular modification
//             refinedPlan.steps[index] = {
//               ...refinedPlan.steps[index],
//               ...modifiedStep,
//               dependencies:
//                 modifiedStep.dependsOn || refinedPlan.steps[index].dependencies,
//             };
//           }
//         }
//       });

//       // Update dependencies for remaining steps to remove references to removed steps
//       if (removedStepIds.size > 0) {
//         console.log(
//           `🔄 Updating dependencies after removing steps: ${Array.from(
//             removedStepIds
//           ).join(", ")}`
//         );

//         refinedPlan.steps.forEach((step) => {
//           if (step.dependencies && step.dependencies.length > 0) {
//             const originalDeps = [...step.dependencies];
//             step.dependencies = step.dependencies.filter(
//               (depId) => !removedStepIds.has(depId)
//             );

//             if (originalDeps.length !== step.dependencies.length) {
//               console.log(
//                 `📝 Updated dependencies for ${step.id}: ${originalDeps.join(
//                   ", "
//                 )} → ${step.dependencies.join(", ")}`
//               );
//             }
//           }
//         });
//       }
//     }

//     return refinedPlan;
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

// 8. **STEP REMOVAL HANDLING**:
//    - To remove a step: Set sql = "REMOVED" and explain in reasoning
//    - When removing a step, update dependencies of subsequent steps
//    - Remove redundant steps that duplicate functionality
//    - Only remove steps that haven't been executed yet

// 9. **SMART REFINEMENT**:
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
//     },
//     // To REMOVE a step (for redundant or unnecessary steps):
//     {
//       "id": "step_to_remove",
//       "type": "query",
//       "description": "REMOVED: Original description",
//       "sql": "REMOVED",
//       "dependsOn": [],
//       "reasoning": "This step is redundant because [explanation]. The functionality is handled by step_X instead."
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

// 3. **LANGUAGE AND TONE**:
// - Use clear, professional language suitable for business stakeholders
// - You MUST generate an answer in language consistent with the user's question

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
//   You are a SQL validator. Check if this SQL query is safe, correct, and follows best practices.

//   DATABASE TYPE: ${databaseType}
//   SCHEMA: ${JSON.stringify(schema, null, 2)}
//   SQL QUERY:
//   ${sql}

//   Check for:
//   1. SQL injection risks
//   2. Missing LIMIT/TOP clauses (queries should limit results)
//   3. Syntax errors
//   4. Invalid column or table names
//   5. Dangerous operations (DELETE, DROP, UPDATE without proper conditions)
//   6. Performance issues (SELECT * on large tables, missing indexes hints)

//   Return validation result with any issues found and corrected SQL if needed.
//         `.trim();

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
