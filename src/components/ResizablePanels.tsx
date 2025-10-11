import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ResizablePanelsProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  minLeftWidth?: number;
  minRightWidth?: number;
  defaultLeftWidth?: number;
}

/**
 * ResizablePanels component that allows users to drag and resize the width between two panels
 * Includes minimum width constraints to prevent panels from becoming too small
 */
const ResizablePanels: React.FC<ResizablePanelsProps> = ({
  leftPanel,
  rightPanel,
  minLeftWidth = 300,
  minRightWidth = 300,
  defaultLeftWidth = 50, // percentage
}) => {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  /**
   * Handle mouse down on divider to start dragging
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  /**
   * Handle mouse move during dragging
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      // Calculate new left width as percentage
      let newLeftWidthPx = mouseX;
      let newRightWidthPx = containerWidth - mouseX;

      // Apply minimum width constraints
      if (newLeftWidthPx < minLeftWidth) {
        newLeftWidthPx = minLeftWidth;
      }
      if (newRightWidthPx < minRightWidth) {
        newLeftWidthPx = containerWidth - minRightWidth;
      }

      // Convert to percentage
      const newLeftWidthPercent = (newLeftWidthPx / containerWidth) * 100;

      // Ensure the percentage is within valid bounds
      if (newLeftWidthPercent >= 10 && newLeftWidthPercent <= 90) {
        setLeftWidth(newLeftWidthPercent);
      }
    },
    [isDragging, minLeftWidth, minRightWidth]
  );

  /**
   * Handle mouse up to stop dragging
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const rightWidth = 100 - leftWidth;

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      {/* Left Panel */}
      <div
        style={{ width: `${leftWidth}%` }}
        className="flex-shrink-0 flex flex-col h-full"
      >
        {leftPanel}
      </div>

      {/* Resizable Divider */}
      <div
        ref={dividerRef}
        onMouseDown={handleMouseDown}
        className={`
          w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize flex-shrink-0 relative
          transition-colors duration-150
          ${isDragging ? "bg-blue-400" : ""}
        `}
      >
        {/* Visual indicator */}
        <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-1 bg-gray-400 opacity-0 hover:opacity-100 transition-opacity duration-150" />

        {/* Hover area for better UX */}
        <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
      </div>

      {/* Right Panel */}
      <div
        style={{ width: `${rightWidth}%` }}
        className="flex-shrink-0 flex flex-col h-full"
      >
        {rightPanel}
      </div>
    </div>
  );
};

export default ResizablePanels;
