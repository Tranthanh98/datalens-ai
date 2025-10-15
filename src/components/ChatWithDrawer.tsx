/* eslint-disable @typescript-eslint/no-empty-object-type */
import { useState } from "react";
import { useDatabaseStore } from "../store";
import ChatInterface from "./ChatInterface";
import ConversationDrawer from "./ConversationDrawer";

interface ChatWithDrawerProps {
  // No props needed - components handle their own state
}

/**
 * Main chat component with conversation drawer
 * Combines ConversationDrawer and ChatInterface with simplified state management
 */
const ChatWithDrawer: React.FC<ChatWithDrawerProps> = () => {
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);
  const { selectedDatabase } = useDatabaseStore();

  const toggleDrawer = () => {
    setIsDrawerCollapsed(!isDrawerCollapsed);
  };

  // Don't render if no database is selected
  if (!selectedDatabase) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Please select a database to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex h-full relative">
      {/* Conversation Drawer */}
      <ConversationDrawer
        isCollapsed={isDrawerCollapsed}
        onToggleCollapse={toggleDrawer}
      />

      {/* Main Chat Area */}
      <div
        className={`flex-1 transition-all duration-300 ${
          isDrawerCollapsed ? "ml-12" : "ml-80"
        }`}
      >
        <ChatInterface />
      </div>
    </div>
  );
};

export default ChatWithDrawer;
