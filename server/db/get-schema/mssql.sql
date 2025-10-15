SELECT
    t.TABLE_NAME as table_name,
    t.TABLE_SCHEMA as table_schema,
    (
        SELECT
            c.COLUMN_NAME as column_name,
            c.DATA_TYPE as data_type,
            CAST(CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END as bit) as is_nullable,
            CAST(CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as bit) as is_primary_key,
            CAST(CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as bit) as is_foreign_key,
            CASE WHEN fk.COLUMN_NAME IS NOT NULL
                THEN JSON_QUERY((
                    SELECT
                        fk.REFERENCED_TABLE_NAME as referenced_table,
                        fk.REFERENCED_COLUMN_NAME as referenced_column
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                ))
            END as [references]
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
            SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                AND tc.TABLE_NAME = kcu.TABLE_NAME
            WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                AND tc.TABLE_SCHEMA = 'dbo'
        ) pk ON pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME
        LEFT JOIN (
            SELECT
                kcu.TABLE_NAME,
                kcu.COLUMN_NAME,
                ccu.TABLE_NAME AS REFERENCED_TABLE_NAME,
                ccu.COLUMN_NAME AS REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                AND tc.TABLE_NAME = kcu.TABLE_NAME
            JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
                ON ccu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
                AND tc.TABLE_SCHEMA = 'dbo'
        ) fk ON fk.TABLE_NAME = c.TABLE_NAME AND fk.COLUMN_NAME = c.COLUMN_NAME
        WHERE c.TABLE_SCHEMA = 'dbo'
            AND c.TABLE_NAME = t.TABLE_NAME
        ORDER BY c.ORDINAL_POSITION
        FOR JSON PATH
    ) as [columns]
FROM INFORMATION_SCHEMA.TABLES t
WHERE t.TABLE_SCHEMA = 'dbo'
    AND t.TABLE_TYPE = 'BASE TABLE'
    AND t.TABLE_CATALOG = '{{database}}'
    AND t.TABLE_NAME NOT LIKE '%log%'
    AND t.TABLE_NAME NOT LIKE '%audit%'
    AND t.TABLE_NAME NOT LIKE '%vw%'
    AND t.TABLE_NAME NOT LIKE '%migration%'
ORDER BY t.TABLE_NAME;
