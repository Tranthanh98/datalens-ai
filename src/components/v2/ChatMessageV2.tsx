import { BarChart3, Check, Copy } from "lucide-react";
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
 * Chart component that renders different chart types
 */
const ChartDisplay: React.FC<{ chartData: ChartData }> = memo(
  ({ chartData }) => {
    const {
      type,
      data,
      xAxisKey = "name",
      yAxisKey = "value",
      description,
    } = chartData;

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

    return (
      <div className="my-4 p-4 bg-white border border-gray-200 rounded-lg">
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
      </div>
    );
  }
);

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
                    <ChartDisplay chartData={chartData} />
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
