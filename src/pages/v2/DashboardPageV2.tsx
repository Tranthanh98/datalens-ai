import {
  AlertCircle,
  LayoutDashboard,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import ConversationSidebarV2 from "../../components/v2/ConversationSidebarV2";
import DatabaseSelector from "../../components/v2/DatabaseSelector";
import {
  PinnedChartApiService,
  type PinnedChart,
} from "../../services/pinnedChartApiService";
import { QueryExecutionApiService } from "../../services/queryExecutionApiService";
import { useDatabaseStore } from "../../store";

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

// Chart with loaded data
interface ChartWithData extends PinnedChart {
  data?: Record<string, unknown>[];
  isLoading?: boolean;
  error?: string;
}

/**
 * Dashboard Chart Card component
 */
const DashboardChartCard: React.FC<{
  chart: ChartWithData;
  onDelete: (id: number) => void;
  isDeleting?: boolean;
}> = ({ chart, onDelete, isDeleting }) => {
  const renderChart = () => {
    if (chart.isLoading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading data...</span>
          </div>
        </div>
      );
    }

    if (chart.error) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center px-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <span className="text-sm text-red-600">{chart.error}</span>
          </div>
        </div>
      );
    }

    if (!chart.data || chart.data.length === 0) {
      return (
        <div className="h-full flex items-center justify-center">
          <span className="text-sm text-gray-500">No data available</span>
        </div>
      );
    }

    const { chartType, xAxisKey = "name", yAxisKey = "value", data } = chart;

    const chartContent = (() => {
      switch (chartType) {
        case "bar":
          return (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
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
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
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
                outerRadius={80}
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
    })();

    if (!chartContent) {
      return (
        <div className="h-full flex items-center justify-center">
          <span className="text-sm text-gray-500">Unknown chart type</span>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        {chartContent}
      </ResponsiveContainer>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden group">
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 truncate">
            {chart.title}
          </h3>
          {chart.description && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {chart.description}
            </p>
          )}
        </div>
        <button
          onClick={() => chart.id && onDelete(chart.id)}
          disabled={isDeleting}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
          title="Remove from dashboard"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Chart Area */}
      <div className="h-64 p-4">{renderChart()}</div>
    </div>
  );
};

/**
 * DashboardPageV2 - Dashboard page with pinned charts
 * Features:
 * - Auto-refresh every 30 seconds
 * - 2-column grid layout
 * - Charts filtered by selected database
 */
const DashboardPageV2 = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [charts, setCharts] = useState<ChartWithData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  console.log("DashboardPageV2 render", charts);

  const {
    selectedDatabase,
    loadDatabases,
    isLoading: dbLoading,
  } = useDatabaseStore();

  // Load databases on mount
  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

  /**
   * Fetch chart data by executing SQL query
   */
  const fetchChartData = useCallback(
    async (chart: PinnedChart): Promise<ChartWithData> => {
      if (!selectedDatabase?.id) {
        return { ...chart, error: "No database selected" };
      }

      try {
        const rawData = await QueryExecutionApiService.executeQuery(
          parseInt(selectedDatabase.id, 10),
          chart.sqlQuery
        );

        console.log(`Fetched data for chart ${chart.id}:`, rawData);

        // Ensure data is an array
        if (!Array.isArray(rawData) || rawData.length === 0) {
          return { ...chart, data: [], isLoading: false };
        }

        // Get the column names from the first row
        const columns = Object.keys(rawData[0] as Record<string, unknown>);

        // Determine actual xAxisKey and yAxisKey
        let actualXAxisKey = chart.xAxisKey;
        let actualYAxisKey = chart.yAxisKey;

        // If xAxisKey or yAxisKey don't exist in data, try to auto-detect
        if (
          !columns.includes(chart.xAxisKey) ||
          !columns.includes(chart.yAxisKey)
        ) {
          // Find a numeric column for Y axis (value)
          const numericColumn = columns.find((col) => {
            const value = (rawData[0] as Record<string, unknown>)[col];
            return (
              typeof value === "number" ||
              (typeof value === "string" && !isNaN(Number(value)))
            );
          });

          // Find a string column for X axis (label)
          const stringColumn = columns.find((col) => {
            const value = (rawData[0] as Record<string, unknown>)[col];
            return typeof value === "string" && isNaN(Number(value));
          });

          // Use detected columns or fallback to first columns
          actualXAxisKey = stringColumn || columns[0];
          actualYAxisKey = numericColumn || columns[columns.length - 1];
        }

        // Transform data and cast values properly for charts
        const data = rawData.map((row) => {
          const typedRow = row as Record<string, unknown>;
          const newRow: Record<string, unknown> = {};

          for (const [key, value] of Object.entries(typedRow)) {
            // Convert numeric strings to numbers for chart rendering
            if (typeof value === "string" && !isNaN(Number(value))) {
              newRow[key] = Number(value);
            } else if (typeof value === "number") {
              newRow[key] = value;
            } else {
              newRow[key] = value;
            }
          }

          // Create a combined "name" field if needed (for display on X axis)
          if (actualXAxisKey !== "name" && !columns.includes("name")) {
            // If X axis is a name-like field, combine first/last name if available
            if (typedRow["FirstName"] || typedRow["LastName"]) {
              newRow["name"] = [typedRow["FirstName"], typedRow["LastName"]]
                .filter(Boolean)
                .join(" ");
            } else {
              newRow["name"] = String(typedRow[actualXAxisKey] ?? "");
            }
          }

          // Create a "value" field if needed (for Y axis numeric value)
          if (actualYAxisKey !== "value" && !columns.includes("value")) {
            const yValue = typedRow[actualYAxisKey];
            newRow["value"] =
              typeof yValue === "string" ? Number(yValue) : yValue;
          }

          return newRow;
        });

        // Update the chart with detected keys if they were auto-detected
        const updatedChart: ChartWithData = {
          ...chart,
          data,
          isLoading: false,
          // Use "name" and "value" since we've transformed the data
          xAxisKey: "name",
          yAxisKey: "value",
        };

        return updatedChart;
      } catch (error) {
        console.error(`Failed to load chart ${chart.id}:`, error);
        return {
          ...chart,
          error: error instanceof Error ? error.message : "Failed to load data",
          isLoading: false,
        };
      }
    },
    [selectedDatabase?.id]
  );

  /**
   * Load all pinned charts for the selected database
   */
  const loadCharts = useCallback(async () => {
    if (!selectedDatabase?.id) {
      setCharts([]);
      setIsLoading(false);
      return;
    }

    setIsRefreshing(true);
    try {
      // Fetch pinned charts metadata
      const pinnedCharts = await PinnedChartApiService.getByDatabaseId(
        parseInt(selectedDatabase.id, 10)
      );

      // Set charts with loading state
      setCharts(pinnedCharts.map((chart) => ({ ...chart, isLoading: true })));
      setIsLoading(false);

      // Fetch data for each chart
      const chartsWithData = await Promise.all(
        pinnedCharts.map((chart) => fetchChartData(chart))
      );

      setCharts(chartsWithData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to load pinned charts:", error);
      setCharts([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDatabase?.id, fetchChartData]);

  // Load charts when database changes
  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadCharts();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [loadCharts]);

  /**
   * Handle manual refresh
   */
  const handleRefresh = () => {
    loadCharts();
  };

  /**
   * Handle delete chart
   */
  const handleDeleteChart = async (chartId: number) => {
    if (!window.confirm("Remove this chart from dashboard?")) return;

    setDeletingId(chartId);
    try {
      await PinnedChartApiService.delete(chartId);
      setCharts((prev) => prev.filter((chart) => chart.id !== chartId));
    } catch (error) {
      console.error("Failed to delete chart:", error);
      alert("Failed to remove chart. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  // Loading state
  if (dbLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // No database selected
  if (!selectedDatabase) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex flex-1">
          <ConversationSidebarV2
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <LayoutDashboard className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                Dashboard
              </h2>
              <p className="text-gray-500 mb-4">
                Please select a database to view your dashboard
              </p>
              <a
                href="/manage-database"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Manage Databases
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <ConversationSidebarV2
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Main Dashboard Area */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {/* Dashboard Header */}
          <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-5 h-5 text-gray-600" />
              <h1 className="text-lg font-semibold text-gray-800">Dashboard</h1>
              <span className="text-sm text-gray-500">
                ({charts.length} charts)
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* Last refresh time */}
              <span className="text-xs text-gray-400">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>

              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>

              {/* Database selector */}
              <DatabaseSelector />
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  <span className="text-gray-500">Loading charts...</span>
                </div>
              </div>
            ) : charts.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">
                    No pinned charts yet
                  </h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Pin charts from your chat conversations to see them here.
                    Look for the pin icon on chart visualizations.
                  </p>
                  <a
                    href="/v2/chat"
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Go to Chat
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {charts.map((chart) => (
                  <DashboardChartCard
                    key={chart.id}
                    chart={chart}
                    onDelete={handleDeleteChart}
                    isDeleting={deletingId === chart.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Auto-refresh indicator */}
          <div className="h-8 bg-white border-t border-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-400">
              Auto-refreshes every 30 seconds
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPageV2;
