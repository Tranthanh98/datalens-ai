-- DataLens AI - Pinned Charts Migration
-- Creates table for storing pinned charts for dashboard
-- Charts are linked to specific databases and can be displayed on dashboard

-- Pinned charts table
CREATE TABLE IF NOT EXISTS pinned_charts (
    id SERIAL PRIMARY KEY,
    database_id INTEGER NOT NULL REFERENCES database_info(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    sql_query TEXT NOT NULL,
    chart_type VARCHAR(50) NOT NULL CHECK (chart_type IN ('bar', 'pie', 'line')),
    x_axis_key VARCHAR(255) DEFAULT 'name',
    y_axis_key VARCHAR(255) DEFAULT 'value',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for pinned_charts
CREATE INDEX IF NOT EXISTS idx_pinned_charts_database_id ON pinned_charts(database_id);
CREATE INDEX IF NOT EXISTS idx_pinned_charts_created_at ON pinned_charts(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_pinned_charts_updated_at
    BEFORE UPDATE ON pinned_charts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE pinned_charts IS 'Stores pinned charts from chat for dashboard display';
COMMENT ON COLUMN pinned_charts.database_id IS 'Reference to the database this chart queries';
COMMENT ON COLUMN pinned_charts.title IS 'Display title for the chart';
COMMENT ON COLUMN pinned_charts.sql_query IS 'SQL query to execute for chart data';
COMMENT ON COLUMN pinned_charts.chart_type IS 'Type of chart: bar, pie, or line';
COMMENT ON COLUMN pinned_charts.x_axis_key IS 'Key in result data for X axis';
COMMENT ON COLUMN pinned_charts.y_axis_key IS 'Key in result data for Y axis';
COMMENT ON COLUMN pinned_charts.description IS 'Optional description for the chart';
