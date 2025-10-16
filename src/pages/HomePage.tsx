import ChatWithDrawer from "../components/ChatWithDrawer";
import ResizablePanels from "../components/ResizablePanels";
import ResultsPanel from "../components/ResultsPanel";

/**
 * Home Page - Main chat interface
 */
const HomePage = () => {
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
