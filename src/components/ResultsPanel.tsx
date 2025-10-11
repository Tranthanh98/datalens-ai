import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LegacyQueryResult } from "../db/adapters";

interface QueryResult {
  id: string;
  query: string;
  data: any[];
  chartType?: "bar" | "line" | "pie";
  timestamp: Date;
}

interface ResultsPanelProps {}

/**
 * Results panel component displaying query results and data visualizations
 * Shows charts and tabular data based on AI-generated queries
 */
const ResultsPanel: React.FC<ResultsPanelProps> = () => {
  const [activeTab, setActiveTab] = useState<"chart" | "table">("chart");

  const [queryResults, setQueryResults] = useState<LegacyQueryResult[]>([]);
  const [selectedResult, setSelectedResult] =
    useState<LegacyQueryResult | null>(null);

  // Sample data for demonstration
  const sampleData = [
    { name: "Jan", value: 400 },
    { name: "Feb", value: 300 },
    { name: "Mar", value: 600 },
    { name: "Apr", value: 800 },
    { name: "May", value: 500 },
  ];

  const currentData = selectedResult?.data || sampleData;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Results Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Results</h2>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4">
        {!selectedResult && queryResults.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>Query results will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("chart")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "chart"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Chart
              </button>
              <button
                onClick={() => setActiveTab("table")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "table"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Table
              </button>
            </div>

            {/* Chart View */}
            {activeTab === "chart" && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currentData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table View */}
            {activeTab === "table" && (
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      {currentData.length > 0 &&
                        Object.keys(currentData[0]).map((key) => (
                          <th
                            key={key}
                            className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b border-gray-200"
                          >
                            {key}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {Object.values(row).map((value, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200"
                          >
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Query Information */}
            {selectedResult && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Generated Query:
                </h3>
                <code className="text-xs text-gray-600 bg-white p-2 rounded border block">
                  {selectedResult.query}
                </code>
                <p className="text-xs text-gray-500 mt-2">
                  Executed at: {selectedResult.timestamp.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsPanel;
