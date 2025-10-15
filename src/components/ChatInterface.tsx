import { useLiveQuery } from "dexie-react-hooks";
import { Check, Edit3, Plus, Send } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { legacyToDatabase } from "../db/adapters";
import { ConversationService, MessageService } from "../db/services";
import type { DatabaseInfo } from "../db/types";
import { runAIQuery } from "../services/aiService";
import { QueryExecutionApiService } from "../services/queryExecutionApiService";
import { useChatStore, useDatabaseStore } from "../store";

interface ChatInterfaceProps {
  onNewConversation?: () => void;
}

/**
 * Chat interface component for user interaction with AI
 * Displays message history and provides input for new messages
 * Fetches messages internally using useLiveQuery
 */
const ChatInterface: React.FC<ChatInterfaceProps> = ({ onNewConversation }) => {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");

  // Get selected conversation from store
  const { selectedConversationId } = useChatStore();

  // Get selected database from store
  const { selectedDatabase } = useDatabaseStore();

  // Fetch messages for selected conversation using useLiveQuery
  const messages =
    useLiveQuery(async () => {
      if (!selectedConversationId) return [];

      const msgList = await MessageService.getByConversation(
        parseInt(selectedConversationId)
      );
      return msgList.map((msg) => ({
        id: msg.id!.toString(),
        content: msg.content,
        type: msg.type as "user" | "ai",
        timestamp: msg.createdAt,
      }));
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
   * Handle starting title edit mode
   */
  const handleStartEditTitle = () => {
    setEditTitleValue(conversationTitle);
    setIsEditingTitle(true);
  };

  /**
   * Handle saving title changes
   */
  const handleSaveTitle = async () => {
    if (!selectedConversationId || !editTitleValue.trim()) return;

    try {
      await ConversationService.updateTitle(
        parseInt(selectedConversationId),
        editTitleValue.trim()
      );
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to update conversation title:", error);
    }
  };

  /**
   * Handle canceling title edit
   */
  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
    setEditTitleValue("");
  };

  /**
   * Handle key press in title input
   */
  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      handleCancelEditTitle();
    }
  };

  /**
   * Handle sending a message
   */
  const handleSendMessage = async (message: string) => {
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
          // Convert legacy database to DatabaseInfo format
          const databaseInfo: DatabaseInfo = {
            ...legacyToDatabase(selectedDatabase),
            id: parseInt(selectedDatabase.id),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Convert to DatabaseConnectionInfo for the API service
          const connectionInfo = {
            type: databaseInfo.type,
            host: databaseInfo.host || "localhost",
            port: databaseInfo.port || 5432,
            database: databaseInfo.database || "",
            username: databaseInfo.username || "",
            password: databaseInfo.password || "",
            ssl: databaseInfo.ssl,
          };

          // Create executeSQL function using the API service
          const executeSQL =
            QueryExecutionApiService.createExecutor(connectionInfo);

          // Execute AI query
          const aiResponse = await runAIQuery(
            message,
            databaseInfo,
            executeSQL
          );

          // Update the AI message with the real response
          await MessageService.update(aiMessageId, {
            content: aiResponse,
          });
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      handleSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            {isEditingTitle ? (
              <input
                type="text"
                value={editTitleValue}
                onChange={(e) => setEditTitleValue(e.target.value)}
                onKeyDown={handleTitleKeyPress}
                onBlur={handleCancelEditTitle}
                className="text-lg font-semibold text-gray-800 bg-transparent border-b-2 border-blue-500 outline-none flex-1 min-w-0"
                autoFocus
                placeholder="Enter conversation title"
              />
            ) : (
              <h2 className="text-lg font-semibold text-gray-800 flex-1 min-w-0 truncate">
                {conversationTitle}
              </h2>
            )}

            {selectedConversationId && (
              <button
                onClick={
                  isEditingTitle ? handleSaveTitle : handleStartEditTitle
                }
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                title={isEditingTitle ? "Save title" : "Edit title"}
              >
                {isEditingTitle ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Edit3 className="w-4 h-4 text-gray-600" />
                )}
              </button>
            )}
          </div>

          {onNewConversation && (
            <button
              onClick={onNewConversation}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors ml-2"
              title="New Conversation"
            >
              <Plus className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
      </div>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>Start a conversation by asking about your data</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.type === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.type === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {message.type === "ai" ? (
                  <div className="text-sm markdown-content">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-lg font-bold mb-2 text-gray-900">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-base font-bold mb-2 text-gray-900">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-sm font-bold mb-1 text-gray-900">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="mb-2 text-gray-800 leading-relaxed">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside mb-2 text-gray-800">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside mb-2 text-gray-800">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="mb-1 text-gray-800">{children}</li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-bold text-gray-900">
                            {children}
                          </strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic text-gray-800">{children}</em>
                        ),
                        code: ({ children }) => (
                          <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-gray-200 p-2 rounded mb-2 overflow-x-auto text-xs">
                            {children}
                          </pre>
                        ),
                        table: ({ children }) => (
                          <table className="w-full border-collapse border border-gray-300 mb-2 text-xs">
                            {children}
                          </table>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-gray-200">{children}</thead>
                        ),
                        tbody: ({ children }) => <tbody>{children}</tbody>,
                        tr: ({ children }) => (
                          <tr className="border-b border-gray-300">
                            {children}
                          </tr>
                        ),
                        th: ({ children }) => (
                          <th className="border border-gray-300 px-2 py-1 text-left font-bold">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="border border-gray-300 px-2 py-1">
                            {children}
                          </td>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-gray-400 pl-3 italic text-gray-700 mb-2">
                            {children}
                          </blockquote>
                        ),
                        hr: () => <hr className="my-3 border-gray-300" />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
                <span className="text-xs opacity-70 mt-1 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about your data..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
