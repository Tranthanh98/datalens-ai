SELECT 
    t.TABLE_NAME as table_name,
    t.TABLE_SCHEMA as schema_db,
    JSON_ARRAYAGG(
        JSON_OBJECT(
            'column_name', c.COLUMN_NAME,
            'data_type', c.DATA_TYPE,
            'column_type', c.COLUMN_TYPE,
            'is_nullable', IF(c.IS_NULLABLE = 'YES', true, false),
            'is_primary_key', IF(c.COLUMN_KEY = 'PRI', true, false),
            'is_foreign_key', IF(kcu.COLUMN_NAME IS NOT NULL, true, false),
            'references', IF(
                kcu.COLUMN_NAME IS NOT NULL,
                JSON_OBJECT(
                    'referenced_table', kcu.REFERENCED_TABLE_NAME,
                    'referenced_column', kcu.REFERENCED_COLUMN_NAME,
                    'constraint_name', kcu.CONSTRAINT_NAME
                ),
                NULL
            )
        )
    ) as columns
FROM 
    information_schema.TABLES t
JOIN 
    information_schema.COLUMNS c ON t.TABLE_SCHEMA = c.TABLE_SCHEMA 
    AND t.TABLE_NAME = c.TABLE_NAME
LEFT JOIN 
    information_schema.KEY_COLUMN_USAGE kcu ON c.TABLE_SCHEMA = kcu.TABLE_SCHEMA 
    AND c.TABLE_NAME = kcu.TABLE_NAME 
    AND c.COLUMN_NAME = kcu.COLUMN_NAME
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
WHERE 
  t.ENGINE = 'InnoDB'
    AND t.TABLE_TYPE = 'BASE TABLE'
GROUP BY 
    t.TABLE_NAME, t.TABLE_SCHEMA
ORDER BY 
    t.TABLE_NAME;
