import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import { ConversationService } from "../db/services";
import { useChatStore, useDatabaseStore } from "../store";

interface ConversationDrawerProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * ConversationDrawer component with proper sidebar layout
 * Can be collapsed/expanded and doesn't use absolute positioning
 * Handles conversation selection internally using useLiveQuery
 */
const ConversationDrawer: React.FC<ConversationDrawerProps> = ({
  isCollapsed = false,
  onToggleCollapse,
}) => {
  // Get selected database and conversation state from stores
  const { selectedDatabase } = useDatabaseStore();
  const { selectedConversationId, setSelectedConversationId } = useChatStore();

  // Fetch conversations using useLiveQuery
  const conversations =
    useLiveQuery(async () => {
      if (!selectedDatabase?.id) return [];

      const convList = await ConversationService.getByDatabase(
        parseInt(selectedDatabase.id, 10)
      );
      return convList.map((conv) => ({
        id: conv.id!.toString(),
        title: conv.title,
        lastMessage: "", // TODO: Get last message
        timestamp: conv.updatedAt,
        messageCount: conv.messageCount || 0,
      }));
    }, [selectedDatabase?.id]) || [];

  console.log("Conversations:", conversations);
  /**
   * Handle conversation selection
   */
  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  /**
   * Handle creating new conversation
   */
  const handleNewConversation = async () => {
    if (!selectedDatabase?.id) return;

    try {
      const convId = await ConversationService.create(
        parseInt(selectedDatabase.id, 10),
        `New Conversation ${Date.now()}`
      );
      setSelectedConversationId(convId.toString());
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  /**
   * Handle conversation deletion
   */
  const handleDeleteConversation = async (conversationId: string) => {
    if (conversations.length <= 1) return; // Keep at least one conversation

    try {
      await ConversationService.delete(parseInt(conversationId));

      // If deleting active conversation, switch to first available
      if (
        selectedConversationId === conversationId &&
        conversations.length > 1
      ) {
        const remainingConversations = conversations.filter(
          (conv) => conv.id !== conversationId
        );
        if (remainingConversations.length > 0) {
          setSelectedConversationId(remainingConversations[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };
  /**
   * Handle conversation deletion with confirmation
   */
  const handleDeleteConversationWithConfirm = (
    e: React.MouseEvent,
    conversationId: string
  ) => {
    e.stopPropagation();

    // Prevent deleting the last conversation
    if (conversations.length <= 1) {
      return;
    }

    if (window.confirm("Are you sure you want to delete this conversation?")) {
      handleDeleteConversation(conversationId);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  };

  /**
   * Truncate title for display
   */
  const truncateTitle = (title: string, maxLength: number = 30) => {
    return title.length > maxLength
      ? title.substring(0, maxLength) + "..."
      : title;
  };

  // Collapsed sidebar
  if (isCollapsed) {
    return (
      <div
        className="absolute top-0 left-0 w-12 bg-gray-100 border-r border-gray-200 flex flex-col items-center py-4 h-full flex-shrink-0"
        onClick={onToggleCollapse}
        // onMouseEnter={onToggleCollapse}
        // onMouseLeave={onToggleCollapse}
      >
        {/* Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer mb-2"
          title="Expand Conversations"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>

        {/* Drawer Icon */}
        <div className="p-2 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
          <MessageSquare className="w-6 h-6 text-gray-600" />
        </div>

        {/* Conversation Count Indicator */}
        {conversations.length > 0 && (
          <div className="mt-2 w-6 h-6 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
            {conversations.length > 9 ? "9+" : conversations.length}
          </div>
        )}
      </div>
    );
  }

  // Expanded sidebar
  return (
    <div
      className="absolute top-0 left-0 w-80 bg-white border-r border-gray-200 flex flex-col h-full flex-shrink-0 min-w-0 max-w-sm"
      onMouseLeave={onToggleCollapse}
    >
      {/* Drawer Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 truncate">
            Conversations
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleNewConversation}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="New Conversation"
            >
              <Plus className="w-5 h-5 text-gray-600" />
            </button>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No conversations yet</p>
            <button
              onClick={handleNewConversation}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Start your first conversation
            </button>
          </div>
        ) : (
          <div className="p-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleConversationSelect(conversation.id)}
                className={`
                  group relative p-3 rounded-lg cursor-pointer transition-colors mb-1
                  ${
                    selectedConversationId === conversation.id
                      ? "bg-blue-50 border border-blue-200"
                      : "hover:bg-gray-50"
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4
                      className={`
                      text-sm font-medium truncate
                      ${
                        selectedConversationId === conversation.id
                          ? "text-blue-900"
                          : "text-gray-900"
                      }
                    `}
                    >
                      {truncateTitle(conversation.title)}
                    </h4>

                    {conversation.lastMessage && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        {truncateTitle(conversation.lastMessage, 40)}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        {formatTimestamp(conversation.timestamp)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {conversation.messageCount} messages
                      </span>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) =>
                      handleDeleteConversationWithConfirm(e, conversation.id)
                    }
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 transition-all ml-2"
                    title="Delete Conversation"
                    disabled={conversations.length <= 1}
                  >
                    <Trash2
                      className={`w-4 h-4 ${
                        conversations.length <= 1
                          ? "text-gray-300"
                          : "text-red-500"
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationDrawer;
