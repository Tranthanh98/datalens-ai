import ChatWithDrawer from "./components/ChatWithDrawer";
import Header from "./components/Header";
import ResizablePanels from "./components/ResizablePanels";
import ResultsPanel from "./components/ResultsPanel";

/**
 * Main App component for DataLens AI
 * Manages the overall layout and state for chat and results
 * Database management is now handled by Zustand store
 */
function App() {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanels
          leftPanel={<ChatWithDrawer />}
          rightPanel={<ResultsPanel />}
          minLeftWidth={320}
          minRightWidth={320}
          defaultLeftWidth={50}
        />
      </div>
    </div>
  );
}

export default App;
