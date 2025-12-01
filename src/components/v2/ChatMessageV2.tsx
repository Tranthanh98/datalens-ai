import { BarChart3, Check, Copy, Pin, X } from "lucide-react";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import remarkGfm from "remark-gfm";
import { PinnedChartApiService } from "../../services/pinnedChartApiService";
import { useDatabaseStore } from "../../store";

// Chart data types
interface ChartData {
  type: "bar" | "pie" | "line" | "none";
  data: Record<string, unknown>[];
  xAxisKey?: string;
  yAxisKey?: string;
  description?: string;
}

// Query result types
interface QueryResultData {
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  executionTime: number;
}

interface ChatMessageV2Props {
  id: string;
  content: string;
  type: "user" | "ai";
  timestamp: Date;
  sqlQuery?: string;
  chartData?: ChartData | null;
  queryResult?: QueryResultData | null;
  databaseId?: number;
}

// Colors for pie chart
const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

/**
 * SQL Code Block component with syntax highlighting and copy button
 */
const SQLCodeBlock: React.FC<{ code: string }> = memo(({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-gray-200">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-200">
        <span className="text-xs font-medium">SQL</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-4 bg-gray-900 text-gray-100 text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
});

SQLCodeBlock.displayName = "SQLCodeBlock";

/**
 * Pin Chart Modal component
 */
const PinChartModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
  defaultTitle?: string;
  isLoading?: boolean;
}> = memo(
  ({ isOpen, onClose, onSave, defaultTitle = "", isLoading = false }) => {
    const [title, setTitle] = useState(defaultTitle);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (title.trim()) {
        onSave(title.trim());
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Pin to Dashboard
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chart Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter chart title..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || isLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Pin className="w-4 h-4" />
                    Pin Chart
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
);

PinChartModal.displayName = "PinChartModal";

/**
 * Chart component that renders different chart types
 */
const ChartDisplay: React.FC<{
  chartData: ChartData;
  sqlQuery?: string;
}> = memo(({ chartData, sqlQuery }) => {
  const [showPinModal, setShowPinModal] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const { selectedDatabase } = useDatabaseStore();

  const {
    type,
    data,
    xAxisKey = "name",
    yAxisKey = "value",
    description,
  } = chartData;

  /**
   * Handle pin chart to dashboard
   */
  const handlePinChart = async (title: string) => {
    if (!selectedDatabase?.id || !sqlQuery) return;

    setIsPinning(true);
    try {
      await PinnedChartApiService.create({
        databaseId: parseInt(selectedDatabase.id, 10),
        title,
        sqlQuery,
        chartType: type as "bar" | "pie" | "line",
        xAxisKey,
        yAxisKey,
        description,
      });
      setIsPinned(true);
      setShowPinModal(false);
    } catch (error) {
      console.error("Failed to pin chart:", error);
      alert("Failed to pin chart. Please try again.");
    } finally {
      setIsPinning(false);
    }
  };

  if (type === "none" || !data || data.length === 0) {
    return null;
  }

  const renderChart = () => {
    switch (type) {
      case "bar":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Legend />
            <Bar dataKey={yAxisKey} fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        );

      case "line":
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={yAxisKey}
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: "#3B82F6", strokeWidth: 2 }}
            />
          </LineChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={100}
              fill="#8884d8"
              dataKey={yAxisKey}
            >
              {data.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Legend />
          </PieChart>
        );

      default:
        return null;
    }
  };

  // Check if pin button should be shown
  const canPin = sqlQuery && selectedDatabase?.id && !isPinned;

  return (
    <div className="my-4 p-4 bg-white border border-gray-200 rounded-lg relative group">
      {/* Pin Button */}
      {canPin && (
        <button
          onClick={() => setShowPinModal(true)}
          className="absolute top-2 right-2 p-2 rounded-lg bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
          title="Pin to Dashboard"
        >
          <Pin className="w-4 h-4" />
        </button>
      )}

      {/* Pinned indicator */}
      {isPinned && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs">
          <Check className="w-3 h-3" />
          Pinned
        </div>
      )}

      {description && (
        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          {description}
        </h4>
      )}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Pin Modal */}
      <PinChartModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSave={handlePinChart}
        defaultTitle={description || "Chart"}
        isLoading={isPinning}
      />
    </div>
  );
});

ChartDisplay.displayName = "ChartDisplay";

/**
 * Data Table component for displaying query results
 */
const DataTable: React.FC<{
  data: Record<string, unknown>[];
  maxRows?: number;
}> = memo(({ data, maxRows = 10 }) => {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);
  const displayData = data.slice(0, maxRows);
  const hasMore = data.length > maxRows;

  return (
    <div className="my-4 overflow-hidden border border-gray-200 rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayData.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <td
                    key={`${rowIndex}-${column}`}
                    className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap"
                  >
                    {String(row[column] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t border-gray-200">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
});

DataTable.displayName = "DataTable";

/**
 * Individual chat message component for V2
 * Supports markdown, SQL code blocks, charts, and data tables
 */
const ChatMessageV2: React.FC<ChatMessageV2Props> = memo(
  ({ content, type, timestamp, sqlQuery, chartData, queryResult }) => {
    const isUser = type === "user";

    return (
      <div className={`py-6 ${isUser ? "bg-white" : "bg-gray-50"}`}>
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-4">
            {/* Avatar */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                isUser ? "bg-blue-600" : "bg-green-600"
              }`}
            >
              {isUser ? "U" : "AI"}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Role label */}
              <div className="text-sm font-medium text-gray-900 mb-1">
                {isUser ? "You" : "DataLens AI"}
              </div>

              {/* Message content */}
              {isUser ? (
                <p className="text-gray-700">{content}</p>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-xl font-bold mb-3 text-gray-900 mt-4 first:mt-0">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-lg font-bold mb-2 text-gray-900 mt-4 first:mt-0">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-base font-bold mb-2 text-gray-900 mt-3 first:mt-0">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="mb-3 text-gray-700 leading-relaxed last:mb-0">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-3 text-gray-700 space-y-1">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-3 text-gray-700 space-y-1">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-gray-700">{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-gray-900">
                          {children}
                        </strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic text-gray-700">{children}</em>
                      ),
                      code: ({ className, children }) => {
                        const isInline = !className;
                        if (isInline) {
                          return (
                            <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
                              {children}
                            </code>
                          );
                        }
                        return (
                          <code className="text-sm font-mono">{children}</code>
                        );
                      },
                      pre: ({ children }) => (
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg mb-3 overflow-x-auto text-sm">
                          {children}
                        </pre>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-3">
                          <table className="min-w-full border-collapse border border-gray-300">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-gray-100">{children}</thead>
                      ),
                      tbody: ({ children }) => <tbody>{children}</tbody>,
                      tr: ({ children }) => (
                        <tr className="border-b border-gray-300">{children}</tr>
                      ),
                      th: ({ children }) => (
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-gray-300 px-3 py-2 text-gray-700">
                          {children}
                        </td>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-3">
                          {children}
                        </blockquote>
                      ),
                      hr: () => <hr className="my-4 border-gray-300" />,
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          className="text-blue-600 hover:text-blue-800 underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>

                  {/* SQL Query Block */}
                  {sqlQuery && <SQLCodeBlock code={sqlQuery} />}

                  {/* Chart Display */}
                  {chartData && chartData.type !== "none" && (
                    <ChartDisplay chartData={chartData} sqlQuery={sqlQuery} />
                  )}

                  {/* Data Table */}
                  {queryResult &&
                    queryResult.data &&
                    queryResult.data.length > 0 && (
                      <DataTable data={queryResult.data} maxRows={10} />
                    )}

                  {/* Query metadata */}
                  {queryResult && (
                    <div className="mt-3 text-xs text-gray-500 flex items-center gap-3">
                      <span>{queryResult.rowCount} rows</span>
                      <span>•</span>
                      <span>{queryResult.executionTime}ms</span>
                    </div>
                  )}
                </div>
              )}

              {/* Timestamp */}
              <div className="mt-2 text-xs text-gray-400">
                {timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ChatMessageV2.displayName = "ChatMessageV2";

export default ChatMessageV2;
