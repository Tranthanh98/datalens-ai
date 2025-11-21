import { Send } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import AIProviderSelector from "./AIProviderSelector";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

/**
 * Chat input component with auto-resize textarea
 * Memoized to prevent unnecessary re-renders when parent updates
 */
const ChatInput: React.FC<ChatInputProps> = memo(
  ({ onSendMessage, isLoading }) => {
    const [inputValue, setInputValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea based on content
    useEffect(() => {
      if (textareaRef.current) {
        // Reset height to auto to get the correct scrollHeight
        textareaRef.current.style.height = "auto";
        // Set height based on scrollHeight, with min and max constraints
        const newHeight = Math.min(
          Math.max(textareaRef.current.scrollHeight, 40),
          120
        );
        textareaRef.current.style.height = `${newHeight}px`;
      }
    }, [inputValue]);

    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
          onSendMessage(inputValue.trim());
          setInputValue("");
        }
      },
      [inputValue, isLoading, onSendMessage]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        // Submit on Enter (without Shift)
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (inputValue.trim() && !isLoading) {
            onSendMessage(inputValue.trim());
            setInputValue("");
          }
        }
      },
      [inputValue, isLoading, onSendMessage]
    );

    return (
      <div className="space-y-2">
        {/* AI Provider Selector */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">AI Model</span>
          <AIProviderSelector />
        </div>

        {/* Chat Input Form */}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data... (Shift+Enter for new line)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-y-auto"
            disabled={isLoading}
            rows={1}
            style={{ minHeight: "40px", maxHeight: "120px" }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    );
  }
);

ChatInput.displayName = "ChatInput";

export default ChatInput;
