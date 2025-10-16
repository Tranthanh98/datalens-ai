/**
 * Database Info Repository
 * Handles CRUD operations for database connections stored in PostgreSQL
 */

import { dbClient } from "../db/client";

export interface DatabaseInfo {
  id?: number;
  name: string;
  type: "postgresql" | "mysql" | "mssql";
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DatabaseInfoRepository {
  /**
   * Get all database connections
   */
  async getAll(): Promise<DatabaseInfo[]> {
    const result = await dbClient.query(
      `SELECT 
        id, name, type, connection_string as "connectionString",
        host, port, database, username, password, ssl,
        is_active as "isActive", created_at as "createdAt", 
        updated_at as "updatedAt"
      FROM database_info 
      ORDER BY created_at DESC`
    );

    return result.rows;
  }

  /**
   * Get active database connections
   */
  async getActive(): Promise<DatabaseInfo[]> {
    const result = await dbClient.query(
      `SELECT 
        id, name, type, connection_string as "connectionString",
        host, port, database, username, password, ssl,
        is_active as "isActive", created_at as "createdAt", 
        updated_at as "updatedAt"
      FROM database_info 
      WHERE is_active = true
      ORDER BY created_at DESC`
    );

    return result.rows;
  }

  /**
   * Get database connection by ID
   */
  async getById(id: string): Promise<DatabaseInfo | null> {
    const result = await dbClient.query(
      `SELECT 
        id, name, type, connection_string as "connectionString",
        host, port, database, username, password, ssl,
        is_active as "isActive", created_at as "createdAt", 
        updated_at as "updatedAt"
      FROM database_info 
      WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Create new database connection
   */
  async create(dbInfo: DatabaseInfo): Promise<DatabaseInfo> {
    const result = await dbClient.query(
      `INSERT INTO database_info 
        (name, type, connection_string, host, port, database, username, password, ssl, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING 
        id, name, type, connection_string as "connectionString",
        host, port, database, username, password, ssl,
        is_active as "isActive", created_at as "createdAt", 
        updated_at as "updatedAt"`,
      [
        dbInfo.name,
        dbInfo.type,
        dbInfo.connectionString,
        dbInfo.host,
        dbInfo.port,
        dbInfo.database,
        dbInfo.username,
        dbInfo.password,
        dbInfo.ssl || false,
        dbInfo.isActive,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update database connection
   */
  async update(
    id: string,
    dbInfo: Partial<DatabaseInfo>
  ): Promise<DatabaseInfo | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (dbInfo.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(dbInfo.name);
    }
    if (dbInfo.type !== undefined) {
      fields.push(`type = $${paramCount++}`);
      values.push(dbInfo.type);
    }
    if (dbInfo.connectionString !== undefined) {
      fields.push(`connection_string = $${paramCount++}`);
      values.push(dbInfo.connectionString);
    }
    if (dbInfo.host !== undefined) {
      fields.push(`host = $${paramCount++}`);
      values.push(dbInfo.host);
    }
    if (dbInfo.port !== undefined) {
      fields.push(`port = $${paramCount++}`);
      values.push(dbInfo.port);
    }
    if (dbInfo.database !== undefined) {
      fields.push(`database = $${paramCount++}`);
      values.push(dbInfo.database);
    }
    if (dbInfo.username !== undefined) {
      fields.push(`username = $${paramCount++}`);
      values.push(dbInfo.username);
    }
    if (dbInfo.password !== undefined) {
      fields.push(`password = $${paramCount++}`);
      values.push(dbInfo.password);
    }
    if (dbInfo.ssl !== undefined) {
      fields.push(`ssl = $${paramCount++}`);
      values.push(dbInfo.ssl);
    }
    if (dbInfo.isActive !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(dbInfo.isActive);
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);

    const result = await dbClient.query(
      `UPDATE database_info 
      SET ${fields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING 
        id, name, type, connection_string as "connectionString",
        host, port, database, username, password, ssl,
        is_active as "isActive", created_at as "createdAt", 
        updated_at as "updatedAt"`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete database connection
   */
  async delete(id: number): Promise<boolean> {
    const result = await dbClient.query(
      "DELETE FROM database_info WHERE id = $1",
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Set active database (deactivate all others)
   */
  async setActive(id: number): Promise<void> {
    const client = dbClient.getPool();
    const conn = await client.connect();

    try {
      await conn.query("BEGIN");

      // Deactivate all databases
      await conn.query("UPDATE database_info SET is_active = false");

      // Activate the selected one
      await conn.query(
        "UPDATE database_info SET is_active = true WHERE id = $1",
        [id]
      );

      await conn.query("COMMIT");
    } catch (error) {
      await conn.query("ROLLBACK");
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Count total databases
   */
  async count(): Promise<number> {
    const result = await dbClient.query(
      "SELECT COUNT(*) as count FROM database_info"
    );

    return parseInt(result.rows[0].count, 10);
  }
}

export const databaseInfoRepository = new DatabaseInfoRepository();
