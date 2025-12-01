/**
 * Pinned Chart API Service
 * Handles all pinned chart API calls to the backend
 */

export interface PinnedChart {
  id?: number;
  databaseId: number;
  title: string;
  sqlQuery: string;
  chartType: "bar" | "pie" | "line";
  xAxisKey: string;
  yAxisKey: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const getServerUrl = () => {
  return import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
};

/**
 * Pinned Chart API Service
 */
export class PinnedChartApiService {
  /**
   * Get all pinned charts for a database
   */
  static async getByDatabaseId(databaseId: number): Promise<PinnedChart[]> {
    try {
      const response = await fetch(
        `${getServerUrl()}/api/pinned-charts/database/${databaseId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<PinnedChart[]> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to fetch pinned charts");
      }

      return result.data;
    } catch (error) {
      console.error("Error fetching pinned charts:", error);
      throw error;
    }
  }

  /**
   * Get pinned chart by ID
   */
  static async getById(id: number): Promise<PinnedChart> {
    try {
      const response = await fetch(`${getServerUrl()}/api/pinned-charts/${id}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<PinnedChart> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to fetch pinned chart");
      }

      return result.data;
    } catch (error) {
      console.error("Error fetching pinned chart:", error);
      throw error;
    }
  }

  /**
   * Create a new pinned chart
   */
  static async create(
    chart: Omit<PinnedChart, "id" | "createdAt" | "updatedAt">
  ): Promise<PinnedChart> {
    try {
      const response = await fetch(`${getServerUrl()}/api/pinned-charts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chart),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<PinnedChart> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to create pinned chart");
      }

      return result.data;
    } catch (error) {
      console.error("Error creating pinned chart:", error);
      throw error;
    }
  }

  /**
   * Update a pinned chart
   */
  static async update(
    id: number,
    updates: Partial<PinnedChart>
  ): Promise<PinnedChart> {
    try {
      const response = await fetch(
        `${getServerUrl()}/api/pinned-charts/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<PinnedChart> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to update pinned chart");
      }

      return result.data;
    } catch (error) {
      console.error("Error updating pinned chart:", error);
      throw error;
    }
  }

  /**
   * Delete a pinned chart
   */
  static async delete(id: number): Promise<void> {
    try {
      const response = await fetch(
        `${getServerUrl()}/api/pinned-charts/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<null> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to delete pinned chart");
      }
    } catch (error) {
      console.error("Error deleting pinned chart:", error);
      throw error;
    }
  }
}

export default PinnedChartApiService;
