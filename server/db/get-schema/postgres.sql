SELECT 
  t.table_name,
  t.table_schema,
  (
    SELECT json_agg(
      json_build_object(
        'column_name', c.column_name,
        'data_type', c.data_type,
        'is_nullable', c.is_nullable,
        'is_primary_key', 
          (pk.column_name IS NOT NULL),
        'is_foreign_key',
          (fk.column_name IS NOT NULL),
        'references', 
          CASE WHEN fk.column_name IS NOT NULL 
               THEN json_build_object(
                      'referenced_table', fk.foreign_table_name,
                      'referenced_column', fk.foreign_column_name
                    )
               ELSE NULL END
      ) ORDER BY c.ordinal_position
    )
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT
        ku.table_name,
        ku.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku 
        ON tc.constraint_name = ku.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
    ) pk
      ON pk.table_name = c.table_name AND pk.column_name = c.column_name
    LEFT JOIN (
      SELECT
        kcu.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
    ) fk
      ON fk.table_name = c.table_name AND fk.column_name = c.column_name
    WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name
  ) AS columns
FROM information_schema.tables t
WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  AND t.table_type = 'BASE TABLE'
  and t.table_name not like '%migration%';