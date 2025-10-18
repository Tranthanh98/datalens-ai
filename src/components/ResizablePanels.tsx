import type { ReactNode } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

interface ResizablePanelsProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  minLeftWidth?: number; // in pixels, will be converted to percentage
  minRightWidth?: number; // in pixels, will be converted to percentage
  defaultLeftWidth?: number; // percentage
}

/**
 * ResizablePanels component using react-resizable-panels library
 * Provides smooth resizing with better performance and accessibility
 */
const ResizablePanels: React.FC<ResizablePanelsProps> = ({
  leftPanel,
  rightPanel,
  minLeftWidth = 320, // pixels
  minRightWidth = 320, // pixels
  defaultLeftWidth = 50, // percentage
}) => {
  // Convert pixel values to percentage (assuming min viewport width of 1200px)
  const minViewportWidth = 1200;
  const minLeftWidthPercent = Math.max(
    15,
    (minLeftWidth / minViewportWidth) * 100
  );
  const minRightWidthPercent = Math.max(
    15,
    (minRightWidth / minViewportWidth) * 100
  );
  return (
    <div className="h-full w-full">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Left Panel */}
        <Panel
          defaultSize={defaultLeftWidth}
          minSize={minLeftWidthPercent}
          className="flex flex-col h-full"
        >
          {leftPanel}
        </Panel>

        {/* Resizable Handle */}
        <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-gray-300 active:bg-blue-400 transition-colors duration-150 relative group">
          {/* Visual indicator */}
          <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-1 bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
        </PanelResizeHandle>

        {/* Right Panel */}
        <Panel minSize={minRightWidthPercent} className="flex flex-col h-full">
          {rightPanel}
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default ResizablePanels;
