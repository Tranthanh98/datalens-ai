/**
 * Schema Info Repository
 * Handles CRUD operations for cached database schemas stored in PostgreSQL
 * Each record represents one table's schema with its embedding
 */

import { dbClient } from "../db/client";
import type { TableSchema } from "../types/schema";

export interface TableSchemaInfo {
  id?: number;
  databaseId: number;
  tableName: string;
  tableSchema?: string; // Schema namespace (e.g., 'public', 'dbo')
  tableType?: string; // 'TABLE', 'VIEW', etc.
  schema: object; // Table schema data as JSON (columns, constraints, indexes)
  schemaText?: string; // Plain text representation for vector search
  schemaEmbedding?: number[]; // Vector embedding of table schema
  createdAt?: Date;
  updatedAt?: Date;
}

export class SchemaInfoRepository {
  /**
   * Get all table schemas for a database
   */
  async getByDatabaseId(databaseId: number): Promise<TableSchemaInfo[]> {
    const result = await dbClient.query(
      `SELECT 
        id, database_id as "databaseId", table_name as "tableName",
        table_schema as "tableSchema", table_type as "tableType",
        schema, schema_text as "schemaText",
        schema_embedding as "schemaEmbedding", 
        created_at as "createdAt", updated_at as "updatedAt"
      FROM schema_info 
      WHERE database_id = $1
      ORDER BY table_name`,
      [databaseId]
    );

    return result.rows;
  }

  /**
   * Get a specific table schema
   */
  async getTableSchema(
    databaseId: number,
    tableName: string,
    tableSchema: string = "public"
  ): Promise<TableSchemaInfo | null> {
    const result = await dbClient.query(
      `SELECT 
        id, database_id as "databaseId", table_name as "tableName",
        table_schema as "tableSchema", table_type as "tableType",
        schema, schema_text as "schemaText",
        schema_embedding as "schemaEmbedding", 
        created_at as "createdAt", updated_at as "updatedAt"
      FROM schema_info 
      WHERE database_id = $1 AND table_name = $2 AND table_schema = $3`,
      [databaseId, tableName, tableSchema]
    );

    return result.rows[0] || null;
  }

  /**
   * Save or update multiple table schemas with embeddings (batch insert)
   * This is the preferred method for saving schemas
   */
  async upsertTableSchemas(
    databaseId: number,
    tablesSchema: Array<{ schema: TableSchema; embedding: number[] }>,
    tableSchema: string = "public"
  ): Promise<number> {
    if (tablesSchema.length === 0) {
      return 0;
    }

    let insertedCount = 0;

    for (const tables of tablesSchema) {
      // Generate plain text representation for the table
      const schemaText = null;

      const table = tables.schema;

      await dbClient.query(
        `INSERT INTO schema_info 
          (database_id, table_name, table_schema, table_type, schema, schema_text, schema_embedding)
        VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
        ON CONFLICT (database_id, table_schema, table_name) 
        DO UPDATE SET 
          table_type = EXCLUDED.table_type,
          schema = EXCLUDED.schema,
          schema_text = EXCLUDED.schema_text,
          schema_embedding = EXCLUDED.schema_embedding,
          updated_at = CURRENT_TIMESTAMP`,
        [
          databaseId,
          table.tableName,
          tableSchema,
          "TABLE", // Default to TABLE, could be passed in if needed
          JSON.stringify(table),
          schemaText,
          tables.embedding && tables.embedding.length > 0
            ? `[${tables.embedding.join(",")}]`
            : null,
        ]
      );

      insertedCount++;
    }

    return insertedCount;
  }

  /**
   * Delete all table schemas for a database
   */
  async deleteByDatabaseId(databaseId: number): Promise<number> {
    const result = await dbClient.query(
      "DELETE FROM schema_info WHERE database_id = $1",
      [databaseId]
    );

    return result.rowCount ?? 0;
  }

  /**
   * Delete a specific table schema
   */
  async deleteTableSchema(
    databaseId: number,
    tableName: string,
    tableSchema: string = "public"
  ): Promise<boolean> {
    const result = await dbClient.query(
      `DELETE FROM schema_info 
       WHERE database_id = $1 AND table_name = $2 AND table_schema = $3`,
      [databaseId, tableName, tableSchema]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Find similar tables using vector similarity search
   * Uses PostgreSQL's vector similarity operators
   */
  async findSimilarTables(
    queryEmbedding: number[],
    limit: number = 10,
    databaseId?: number
  ): Promise<
    Array<{
      id: number;
      databaseId: number;
      tableName: string;
      tableSchema: string;
      columnSchemas: TableSchema; // JSON schema data
      tableDescription: string;
      similarity: number;
    }>
  > {
    const embeddingVector = `[${queryEmbedding.join(",")}]`;

    let query = `
      SELECT 
        id,
        database_id as "databaseId",
        table_name as "tableName",
        table_schema as "tableSchema",
        schema as "columnSchemas",
        (schema->>'tableDescription') as "tableDescription",
        1 - (schema_embedding <=> $1::vector) as similarity
      FROM schema_info
      WHERE schema_embedding IS NOT NULL
    `;

    const params: (string | number)[] = [embeddingVector];

    if (databaseId) {
      query += ` AND database_id = $2`;
      params.push(databaseId);
    }

    query += `
      ORDER BY schema_embedding <=> $1::vector
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const result = await dbClient.query(query, params);

    return result.rows;
  }

  /**
   * Generate plain text representation of table schema
   */
  private generateSchemaText(table: TableSchema): string {
    const lines: string[] = [];

    lines.push(`Table: ${table.tableName}`);
    lines.push(`Description: ${table.tableDescription}`);
    lines.push(`Category: ${table.category}`);
    lines.push(`Relevant: ${table.isRelevant ? "Yes" : "No"}`);
    lines.push("");
    lines.push("Columns:");

    for (const col of table.columns) {
      const flags: string[] = [];
      if (col.isPrimaryKey) flags.push("PK");
      if (col.isForeignKey) flags.push("FK");
      if (!col.isNullable) flags.push("NOT NULL");

      const flagsStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
      lines.push(
        `  - ${col.columnName}: ${col.dataType}${flagsStr} - ${col.description}`
      );

      if (col.referencedTable) {
        lines.push(`    References: ${col.referencedTable}`);
      }
    }

    if (table.foreignKeys && table.foreignKeys.length > 0) {
      lines.push("");
      lines.push("Foreign Keys:");
      for (const fk of table.foreignKeys) {
        lines.push(
          `  - ${fk.columnName} -> ${fk.referencedTable}.${fk.referencedColumn}`
        );
      }
    }

    return lines.join("\n");
  }

  /**
   * Get count of tables for a database
   */
  async countByDatabaseId(databaseId: number): Promise<number> {
    const result = await dbClient.query(
      "SELECT COUNT(*) as count FROM schema_info WHERE database_id = $1",
      [databaseId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get total count of all table schemas
   */
  async count(): Promise<number> {
    const result = await dbClient.query(
      "SELECT COUNT(*) as count FROM schema_info"
    );

    return parseInt(result.rows[0].count, 10);
  }
}

export const schemaInfoRepository = new SchemaInfoRepository();
