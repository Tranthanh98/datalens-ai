import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { ConversationService } from "../../db/services";
import { useChatStore, useDatabaseStore } from "../../store";

interface ConversationSidebarV2Props {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

/**
 * ConversationSidebarV2 - ChatGPT-style sidebar
 * Fixed left sidebar with conversation list
 */
const ConversationSidebarV2: React.FC<ConversationSidebarV2Props> = ({
  isCollapsed = false,
  onToggleCollapse,
}) => {
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
        lastMessage: conv.lastMessage || "",
        timestamp: conv.updatedAt,
        messageCount: conv.messageCount || 0,
      }));
    }, [selectedDatabase?.id]) || [];

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
        `New Chat`
      );
      setSelectedConversationId(convId.toString());
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  /**
   * Handle conversation deletion
   */
  const handleDeleteConversation = async (
    e: React.MouseEvent,
    conversationId: string
  ) => {
    e.stopPropagation();

    if (conversations.length <= 1) return;

    if (window.confirm("Delete this conversation?")) {
      try {
        await ConversationService.delete(parseInt(conversationId));

        if (
          selectedConversationId === conversationId &&
          conversations.length > 1
        ) {
          const remaining = conversations.filter(
            (c) => c.id !== conversationId
          );
          if (remaining.length > 0) {
            setSelectedConversationId(remaining[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
    }
  };

  /**
   * Format relative time
   */
  const formatTime = (timestamp: Date) => {
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
      return `${days}d ago`;
    } else {
      return timestamp.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    }
  };

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className="w-16 bg-gray-900 flex flex-col h-full border-r border-gray-800">
        {/* Expand button */}
        <div className="p-3 border-b border-gray-800">
          <button
            onClick={onToggleCollapse}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* New chat button */}
        <div className="p-3">
          <button
            onClick={handleNewConversation}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors"
            title="New chat"
          >
            <Plus className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Database indicator */}
        <div className="p-3 border-t border-gray-800">
          <div
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-800"
            title={selectedDatabase?.name || "No database"}
          >
            <Database className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="w-64 bg-gray-900 flex flex-col h-full border-r border-gray-800">
      {/* Header */}
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <button
          onClick={handleNewConversation}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors text-gray-200 text-sm"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
        <button
          onClick={onToggleCollapse}
          className="ml-2 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p className="text-sm text-gray-400">No conversations yet</p>
            <button
              onClick={handleNewConversation}
              className="mt-3 text-sm text-blue-400 hover:text-blue-300"
            >
              Start your first chat
            </button>
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleConversationSelect(conversation.id)}
                className={`
                  group relative px-3 py-3 rounded-lg cursor-pointer transition-colors
                  ${
                    selectedConversationId === conversation.id
                      ? "bg-gray-800 text-white"
                      : "text-gray-300 hover:bg-gray-800/50"
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-70" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {conversation.title}
                    </p>
                    {conversation.lastMessage && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {conversation.lastMessage}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      {formatTime(conversation.timestamp)}
                    </p>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) =>
                      handleDeleteConversation(e, conversation.id)
                    }
                    className={`
                      opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-700 transition-all
                      ${conversations.length <= 1 ? "cursor-not-allowed" : ""}
                    `}
                    title="Delete conversation"
                    disabled={conversations.length <= 1}
                  >
                    <Trash2
                      className={`w-4 h-4 ${
                        conversations.length <= 1
                          ? "text-gray-600"
                          : "text-gray-400 hover:text-red-400"
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - Database info */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/50">
          <Database className="w-4 h-4 text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-200 truncate">
              {selectedDatabase?.name || "No database"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {selectedDatabase?.type || "Select a database"}
            </p>
          </div>
          <a
            href="/manage-database"
            className="p-1.5 rounded hover:bg-gray-700 transition-colors"
            title="Manage databases"
          >
            <Settings className="w-4 h-4 text-gray-400" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default ConversationSidebarV2;
