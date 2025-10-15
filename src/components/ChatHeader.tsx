import { Check, Edit3, Plus } from "lucide-react";
import { memo, useCallback, useState } from "react";

interface ChatHeaderProps {
  title: string;
  conversationId: string | null;
  onNewConversation?: () => void;
  onTitleUpdate: (newTitle: string) => void;
}

/**
 * Chat header component with editable title
 * Memoized to prevent unnecessary re-renders
 */
const ChatHeader: React.FC<ChatHeaderProps> = memo(({
  title,
  conversationId,
  onNewConversation,
  onTitleUpdate,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");

  /**
   * Handle starting title edit mode
   */
  const handleStartEditTitle = useCallback(() => {
    setEditTitleValue(title);
    setIsEditingTitle(true);
  }, [title]);

  /**
   * Handle saving title changes
   */
  const handleSaveTitle = useCallback(() => {
    if (!editTitleValue.trim()) return;
    onTitleUpdate(editTitleValue.trim());
    setIsEditingTitle(false);
  }, [editTitleValue, onTitleUpdate]);

  /**
   * Handle canceling title edit
   */
  const handleCancelEditTitle = useCallback(() => {
    setIsEditingTitle(false);
    setEditTitleValue("");
  }, []);

  /**
   * Handle key press in title input
   */
  const handleTitleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSaveTitle();
      } else if (e.key === "Escape") {
        handleCancelEditTitle();
      }
    },
    [handleSaveTitle, handleCancelEditTitle]
  );

  return (
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
              {title}
            </h2>
          )}

          {conversationId && (
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
  );
});

ChatHeader.displayName = "ChatHeader";

export default ChatHeader;
