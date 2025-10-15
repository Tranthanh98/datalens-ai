import { memo } from "react";
import ChatMessage from "./ChatMessage";

interface Message {
  id: string;
  content: string;
  type: "user" | "ai";
  timestamp: Date;
  hasQueryResult: boolean;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onViewResult: (messageId: string) => void;
}

/**
 * Message list component
 * Memoized to prevent unnecessary re-renders when input changes
 */
const MessageList: React.FC<MessageListProps> = memo(({
  messages,
  isLoading,
  onViewResult,
}) => {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="text-center text-gray-500 mt-8">
        <p>Start a conversation by asking about your data</p>
      </div>
    );
  }

  return (
    <>
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          id={message.id}
          content={message.content}
          type={message.type}
          timestamp={message.timestamp}
          hasQueryResult={message.hasQueryResult}
          onViewResult={onViewResult}
        />
      ))}

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
    </>
  );
});

MessageList.displayName = "MessageList";

export default MessageList;
