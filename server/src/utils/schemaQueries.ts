import { readFileSync } from "fs";
import { join } from "path";

export type DatabaseType = "postgresql" | "mysql" | "mssql";

/**
 * Schema query loader utility for server-side
 * Loads SQL queries for different database types from .sql files
 */
export class SchemaQueryLoader {
  /**
   * Load SQL query for a specific database type
   */
  getQuery(dbType: DatabaseType): string {
    const fileName = this.getQueryFileName(dbType);
    const queryPath = join(__dirname, "../../db/get-schema", fileName);

    try {
      const query = readFileSync(queryPath, "utf-8");
      return query;
    } catch (error) {
      throw new Error(`Failed to load schema query for ${dbType}: ${error}`);
    }
  }

  /**
   * Get the appropriate SQL file name for database type
   */
  private getQueryFileName(dbType: DatabaseType): string {
    switch (dbType) {
      case "postgresql":
        return "postgres.sql";
      case "mysql":
        return "mysql.sql";
      case "mssql":
        return "mssql.sql";
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }
}

/**
 * Interface for database connection info
 */
export interface DatabaseConnectionInfo {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

/**
 * Get schema query for a specific database type
 */
export function getSchemaQuery(dbType: DatabaseType): string {
  const loader = new SchemaQueryLoader();
  return loader.getQuery(dbType);
}

/**
 * Get schema query based on database connection info
 */
export function getSchemaQueryForConnection(
  connectionInfo: DatabaseConnectionInfo
): string {
  const loader = new SchemaQueryLoader();
  return loader.getQuery(connectionInfo.type);
}
