import * as sql from "mssql";
import { Pool } from "pg";
import { DatabaseConnection, DatabaseSchema, QueryResult } from "../types";

/**
 * Database service for handling connections and queries
 */
export class DatabaseService {
  /**
   * Test database connection
   */
  static async testConnection(
    connection: DatabaseConnection
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (connection.type) {
        case "postgresql":
          return await this.testPostgreSQLConnection(connection);
        case "mssql":
          return await this.testMSSQLConnection(connection);
        default:
          return { success: false, error: "Unsupported database type" };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Test PostgreSQL connection
   */
  private static async testPostgreSQLConnection(
    connection: DatabaseConnection
  ): Promise<{ success: boolean; error?: string }> {
    let client;
    try {
      const pool = new Pool({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.username,
        password: connection.password,
        ssl: connection.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
      });

      client = await pool.connect();
      await client.query("SELECT 1");

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Test MSSQL connection
   */
  private static async testMSSQLConnection(
    connection: DatabaseConnection
  ): Promise<{ success: boolean; error?: string }> {
    const pool = new sql.ConnectionPool({
      server: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password: connection.password,
      options: {
        encrypt: connection.ssl || false,
        trustServerCertificate: true,
      },
      connectionTimeout: 10000,
    });

    try {
      await pool.connect();
      await pool.request().query("SELECT 1");

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    } finally {
      await pool.close();
    }
  }

  /**
   * Fetch database schema
   */
  static async fetchSchema(
    connection: DatabaseConnection
  ): Promise<{ success: boolean; schema?: DatabaseSchema[]; error?: string }> {
    try {
      switch (connection.type) {
        case "postgresql":
          return await this.fetchPostgreSQLSchema(connection);
        case "mssql":
          return await this.fetchMSSQLSchema(connection);
        default:
          return { success: false, error: "Unsupported database type" };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch schema",
      };
    }
  }

  /**
   * Fetch PostgreSQL schema
   */
  private static async fetchPostgreSQLSchema(
    connection: DatabaseConnection
  ): Promise<{ success: boolean; schema?: DatabaseSchema[]; error?: string }> {
    let client;
    try {
      const pool = new Pool({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.username,
        password: connection.password,
        ssl: connection.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
      });

      client = await pool.connect();

      const schemaQuery = `
        SELECT 
          t.table_name,
          t.table_schema,
          (
            SELECT json_agg(
              json_build_object(
                'column_name', c.column_name,
                'data_type', c.data_type,
                'is_nullable', c.is_nullable,
                'is_primary_key', 
                  (pk.column_name IS NOT NULL),
                'is_foreign_key',
                  (fk.column_name IS NOT NULL),
                'references', 
                  CASE WHEN fk.column_name IS NOT NULL 
                       THEN json_build_object(
                              'referenced_table', fk.foreign_table_name,
                              'referenced_column', fk.foreign_column_name
                            )
                       ELSE NULL END
              ) ORDER BY c.ordinal_position
            )
            FROM information_schema.columns c
            LEFT JOIN (
              SELECT
                ku.table_name,
                ku.column_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage ku 
                ON tc.constraint_name = ku.constraint_name
              WHERE tc.constraint_type = 'PRIMARY KEY'
            ) pk
              ON pk.table_name = c.table_name AND pk.column_name = c.column_name
            LEFT JOIN (
              SELECT
                kcu.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
              FROM information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
              JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
              WHERE tc.constraint_type = 'FOREIGN KEY'
            ) fk
              ON fk.table_name = c.table_name AND fk.column_name = c.column_name
            WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name
          ) AS columns
        FROM information_schema.tables t
        WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          AND t.table_type = 'BASE TABLE'
          and t.table_name not like '%migration%';
      `;

      const result = await client.query(schemaQuery);

      return {
        success: true,
        schema: result.rows as DatabaseSchema[],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch schema",
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Fetch MSSQL schema
   */
  private static async fetchMSSQLSchema(
    connection: DatabaseConnection
  ): Promise<{ success: boolean; schema?: DatabaseSchema[]; error?: string }> {
    const pool = new sql.ConnectionPool({
      server: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password: connection.password,
      options: {
        encrypt: connection.ssl || false,
        trustServerCertificate: true,
      },
      connectionTimeout: 10000,
    });

    try {
      await pool.connect();

      const schemaQuery = `
        SELECT
            t.TABLE_NAME as table_name,
            t.TABLE_SCHEMA as table_schema,
            (
                SELECT
                    c.COLUMN_NAME as column_name,
                    c.DATA_TYPE as data_type,
                    CAST(CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END as bit) as is_nullable,
                    CAST(CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as bit) as is_primary_key,
                    CAST(CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as bit) as is_foreign_key,
                    CASE WHEN fk.COLUMN_NAME IS NOT NULL
                        THEN JSON_QUERY((
                            SELECT
                                fk.REFERENCED_TABLE_NAME as referenced_table,
                                fk.REFERENCED_COLUMN_NAME as referenced_column
                            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                        ))
                    END as [references]
                FROM INFORMATION_SCHEMA.COLUMNS c
                LEFT JOIN (
                    SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                        AND tc.TABLE_NAME = kcu.TABLE_NAME
                    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                        AND tc.TABLE_SCHEMA = 'dbo'
                ) pk ON pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME
                LEFT JOIN (
                    SELECT
                        kcu.TABLE_NAME,
                        kcu.COLUMN_NAME,
                        ccu.TABLE_NAME AS REFERENCED_TABLE_NAME,
                        ccu.COLUMN_NAME AS REFERENCED_COLUMN_NAME
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                        AND tc.TABLE_NAME = kcu.TABLE_NAME
                    JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
                        ON ccu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
                    WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
                        AND tc.TABLE_SCHEMA = 'dbo'
                ) fk ON fk.TABLE_NAME = c.TABLE_NAME AND fk.COLUMN_NAME = c.COLUMN_NAME
                WHERE c.TABLE_SCHEMA = 'dbo'
                    AND c.TABLE_NAME = t.TABLE_NAME
                ORDER BY c.ORDINAL_POSITION
                FOR JSON PATH
            ) as [columns]
        FROM INFORMATION_SCHEMA.TABLES t
        WHERE t.TABLE_SCHEMA = 'dbo'
            AND t.TABLE_TYPE = 'BASE TABLE'
            AND t.TABLE_NAME NOT LIKE '%log%'
            AND t.TABLE_NAME NOT LIKE '%audit%'
            AND t.TABLE_NAME NOT LIKE '%vw%'
            AND t.TABLE_NAME NOT LIKE '%migration%'
            AND t.TABLE_NAME not like '%WebMenu%'
            AND (t.TABLE_NAME like '%Retailer%'
              OR t.TABLE_NAME like '%Matter%'
              OR t.TABLE_NAME like '%Client%'
              OR t.TABLE_NAME like '%Login%'
              OR t.TABLE_NAME like '%Order%'
              OR t.TABLE_NAME like '%Service%'
              OR t.TABLE_NAME like '%Role%'
              OR t.TABLE_NAME like '%Quote%'
              OR t.TABLE_NAME like '%Status%'
          )
        ORDER BY t.TABLE_NAME;
      `;

      const result = await pool.request().query(schemaQuery);

      return {
        success: true,
        schema: result.recordset as DatabaseSchema[],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch schema",
      };
    } finally {
      await pool.close();
    }
  }

  /**
   * Execute SQL query
   */
  static async executeQuery(
    connection: DatabaseConnection,
    query: string
  ): Promise<QueryResult> {
    try {
      // Security: Only allow SELECT statements
      const trimmedQuery = query.trim().toUpperCase();
      if (
        trimmedQuery.includes("UPDATE") ||
        trimmedQuery.includes("DELETE") ||
        trimmedQuery.includes("INSERT")
      ) {
        return {
          success: false,
          error: "Only SELECT queries are allowed for security reasons",
        };
      }

      switch (connection.type) {
        case "postgresql":
          return await this.executePostgreSQLQuery(connection, query);
        case "mssql":
          return await this.executeMSSQLQuery(connection, query);
        default:
          return { success: false, error: "Unsupported database type" };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Query execution failed",
      };
    }
  }

  /**
   * Execute PostgreSQL query
   */
  private static async executePostgreSQLQuery(
    connection: DatabaseConnection,
    query: string
  ): Promise<QueryResult> {
    let client;
    try {
      const pool = new Pool({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.username,
        password: connection.password,
        ssl: connection.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
      });

      client = await pool.connect();
      const result = await client.query(query);

      return {
        success: true,
        data: result.rows,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Query execution failed",
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Execute MSSQL query
   */
  private static async executeMSSQLQuery(
    connection: DatabaseConnection,
    query: string
  ): Promise<QueryResult> {
    const pool = new sql.ConnectionPool({
      server: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password: connection.password,
      options: {
        encrypt: connection.ssl || false,
        trustServerCertificate: true,
      },
      connectionTimeout: 10000,
    });

    try {
      await pool.connect();
      const result = await pool.request().query(query);

      return {
        success: true,
        data: result.recordset,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Query execution failed",
      };
    } finally {
      await pool.close();
    }
  }
}
