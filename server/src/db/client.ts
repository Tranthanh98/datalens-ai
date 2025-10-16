/**
 * PostgreSQL database client for DataLens AI
 * Provides connection pool and query interface for the application database
 */

import { Pool, QueryResult } from "pg";

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number; // Maximum number of clients in the pool
  idleTimeoutMillis?: number; // How long a client can be idle before being closed
}

class PostgresClient {
  private pool: Pool | null = null;
  private config: DatabaseConfig | null = null;

  /**
   * Initialize database connection pool
   */
  initialize(config: DatabaseConfig): void {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });

    console.log(
      `✓ PostgreSQL connection pool initialized for ${config.database}`
    );
  }

  /**
   * Get the pool instance
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error(
        "Database pool not initialized. Call initialize() first."
      );
    }
    return this.pool;
  }

  /**
   * Execute a query
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T extends Record<string, any> = any>(
    text: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: any[]
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error(
        "Database pool not initialized. Call initialize() first."
      );
    }

    try {
      const start = Date.now();
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      // Log slow queries (> 1000ms)
      if (duration > 1000) {
        console.warn(
          `Slow query detected (${duration}ms):`,
          text.substring(0, 100)
        );
      }

      return result;
    } catch (error) {
      console.error("Database query error:", error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query("SELECT NOW() as current_time");
      console.log("✓ Database connection test successful:", result.rows[0]);
      return true;
    } catch (error) {
      console.error("Database connection test failed:", error);
      return false;
    }
  }

  /**
   * Get connection pool stats
   */
  getStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } | null {
    if (!this.pool) return null;

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      console.log("✓ Database connection pool closed");
      this.pool = null;
    }
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.pool !== null;
  }
}

// Export singleton instance
export const dbClient = new PostgresClient();

/**
 * Initialize database from environment variables
 */
export function initializeFromEnv(): void {
  const config: DatabaseConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "datalens_ai",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    ssl: process.env.DB_SSL === "true",
    max: parseInt(process.env.DB_POOL_MAX || "20", 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
  };

  dbClient.initialize(config);
}

export default dbClient;
