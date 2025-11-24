/* eslint-disable @typescript-eslint/no-explicit-any */
import sql from "mssql";
import mysql from "mysql2/promise";
import { Pool } from "pg";
import { DatabaseConnectionInfo } from "../utils/schemaQueries";

/**
 * Service for executing SQL queries against different database types
 * Used by the AI service to execute generated queries
 */
export class QueryExecutionService {
  /**
   * Execute SQL query for PostgreSQL database
   */
  async executePostgreSQLQuery(
    connectionInfo: DatabaseConnectionInfo,
    query: string
  ): Promise<any> {
    let client;
    try {
      const pool = new Pool({
        host: connectionInfo.host,
        port: connectionInfo.port,
        database: connectionInfo.database,
        user: connectionInfo.username,
        password: connectionInfo.password,
        connectionTimeoutMillis: 10000,
      });

      client = await pool.connect();

      // Validate that the query is a SELECT statement
      const trimmedQuery = query.trim().toLowerCase();
      const forbidden = /(insert|update|delete|drop|alter|exec|create)\s/i;

      if (forbidden.test(trimmedQuery)) {
        throw new Error("Dangerous SQL keywords detected");
      }

      const result = await client.query(query);

      return {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields?.map((field) => ({
          name: field.name,
          dataTypeID: field.dataTypeID,
        })),
      };
    } catch (error) {
      console.error("PostgreSQL query execution error:", error);
      throw new Error(`Failed to execute PostgreSQL query: ${error}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Execute SQL query for MySQL database
   */
  async executeMySQLQuery(
    connectionInfo: DatabaseConnectionInfo,
    query: string
  ): Promise<any> {
    let connection;
    try {
      connection = await mysql.createConnection({
        host: connectionInfo.host,
        port: connectionInfo.port,
        database: connectionInfo.database,
        user: connectionInfo.username,
        password: connectionInfo.password,
        connectTimeout: 10000,
      });

      // Validate that the query is a SELECT statement
      const trimmedQuery = query.trim().toLowerCase();
      const forbidden = /(insert|update|delete|drop|alter|exec|create)\s/i;

      if (forbidden.test(trimmedQuery)) {
        throw new Error("Dangerous SQL keywords detected");
      }

      const [rows, fields] = await connection.execute(query);

      await connection.end();

      return {
        rows: rows,
        rowCount: Array.isArray(rows) ? rows.length : 0,
        fields: Array.isArray(fields)
          ? fields.map((field: any) => ({
              name: field.name,
              type: field.type,
            }))
          : [],
      };
    } catch (error) {
      console.error("MySQL query execution error:", error);
      throw new Error(`Failed to execute MySQL query: ${error}`);
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Execute SQL query for SQL Server database
   */
  async executeSQLServerQuery(
    connectionInfo: DatabaseConnectionInfo,
    query: string
  ): Promise<any> {
    const pool = new sql.ConnectionPool({
      server: connectionInfo.host,
      port: connectionInfo.port,
      database: connectionInfo.database,
      user: connectionInfo.username,
      password: connectionInfo.password,
      options: {
        encrypt: connectionInfo.ssl || false,
        trustServerCertificate: true,
      },
      connectionTimeout: 10000,
    });

    try {
      await pool.connect();

      // Validate that the query is a SELECT statement
      const trimmedQuery = query.trim().toLowerCase();
      const forbidden = /(insert|update|delete|drop|alter|exec|create)\s/i;

      if (forbidden.test(trimmedQuery)) {
        throw new Error("Dangerous SQL keywords detected");
      }

      const result = await pool.request().query(query);

      await pool.close();

      return {
        rows: result.recordset,
        rowCount: result.recordset.length,
        fields: result.recordset.columns
          ? Object.keys(result.recordset.columns).map((key) => ({
              name: key,
              type: result.recordset.columns[key].type,
            }))
          : [],
      };
    } catch (error) {
      console.error("SQL Server query execution error:", error);
      throw new Error(`Failed to execute SQL Server query: ${error}`);
    } finally {
      if (pool) {
        await pool.close();
      }
    }
  }

  /**
   * Execute SQL query based on database type
   */
  async executeQuery(
    connectionInfo: DatabaseConnectionInfo,
    query: string
  ): Promise<any> {
    // Additional security check at service level
    const trimmedQuery = query.trim().toLowerCase();
    const forbidden = /(insert|update|delete|drop|alter|exec|create)\s/i;

    if (forbidden.test(trimmedQuery)) {
      throw new Error("Dangerous SQL keywords detected");
    }

    switch (connectionInfo.type) {
      case "postgresql":
        return await this.executePostgreSQLQuery(connectionInfo, query);
      case "mysql":
        return await this.executeMySQLQuery(connectionInfo, query);
      case "mssql":
        return await this.executeSQLServerQuery(connectionInfo, query);
      default:
        throw new Error(`Unsupported database type: ${connectionInfo.type}`);
    }
  }
}
