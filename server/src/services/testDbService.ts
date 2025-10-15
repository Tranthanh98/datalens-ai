import sql from "mssql";
import mysql from "mysql2/promise";
import { Pool } from "pg";
import { DatabaseConnection } from "../server";

/**
 * Test PostgreSQL connection
 */
export async function testPostgreSQLConnection(
  config: DatabaseConnection
): Promise<boolean> {
  let client;
  try {
    const pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      connectionTimeoutMillis: 5000,
      ssl: config.ssl || false,
    });

    client = await pool.connect();
    await client.query("SELECT 1");
    return true;
  } catch (error) {
    console.error("PostgreSQL connection error:", error);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Test MySQL connection
 */
export async function testMySQLConnection(
  config: DatabaseConnection
): Promise<boolean> {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      connectTimeout: 5000,
    });

    await connection.execute("SELECT 1");
    return true;
  } catch (error) {
    console.error("MySQL connection error:", error);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Test SQL Server connection
 */
export async function testSQLServerConnection(
  config: DatabaseConnection
): Promise<boolean> {
  try {
    const pool = new sql.ConnectionPool({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        encrypt: false, // Use true for Azure
        trustServerCertificate: true,
      },
      connectionTimeout: 5000,
    });

    await pool.connect();
    await pool.request().query("SELECT 1");
    await pool.close();
    return true;
  } catch (error) {
    console.error("SQL Server connection error:", error);
    return false;
  }
}
