-- Initialize PostgreSQL with pgvector extension

-- Create pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Create a sample table with vector column (optional, remove if not needed)
-- CREATE TABLE IF NOT EXISTS embeddings (
--     id SERIAL PRIMARY KEY,
--     content TEXT,
--     embedding vector(1536),  -- For OpenAI embeddings
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Create index for vector similarity search (optional)
-- CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops);

COMMENT ON EXTENSION vector IS 'PostgreSQL vector similarity search extension';
