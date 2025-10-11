SELECT JSON_ARRAYAGG(
  JSON_OBJECT(
    'table_name', t.TABLE_NAME,
    'schema', t.TABLE_SCHEMA,
    'columns', (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'column_name', c.COLUMN_NAME,
          'data_type', c.DATA_TYPE,
          'is_nullable', IF(c.IS_NULLABLE = 'YES', true, false),
          'is_primary_key', IF(pk.COLUMN_NAME IS NOT NULL, true, false),
          'is_foreign_key', IF(fk.COLUMN_NAME IS NOT NULL, true, false),
          'references', 
            CASE WHEN fk.COLUMN_NAME IS NOT NULL 
                 THEN JSON_OBJECT(
                        'referenced_table', fk.REFERENCED_TABLE_NAME,
                        'referenced_column', fk.REFERENCED_COLUMN_NAME
                      )
                 ELSE NULL END,
          'column_default', c.COLUMN_DEFAULT,
          'character_maximum_length', c.CHARACTER_MAXIMUM_LENGTH,
          'numeric_precision', c.NUMERIC_PRECISION,
          'numeric_scale', c.NUMERIC_SCALE
        ) ORDER BY c.ORDINAL_POSITION
      )
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT
          kcu.TABLE_NAME,
          kcu.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ) pk
        ON pk.TABLE_NAME = c.TABLE_NAME 
        AND pk.COLUMN_NAME = c.COLUMN_NAME
        AND c.TABLE_SCHEMA = pk.TABLE_SCHEMA
      LEFT JOIN (
        SELECT
          kcu.TABLE_NAME,
          kcu.COLUMN_NAME,
          kcu.REFERENCED_TABLE_NAME,
          kcu.REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        WHERE kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ) fk
        ON fk.TABLE_NAME = c.TABLE_NAME 
        AND fk.COLUMN_NAME = c.COLUMN_NAME
        AND c.TABLE_SCHEMA = fk.TABLE_SCHEMA
      WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA 
        AND c.TABLE_NAME = t.TABLE_NAME
    )
  ) ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
) AS schema_json
FROM INFORMATION_SCHEMA.TABLES t
WHERE t.TABLE_SCHEMA = DATABASE()
  AND t.TABLE_TYPE = 'BASE TABLE';