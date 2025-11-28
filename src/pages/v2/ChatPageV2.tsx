import { useLiveQuery } from "dexie-react-hooks";
import { Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ChatMessageV2 from "../../components/v2/ChatMessageV2";
import ConversationSidebarV2 from "../../components/v2/ConversationSidebarV2";
import DatabaseSelector from "../../components/v2/DatabaseSelector";
import {
  ConversationService,
  MessageService,
  QueryResultService,
} from "../../db/services";
import { runAIQuery } from "../../services/aiService2";
import { QueryExecutionApiService } from "../../services/queryExecutionApiService";
import { useChatStore, useDatabaseStore } from "../../store";

/**
 * Extract key findings from query result data for conversation context
 */
function extractKeyFindings(resultData: Record<string, unknown>[]): string[] {
  if (!Array.isArray(resultData) || resultData.length === 0) {
    return [];
  }

  const findings: string[] = [];
  const firstRow = resultData[0];

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

  if (resultData.length > 0) {
    findings.push(`Total rows: ${resultData.length}`);
  }

  return findings.slice(0, 5);
}

// Message type with extended data
interface MessageWithData {
  id: string;
  content: string;
  type: "user" | "ai";
  timestamp: Date;
  sqlQuery?: string;
  chartData?: {
    type: "bar" | "pie" | "line" | "none";
    data: Record<string, unknown>[];
    xAxisKey?: string;
    yAxisKey?: string;
    description?: string;
  } | null;
  queryResult?: {
    data: Record<string, unknown>[];
    columns: string[];
    rowCount: number;
    executionTime: number;
  } | null;
}

/**
 * ChatPageV2 - ChatGPT-style chat interface
 * Features:
 * - Left sidebar with conversation list
 * - Main chat area with messages
 * - Inline rendering of charts, SQL queries, and data tables
 */
const ChatPageV2 = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { selectedConversationId, setSelectedConversationId } = useChatStore();
  const {
    selectedDatabase,
    loadDatabases,
    isLoading: dbLoading,
  } = useDatabaseStore();

  // Load databases on mount
  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

  // Auto-create conversation if none selected
  useEffect(() => {
    const initConversation = async () => {
      if (!selectedDatabase?.id || selectedConversationId) return;

      try {
        const conversations = await ConversationService.getByDatabase(
          parseInt(selectedDatabase.id, 10)
        );

        if (conversations.length > 0) {
          setSelectedConversationId(conversations[0].id!.toString());
        } else {
          const convId = await ConversationService.create(
            parseInt(selectedDatabase.id, 10),
            "New Chat"
          );
          setSelectedConversationId(convId.toString());
        }
      } catch (error) {
        console.error("Failed to initialize conversation:", error);
      }
    };

    initConversation();
  }, [selectedDatabase?.id, selectedConversationId, setSelectedConversationId]);

  // Fetch messages with query results
  const messages: MessageWithData[] =
    useLiveQuery(async () => {
      if (!selectedConversationId) return [];

      const msgList = await MessageService.getByConversation(
        parseInt(selectedConversationId)
      );

      const messagesWithData = await Promise.all(
        msgList.map(async (msg) => {
          const queryResult = msg.id
            ? await QueryResultService.getByMessageId(msg.id)
            : null;

          return {
            id: msg.id!.toString(),
            content: msg.content,
            type: msg.type as "user" | "ai",
            timestamp: msg.createdAt,
            sqlQuery: queryResult?.sqlQuery,
            chartData: queryResult?.chartData || null,
            queryResult: queryResult?.result || null,
          };
        })
      );

      return messagesWithData;
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(
        Math.max(textareaRef.current.scrollHeight, 52),
        200
      );
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [inputValue]);

  /**
   * Handle sending a message
   */
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !selectedConversationId || isLoading) return;

    const message = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    try {
      const convId = parseInt(selectedConversationId);

      // Add user message
      await MessageService.add({
        conversationId: convId,
        content: message,
        type: "user",
      });

      // Add initial AI message
      const aiMessageId = await MessageService.add({
        conversationId: convId,
        content: "Thinking...",
        type: "ai",
      });

      // Execute AI query
      if (selectedDatabase) {
        try {
          const executeSQL = QueryExecutionApiService.createExecutor(
            parseInt(selectedDatabase.id)
          );

          // Build conversation history
          const recentMessages = await MessageService.getByConversation(convId);
          const conversationHistory = [];

          for (
            let i = recentMessages.length - 1;
            i >= 0 && conversationHistory.length < 4;
            i--
          ) {
            const msg = recentMessages[i];
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
                const keyFindings = extractKeyFindings(queryResult.result.data);
                conversationHistory.unshift({
                  question: userQuestion,
                  answer: msg.content,
                  sqlQuery: queryResult.sqlQuery,
                  keyFindings: keyFindings,
                });
              }
            }
          }

          // Run AI query
          const { answer: aiResponse, plan } = await runAIQuery(
            message,
            parseInt(selectedDatabase.id),
            selectedDatabase.type || "postgresql",
            executeSQL,
            conversationHistory
          );

          // Update AI message
          await MessageService.update(aiMessageId, {
            content: aiResponse,
          });

          // Save query result
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

          // Update conversation title if it's a new chat
          if (conversationTitle === "New Chat") {
            const shortTitle =
              message.slice(0, 50) + (message.length > 50 ? "..." : "");
            await ConversationService.updateTitle(convId, shortTitle);
          }
        } catch (aiError) {
          console.error("AI Query failed:", aiError);
          await MessageService.update(aiMessageId, {
            content: `Sorry, I encountered an error while processing your request. Please try again.`,
          });
        }
      } else {
        await MessageService.update(aiMessageId, {
          content: `Please select a database first to start querying your data.`,
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    inputValue,
    selectedConversationId,
    selectedDatabase,
    isLoading,
    conversationTitle,
  ]);

  /**
   * Handle key press
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Loading state
  if (dbLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // No database selected
  if (!selectedDatabase) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex flex-1">
          <ConversationSidebarV2
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                Welcome to DataLens AI
              </h2>
              <p className="text-gray-500 mb-4">
                Please select a database to start chatting
              </p>
              <a
                href="/manage-database"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Manage Databases
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <ConversationSidebarV2
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Chat Header */}
          <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4">
            <h1 className="text-lg font-medium text-gray-800 truncate">
              {conversationTitle}
            </h1>
            <DatabaseSelector />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                  <h2 className="text-xl font-semibold text-gray-700 mb-2">
                    How can I help you today?
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Ask me anything about your database. I can help you write
                    SQL queries, analyze data, and create visualizations.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                {messages.map((message) => (
                  <ChatMessageV2
                    key={message.id}
                    id={message.id}
                    content={message.content}
                    type={message.type}
                    timestamp={message.timestamp}
                    sqlQuery={message.sqlQuery}
                    chartData={message.chartData}
                    queryResult={message.queryResult}
                  />
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="py-6 bg-gray-50">
                    <div className="max-w-3xl mx-auto px-4">
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-medium">
                          AI
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 mb-1">
                            DataLens AI
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                            <div
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            />
                            <div
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-4">
            <div className="max-w-3xl mx-auto">
              <div className="relative flex items-end gap-2 bg-gray-100 rounded-2xl p-2">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your data..."
                  className="flex-1 bg-transparent px-3 py-2 resize-none focus:outline-none text-gray-800 placeholder-gray-500"
                  rows={1}
                  style={{ minHeight: "44px", maxHeight: "200px" }}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">
                DataLens AI can make mistakes. Verify important data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPageV2;
