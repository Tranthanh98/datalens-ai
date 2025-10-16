/**
 * Database migration runner for DataLens AI
 * Manages PostgreSQL schema migrations
 */

import fs from "fs";
import path from "path";
import { Pool } from "pg";

export interface MigrationConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export class MigrationRunner {
  private pool: Pool;
  private migrationsPath: string;

  constructor(config: MigrationConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    });

    // Path to migrations folder
    this.migrationsPath = path.join(__dirname, "../../db/migrations");
  }

  /**
   * Create migrations tracking table if it doesn't exist
   */
  private async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await this.pool.query(query);
      console.log("✓ Migrations tracking table ready");
    } catch (error) {
      console.error("Failed to create migrations table:", error);
      throw error;
    }
  }

  /**
   * Get list of executed migrations
   */
  private async getExecutedMigrations(): Promise<string[]> {
    try {
      const result = await this.pool.query(
        "SELECT migration_name FROM schema_migrations ORDER BY id"
      );
      return result.rows.map((row) => row.migration_name);
    } catch (error) {
      console.error("Failed to get executed migrations:", error);
      return [];
    }
  }

  /**
   * Get list of migration files from migrations folder
   */
  private getMigrationFiles(): string[] {
    try {
      if (!fs.existsSync(this.migrationsPath)) {
        console.warn(`Migrations folder not found: ${this.migrationsPath}`);
        return [];
      }

      return fs
        .readdirSync(this.migrationsPath)
        .filter((file) => file.endsWith(".sql"))
        .sort(); // Sort to ensure migrations run in order
    } catch (error) {
      console.error("Failed to read migration files:", error);
      return [];
    }
  }

  /**
   * Execute a single migration file
   */
  private async executeMigration(migrationFile: string): Promise<void> {
    const migrationPath = path.join(this.migrationsPath, migrationFile);
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    const client = await this.pool.connect();

    try {
      // Start transaction
      await client.query("BEGIN");

      // Execute migration SQL
      await client.query(migrationSql);

      // Record migration in tracking table
      await client.query(
        "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
        [migrationFile]
      );

      // Commit transaction
      await client.query("COMMIT");

      console.log(`✓ Executed migration: ${migrationFile}`);
    } catch (error) {
      // Rollback on error
      await client.query("ROLLBACK");
      console.error(`✗ Failed to execute migration ${migrationFile}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      console.log("🔄 Starting database migrations...");

      // Create migrations tracking table
      await this.createMigrationsTable();

      // Get executed and pending migrations
      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = this.getMigrationFiles();

      const pendingMigrations = migrationFiles.filter(
        (file) => !executedMigrations.includes(file)
      );

      if (pendingMigrations.length === 0) {
        console.log("✓ All migrations are up to date");
        return;
      }

      console.log(`Found ${pendingMigrations.length} pending migration(s)`);

      // Execute pending migrations in order
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      console.log("✓ All migrations completed successfully");
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  }

  /**
   * Check if database connection is valid
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch (error) {
      console.error("Database connection failed:", error);
      return false;
    }
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    executed: string[];
    pending: string[];
    total: number;
  }> {
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = this.getMigrationFiles();
    const pendingMigrations = migrationFiles.filter(
      (file) => !executedMigrations.includes(file)
    );

    return {
      executed: executedMigrations,
      pending: pendingMigrations,
      total: migrationFiles.length,
    };
  }
}

/**
 * Helper function to run migrations from environment variables
 */
export async function runMigrationsFromEnv(): Promise<void> {
  const config: MigrationConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "datalens_ai",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD?.toString() || "",
    ssl: process.env.DB_SSL === "true",
  };

  const runner = new MigrationRunner(config);

  try {
    // Test connection first
    const isConnected = await runner.testConnection();
    if (!isConnected) {
      throw new Error("Failed to connect to database");
    }

    console.log("✓ Database connection established");

    // Run migrations
    await runner.runMigrations();
  } catch (error) {
    console.error("Migration process failed:", error);
    throw error;
  } finally {
    await runner.close();
  }
}
