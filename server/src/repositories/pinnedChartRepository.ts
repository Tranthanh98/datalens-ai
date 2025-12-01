/**
 * Pinned Chart Repository
 * Handles CRUD operations for pinned charts stored in PostgreSQL
 */

import { dbClient } from "../db/client";

export interface PinnedChart {
  id?: number;
  databaseId: number;
  title: string;
  sqlQuery: string;
  chartType: "bar" | "pie" | "line";
  xAxisKey: string;
  yAxisKey: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PinnedChartRepository {
  /**
   * Get all pinned charts for a specific database
   */
  async getByDatabaseId(databaseId: number): Promise<PinnedChart[]> {
    const result = await dbClient.query(
      `SELECT 
        id, database_id as "databaseId", title, sql_query as "sqlQuery",
        chart_type as "chartType", x_axis_key as "xAxisKey", 
        y_axis_key as "yAxisKey", description,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM pinned_charts 
      WHERE database_id = $1
      ORDER BY created_at DESC`,
      [databaseId]
    );

    return result.rows;
  }

  /**
   * Get pinned chart by ID
   */
  async getById(id: number): Promise<PinnedChart | null> {
    const result = await dbClient.query(
      `SELECT 
        id, database_id as "databaseId", title, sql_query as "sqlQuery",
        chart_type as "chartType", x_axis_key as "xAxisKey", 
        y_axis_key as "yAxisKey", description,
        created_at as "createdAt", updated_at as "updatedAt"
      FROM pinned_charts 
      WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Create new pinned chart
   */
  async create(
    chart: Omit<PinnedChart, "id" | "createdAt" | "updatedAt">
  ): Promise<PinnedChart> {
    const result = await dbClient.query(
      `INSERT INTO pinned_charts 
        (database_id, title, sql_query, chart_type, x_axis_key, y_axis_key, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id, database_id as "databaseId", title, sql_query as "sqlQuery",
        chart_type as "chartType", x_axis_key as "xAxisKey", 
        y_axis_key as "yAxisKey", description,
        created_at as "createdAt", updated_at as "updatedAt"`,
      [
        chart.databaseId,
        chart.title,
        chart.sqlQuery,
        chart.chartType,
        chart.xAxisKey || "name",
        chart.yAxisKey || "value",
        chart.description || null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update pinned chart
   */
  async update(
    id: number,
    chart: Partial<PinnedChart>
  ): Promise<PinnedChart | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (chart.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(chart.title);
    }
    if (chart.sqlQuery !== undefined) {
      fields.push(`sql_query = $${paramCount++}`);
      values.push(chart.sqlQuery);
    }
    if (chart.chartType !== undefined) {
      fields.push(`chart_type = $${paramCount++}`);
      values.push(chart.chartType);
    }
    if (chart.xAxisKey !== undefined) {
      fields.push(`x_axis_key = $${paramCount++}`);
      values.push(chart.xAxisKey);
    }
    if (chart.yAxisKey !== undefined) {
      fields.push(`y_axis_key = $${paramCount++}`);
      values.push(chart.yAxisKey);
    }
    if (chart.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(chart.description);
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);

    const result = await dbClient.query(
      `UPDATE pinned_charts 
      SET ${fields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING 
        id, database_id as "databaseId", title, sql_query as "sqlQuery",
        chart_type as "chartType", x_axis_key as "xAxisKey", 
        y_axis_key as "yAxisKey", description,
        created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete pinned chart
   */
  async delete(id: number): Promise<boolean> {
    const result = await dbClient.query(
      "DELETE FROM pinned_charts WHERE id = $1",
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete all pinned charts for a database
   */
  async deleteByDatabaseId(databaseId: number): Promise<number> {
    const result = await dbClient.query(
      "DELETE FROM pinned_charts WHERE database_id = $1",
      [databaseId]
    );

    return result.rowCount ?? 0;
  }

  /**
   * Count pinned charts for a database
   */
  async countByDatabaseId(databaseId: number): Promise<number> {
    const result = await dbClient.query(
      "SELECT COUNT(*) as count FROM pinned_charts WHERE database_id = $1",
      [databaseId]
    );

    return parseInt(result.rows[0].count, 10);
  }
}

export const pinnedChartRepository = new PinnedChartRepository();
