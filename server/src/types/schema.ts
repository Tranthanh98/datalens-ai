/**
 * Schema Types
 * Type definitions for database schema structure
 */

export interface ColumnSchema {
  columnName: string;
  dataType: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencedTable?: string;
  isNullable?: boolean;
  description: string;
  isRelevant: boolean;
}

export interface ForeignKeySchema {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface TableSchema {
  tableName: string;
  tableDescription: string;
  isRelevant: boolean;
  category: string;
  columns: ColumnSchema[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeySchema[];
}

export interface DatabaseSchema {
  tables: TableSchema[];
  // Optionally store metadata
  databaseType?: "postgresql" | "mysql" | "mssql";
  generatedAt?: Date;
}

export interface SchemaWithEmbeddings extends DatabaseSchema {
  tables: Array<TableSchema & { embedding: number[] }>;
}
