import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import {
  ConversationService,
  MessageService,
  QueryResultService,
} from "../db/services";
import { runAIQuery } from "../services/aiService2"; // Function calling agent
import { QueryExecutionApiService } from "../services/queryExecutionApiService";
import { useChatStore, useDatabaseStore } from "../store";
import type { QueryPlanEvent, QueryPlanStep } from "../utils/queryPlanEvents";
import { queryPlanEvents } from "../utils/queryPlanEvents";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import ExecutionPlanDisplay from "./ExecutionPlanDisplay";
import MessageList from "./MessageList";

interface ChatInterfaceProps {
  onNewConversation?: () => void;
}

/**
 * Extract key findings from query result data for conversation context
 */
function extractKeyFindings(resultData: Record<string, unknown>[]): string[] {
  if (!Array.isArray(resultData) || resultData.length === 0) {
    return [];
  }

  const findings: string[] = [];
  const firstRow = resultData[0];

  // Extract important looking fields (IDs, status, names, etc.)
  Object.entries(firstRow).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("id") ||
        lowerKey.includes("status") ||
        lowerKey.includes("user") ||
        lowerKey.includes("name") ||
        lowerKey.includes("code")
      ) {
        findings.push(`${key}: ${value}`);
      }
    }
  });

  // Add row count if significant
  if (resultData.length > 0) {
    findings.push(`Total rows: ${resultData.length}`);
  }

  return findings.slice(0, 5); // Limit to 5 most important findings
}

/**
 * Chat interface component for user interaction with AI
 * Displays message history and provides input for new messages
 * Fetches messages internally using useLiveQuery
 *
 * OPTIMIZED VERSION:
 * - Tách thành các component con (ChatHeader, ChatInput, MessageList, ChatMessage)
 * - Sử dụng React.memo để tránh re-render không cần thiết
 * - ChatInput có state nội bộ, không làm re-render toàn bộ ChatInterface khi user gõ
 * - Message items được memoized riêng lẻ
 */
const ChatInterface: React.FC<ChatInterfaceProps> = ({ onNewConversation }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<QueryPlanStep[]>([]);

  // Get selected conversation from store
  const { selectedConversationId, setSelectedMessageId } = useChatStore();

  // Get selected database from store
  const { selectedDatabase } = useDatabaseStore();

  // NOTE: selectedProvider from useAISettingsStore() not used with aiService3
  // aiService3 uses Gemini with function calling only

  // Subscribe to query plan events
  useEffect(() => {
    const unsubscribe = queryPlanEvents.subscribe((event: QueryPlanEvent) => {
      switch (event.type) {
        case "plan_generated":
          // Show execution plan steps
          if (event.steps) {
            setExecutionSteps(event.steps);
          }
          break;

        case "step_started":
        case "step_completed":
        case "step_error":
          // Update step status
          if (event.step) {
            setExecutionSteps((prevSteps) =>
              prevSteps.map((step) =>
                step.id === event.step!.id ? event.step! : step
              )
            );
          }
          break;

        case "plan_completed":
          // Hide execution plan after a short delay
          setTimeout(() => {
            setExecutionSteps([]);
          }, 1000);
          break;
      }
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // Fetch messages for selected conversation using useLiveQuery
  const messages =
    useLiveQuery(async () => {
      if (!selectedConversationId) return [];

      const msgList = await MessageService.getByConversation(
        parseInt(selectedConversationId)
      );

      // Check which messages have query results
      const messagesWithResults = await Promise.all(
        msgList.map(async (msg) => {
          const queryResult = msg.id
            ? await QueryResultService.getByMessageId(msg.id)
            : null;

          return {
            id: msg.id!.toString(),
            content: msg.content,
            type: msg.type as "user" | "ai",
            timestamp: msg.createdAt,
            hasQueryResult: !!queryResult,
          };
        })
      );

      return messagesWithResults;
    }, [selectedConversationId]) || [];

  // Fetch conversation title
  const conversationTitle =
    useLiveQuery(async () => {
      if (!selectedConversationId) return "Chat";

      const conversation = await ConversationService.getById(
        parseInt(selectedConversationId)
      );
      return conversation?.title || "Chat";
    }, [selectedConversationId]) || "Chat";

  /**
   * Handle updating conversation title
   */
  const handleTitleUpdate = useCallback(
    async (newTitle: string) => {
      if (!selectedConversationId) return;

      try {
        await ConversationService.updateTitle(
          parseInt(selectedConversationId),
          newTitle
        );
      } catch (error) {
        console.error("Failed to update conversation title:", error);
      }
    },
    [selectedConversationId]
  );

  /**
   * Handle viewing query result
   */
  const handleViewResult = useCallback(
    (messageId: string) => {
      setSelectedMessageId(messageId);
    },
    [setSelectedMessageId]
  );

  /**
   * Handle sending a message
   */
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!selectedConversationId) return;

      setIsLoading(true);

      try {
        const convId = parseInt(selectedConversationId);

        // Add user message
        await MessageService.add({
          conversationId: convId,
          content: message,
          type: "user",
        });

        // Show immediate mock response to user
        const mockResponse = `I understand you want to query: "${message}". Let me help you with that.`;

        const aiMessageId = await MessageService.add({
          conversationId: convId,
          content: mockResponse,
          type: "ai",
        });

        // Now execute the actual AI query in the background
        if (selectedDatabase) {
          try {
            // Create executeSQL function using the API service
            const executeSQL = QueryExecutionApiService.createExecutor(
              parseInt(selectedDatabase.id)
            );

            // Build conversation history context (last 3-4 exchanges)
            const recentMessages = await MessageService.getByConversation(
              convId
            );
            const conversationHistory = [];

            // Get last 4 complete Q&A pairs (user + AI)
            for (
              let i = recentMessages.length - 1;
              i >= 0 && conversationHistory.length < 4;
              i--
            ) {
              const msg = recentMessages[i];

              // Look for AI messages with query results
              if (msg.type === "ai" && msg.id) {
                const queryResult = await QueryResultService.getByMessageId(
                  msg.id
                );

                if (
                  queryResult &&
                  i > 0 &&
                  recentMessages[i - 1].type === "user"
                ) {
                  const userQuestion = recentMessages[i - 1].content;

                  // Extract key findings from query result
                  const keyFindings = extractKeyFindings(
                    queryResult.result.data
                  );

                  conversationHistory.unshift({
                    question: userQuestion,
                    answer: msg.content,
                    sqlQuery: queryResult.sqlQuery,
                    keyFindings: keyFindings,
                  });
                }
              }
            }

            // Execute AI query with conversation context using new function calling agent
            const { answer: aiResponse, plan } = await runAIQuery(
              message,
              parseInt(selectedDatabase.id),
              selectedDatabase.type || "postgresql",
              executeSQL,
              conversationHistory
            );

            // Update the AI message with the real response
            await MessageService.update(aiMessageId, {
              content: aiResponse,
            });

            // Save query result to QueryResult table
            if (plan.finalSQL && plan.queries && plan.queries.length > 0) {
              const lastQuery = plan.queries[plan.queries.length - 1];
              await QueryResultService.save({
                conversationId: convId,
                messageId: aiMessageId,
                sqlQuery: plan.finalSQL,
                result: {
                  data: lastQuery?.result?.data || [],
                  columns:
                    lastQuery?.result?.data && lastQuery.result.data.length > 0
                      ? Object.keys(lastQuery.result.data[0])
                      : [],
                  rowCount: lastQuery?.rowCount || 0,
                  executionTime: lastQuery?.executionTime || 0,
                },
                chartData: plan.chartData,
                status: "success",
              });
            }
          } catch (aiError) {
            console.error("AI Query failed:", aiError);

            // Update message with error information
            const errorMessage = `I apologize, but I encountered an error while processing your query: "${message}". Please check your database connection and try again.`;

            await MessageService.update(aiMessageId, {
              content: errorMessage,
            });
          }
        } else {
          // No database selected - update message with instruction
          const noDatabaseMessage = `To help you query your data, please select a database first. You can add and configure databases in the settings.`;

          await MessageService.update(aiMessageId, {
            content: noDatabaseMessage,
          });
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to send message:", error);
        setIsLoading(false);
      }
    },
    [selectedConversationId, selectedDatabase]
  );

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat Header */}
      <ChatHeader
        title={conversationTitle}
        conversationId={selectedConversationId}
        onNewConversation={onNewConversation}
        onTitleUpdate={handleTitleUpdate}
      />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          onViewResult={handleViewResult}
        />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200">
        {/* Execution Plan Display */}
        {executionSteps.length > 0 && (
          <ExecutionPlanDisplay steps={executionSteps} />
        )}

        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default ChatInterface;
