/**
 * Schema Search Service
 * Handles semantic search for similar database tables
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface SimilarTableResult {
  schema: {
    tableName: string;
    tableDescription: string;
    columns: Array<{
      columnName: string;
      dataType: string;
      description?: string;
      isPrimaryKey?: boolean;
      isForeignKey?: boolean;
      referencedTable?: string;
    }>;
  };
  similarity: number;
}

export interface SearchSimilarTablesResponse {
  success: boolean;
  data?: SimilarTableResult[];
  query?: string;
  resultsCount?: number;
  error?: string;
}

/**
 * Search for similar tables using semantic search
 */
export async function searchSimilarTables(
  databaseId: number,
  query: string,
  limit: number = 20
): Promise<SearchSimilarTablesResponse> {
  try {
    console.log(
      `Searching similar tables for database ${databaseId}, query: "${query}", limit: ${limit}`
    );

    const response = await fetch(
      `${API_BASE_URL}/api/database/${databaseId}/schema/search-similar-tables`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          limit,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `HTTP error! status: ${response.status}, body: ${errorText}`
      );
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: SearchSimilarTablesResponse = await response.json();

    console.log(
      `Search completed: ${result.success ? "success" : "failed"}, ${
        result.resultsCount || 0
      } results`
    );

    return result;
  } catch (error) {
    console.error("Failed to search similar tables:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const SchemaSearchService = {
  searchSimilarTables,
};

export default SchemaSearchService;
