import sql from "mssql";
import mysql from "mysql2/promise";
import { Pool } from "pg";
import {
  DatabaseConnectionInfo,
  SchemaQueryLoader,
} from "../utils/schemaQueries";

/**
 * Service for executing schema queries against different database types
 */
export class SchemaService {
  private queryLoader: SchemaQueryLoader;

  constructor() {
    this.queryLoader = new SchemaQueryLoader();
  }

  /**
   * Execute schema query for PostgreSQL database
   */
  async executePostgreSQLSchemaQuery(
    connectionInfo: DatabaseConnectionInfo
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
      const schemaQuery = this.queryLoader.getQuery("postgresql");
      const result = await client.query(schemaQuery);

      return result.rows[0]?.schema_json || [];
    } catch (error) {
      console.error("PostgreSQL schema query error:", error);
      throw new Error(`Failed to execute PostgreSQL schema query: ${error}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Execute schema query for MySQL database
   */
  async executeMySQLSchemaQuery(
    connectionInfo: DatabaseConnectionInfo
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

      const schemaQuery = this.queryLoader.getQuery("mysql");
      const [rows] = await connection.execute(schemaQuery);

      await connection.end();
      return (rows as any)[0]?.schema_json || [];
    } catch (error) {
      console.error("MySQL schema query error:", error);
      throw new Error(`Failed to execute MySQL schema query: ${error}`);
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Execute schema query for SQL Server database
   */
  async executeSQLServerSchemaQuery(
    connectionInfo: DatabaseConnectionInfo
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
      const schemaQuery = this.queryLoader.getQuery("mssql");
      const result = await pool.request().query(schemaQuery);

      await pool.close();

      return result.recordset[0]?.schema_json || [];
    } catch (error) {
      console.error("SQL Server schema query error:", error);
      throw new Error(`Failed to execute SQL Server schema query: ${error}`);
    } finally {
      if (pool) {
        await pool.close();
      }
    }
  }

  /**
   * Execute schema query based on database type
   */
  async executeSchemaQuery(
    connectionInfo: DatabaseConnectionInfo
  ): Promise<any> {
    switch (connectionInfo.type) {
      case "postgresql":
        return await this.executePostgreSQLSchemaQuery(connectionInfo);
      case "mysql":
        return await this.executeMySQLSchemaQuery(connectionInfo);
      case "mssql":
        return await this.executeSQLServerSchemaQuery(connectionInfo);
      default:
        throw new Error(`Unsupported database type: ${connectionInfo.type}`);
    }
  }
}
