
SELECT
    CONCAT(t.TABLE_SCHEMA, '.', t.TABLE_NAME) AS table_name,  -- 👈 full name: schema.table
    t.TABLE_SCHEMA AS table_schema,
    (
        SELECT
            c.COLUMN_NAME AS column_name,
            c.DATA_TYPE AS data_type,
            CAST(CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS bit) AS is_nullable,
            CAST(CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS bit) AS is_primary_key,
            CAST(CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS bit) AS is_foreign_key,
            CASE WHEN fk.COLUMN_NAME IS NOT NULL
                THEN JSON_QUERY((
                    SELECT
                        CONCAT(fk.REFERENCED_TABLE_SCHEMA, '.', fk.REFERENCED_TABLE_NAME) AS referenced_table,  -- 👈 thêm schema
                        fk.REFERENCED_COLUMN_NAME AS referenced_column
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                ))
            END AS [references]
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
            SELECT kcu.TABLE_SCHEMA, kcu.TABLE_NAME, kcu.COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                AND tc.TABLE_NAME = kcu.TABLE_NAME
            WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        ) pk
            ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA
           AND pk.TABLE_NAME = c.TABLE_NAME
           AND pk.COLUMN_NAME = c.COLUMN_NAME
        LEFT JOIN (
            SELECT
                kcu.TABLE_SCHEMA,
                kcu.TABLE_NAME,
                kcu.COLUMN_NAME,
                ccu.TABLE_SCHEMA AS REFERENCED_TABLE_SCHEMA,
                ccu.TABLE_NAME AS REFERENCED_TABLE_NAME,
                ccu.COLUMN_NAME AS REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                AND tc.TABLE_NAME = kcu.TABLE_NAME
            JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
                ON ccu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
        ) fk
            ON fk.TABLE_SCHEMA = c.TABLE_SCHEMA
           AND fk.TABLE_NAME = c.TABLE_NAME
           AND fk.COLUMN_NAME = c.COLUMN_NAME
        WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA
          AND c.TABLE_NAME = t.TABLE_NAME
        ORDER BY c.ORDINAL_POSITION
        FOR JSON PATH
    ) AS [columns]
FROM INFORMATION_SCHEMA.TABLES t
WHERE 1 = 1
 --   AND t.TABLE_TYPE = 'BASE TABLE'
 --   AND (
 --       t.TABLE_NAME NOT LIKE '%Log%'
 --       OR t.TABLE_NAME LIKE 'Login%'
 --   )
 --   AND t.TABLE_NAME NOT LIKE '%audit%'
 --   AND t.TABLE_NAME NOT LIKE '%vw%'
 --   AND t.TABLE_NAME NOT LIKE '%migration%'
 --   AND t.TABLE_NAME NOT LIKE '%WebMenu%'
 --   AND t.TABLE_NAME NOT LIKE '%Report%'
 --   AND t.TABLE_NAME NOT LIKE '%System%'
 --   AND t.TABLE_NAME NOT LIKE 'Template%'
	--AND t.TABLE_NAME NOT LIKE '%sys%'
	--AND t.TABLE_NAME not like '%AWBuildVersion%'
ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME;
