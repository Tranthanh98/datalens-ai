/* eslint-disable @typescript-eslint/no-empty-object-type */
import { useLiveQuery } from "dexie-react-hooks";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QueryResultService } from "../db/services";
import { useChatStore } from "../store";

interface ResultsPanelProps {}

/**
 * Results panel component displaying query results and data visualizations
 * Shows charts and tabular data based on AI-generated queries
 */
const ResultsPanel: React.FC<ResultsPanelProps> = () => {
  // Get selected message ID from store
  const { selectedMessageId } = useChatStore();

  // Fetch query result data by messageId
  const queryResult = useLiveQuery(async () => {
    if (!selectedMessageId) return null;

    const result = await QueryResultService.getByMessageId(
      parseInt(selectedMessageId)
    );
    return result;
  }, [selectedMessageId]);

  const chartData = queryResult?.chartData;
  const sqlQuery = queryResult?.sqlQuery;
  const resultData = queryResult?.result;

  // Sample data for demonstration when no message selected
  const sampleData = [
    { name: "Jan", value: 400 },
    { name: "Feb", value: 300 },
    { name: "Mar", value: 600 },
    { name: "Apr", value: 800 },
    { name: "May", value: 500 },
  ];

  const currentData = chartData?.data || sampleData;
  const chartType = chartData?.type || "bar";

  // Colors for pie chart
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884D8",
    "#82CA9D",
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Results Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Results</h2>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        {!queryResult ? (
          <div className="text-center text-gray-500 mt-8">
            <p>Query results will appear here</p>
            <p className="text-sm mt-2">
              Click "View Result" on any AI response to see visualizations
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Chart Title */}
            {chartData?.description && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700">
                  {chartData.description}
                </h3>
              </div>
            )}

            {/* Chart View */}
            {chartType === "none" ? (
              <div className="text-center text-gray-500 p-8 bg-gray-50 rounded-lg">
                <p>No visualization available for this query result</p>
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
                    <BarChart data={currentData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey={chartData?.xAxisKey || "name"} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey={chartData?.yAxisKey || "value"}
                        fill="#3B82F6"
                      />
                    </BarChart>
                  ) : chartType === "pie" ? (
                    <PieChart>
                      <Pie
                        data={currentData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey={chartData?.yAxisKey || "value"}
                      >
                        {currentData.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  ) : (
                    <BarChart data={currentData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey={chartData?.xAxisKey || "name"} />
                      <YAxis />
                      <Tooltip />
                      <Bar
                        dataKey={chartData?.yAxisKey || "value"}
                        fill="#3B82F6"
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* Query Information */}
            {sqlQuery && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Generated SQL Query:
                </h3>
                <code className="text-xs text-gray-600 bg-white p-2 rounded border block overflow-x-auto">
                  {sqlQuery}
                </code>
                <p className="text-xs text-gray-500 mt-2">
                  Executed at: {queryResult.createdAt.toLocaleString()}
                </p>
                {resultData && (
                  <p className="text-xs text-gray-500 mt-1">
                    Rows: {resultData.rowCount} | Execution time:{" "}
                    {resultData.executionTime}ms
                  </p>
                )}
              </div>
            )}

            {/* Data Table */}
            {chartData && chartData.data && chartData.data.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Data Table
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300 text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        {Object.keys(chartData.data[0]).map((key) => (
                          <th
                            key={key}
                            className="border border-gray-300 px-3 py-2 text-left font-semibold"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          {Object.values(row).map((value, cellIdx) => (
                            <td
                              key={cellIdx}
                              className="border border-gray-300 px-3 py-2"
                            >
                              {String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsPanel;
