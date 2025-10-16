-- DataLens AI - Initial Schema Migration
-- Creates tables for storing database info and schemas
-- Includes pgvector extension for vector embeddings support
-- Note: Conversations, messages, and query results are stored in IndexedDB on client side

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Database connection information
CREATE TABLE IF NOT EXISTS database_info (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('postgresql', 'mysql', 'mssql')),
    connection_string TEXT,
    host VARCHAR(255),
    port INTEGER,
    database VARCHAR(255),
    username VARCHAR(255),
    password TEXT, -- Consider encrypting this in production
    ssl BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for active databases
CREATE INDEX IF NOT EXISTS idx_database_info_active ON database_info(is_active);
CREATE INDEX IF NOT EXISTS idx_database_info_type ON database_info(type);
CREATE INDEX IF NOT EXISTS idx_database_info_name ON database_info(name);

-- Database schema information (cached) - One record per table
CREATE TABLE IF NOT EXISTS schema_info (
    id SERIAL PRIMARY KEY,
    database_id INTEGER NOT NULL REFERENCES database_info(id) ON DELETE CASCADE,
    table_name VARCHAR(255) NOT NULL, -- Name of the table
    table_schema VARCHAR(255) DEFAULT 'public', -- Schema name (e.g., 'public', 'dbo')
    table_type VARCHAR(50), -- 'TABLE', 'VIEW', etc.
    schema JSONB NOT NULL, -- Table schema data as JSON (columns, constraints, indexes, etc.)
    schema_text TEXT, -- Plain text representation for vector search
    schema_embedding vector(768), -- Vector embedding of table schema for semantic search
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(database_id, table_schema, table_name) -- One record per table in each database
);

-- Create indexes for schema_info
CREATE INDEX IF NOT EXISTS idx_schema_info_database_id ON schema_info(database_id);
CREATE INDEX IF NOT EXISTS idx_schema_info_table_name ON schema_info(table_name);
CREATE INDEX IF NOT EXISTS idx_schema_info_schema ON schema_info USING gin(schema);

-- Vector similarity search index for schema embeddings using HNSW
CREATE INDEX IF NOT EXISTS idx_schema_info_embedding ON schema_info 
USING hnsw (schema_embedding vector_cosine_ops);

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_database_info_updated_at
    BEFORE UPDATE ON database_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schema_info_updated_at
    BEFORE UPDATE ON schema_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a view for database statistics
CREATE OR REPLACE VIEW database_statistics AS
SELECT 
    di.id,
    di.name,
    di.type,
    di.is_active,
    COUNT(si.id) as table_count,
    MAX(si.updated_at) as schema_updated_at,
    di.created_at,
    di.updated_at
FROM database_info di
LEFT JOIN schema_info si ON di.id = si.database_id
GROUP BY di.id, di.name, di.type, di.is_active, di.created_at, di.updated_at;

-- Comments for documentation
COMMENT ON TABLE database_info IS 'Stores database connection information for various database types';
COMMENT ON TABLE schema_info IS 'Caches individual table schemas with vector embeddings for semantic search - one record per table';

COMMENT ON COLUMN schema_info.table_name IS 'Name of the table';
COMMENT ON COLUMN schema_info.table_schema IS 'Schema/namespace of the table (e.g., public, dbo)';
COMMENT ON COLUMN schema_info.schema IS 'Table schema data including columns, data types, constraints, indexes, foreign keys, etc.';
COMMENT ON COLUMN schema_info.schema_embedding IS 'Vector embedding of table schema for semantic search and AI context (384 dimensions)';
COMMENT ON COLUMN database_info.is_active IS 'Indicates the currently active/selected database connection';
