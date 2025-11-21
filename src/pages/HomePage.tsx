import { useEffect } from "react";
import ChatWithDrawer from "../components/ChatWithDrawer";
import ResizablePanels from "../components/ResizablePanels";
import ResultsPanel from "../components/ResultsPanel";
import { useDatabaseStore } from "../store";

/**
 * Home Page - Main chat interface
 */
const HomePage = () => {
  const { loadDatabases, isLoading } = useDatabaseStore();
  /**
   * Load databases on component mount
   */
  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Loading databases...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      <ResizablePanels
        leftPanel={<ChatWithDrawer />}
        rightPanel={<ResultsPanel />}
        minLeftWidth={320}
        minRightWidth={320}
        defaultLeftWidth={50}
      />
    </div>
  );
};

export default HomePage;
