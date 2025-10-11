SELECT (
  SELECT 
    t.TABLE_NAME as table_name,
    t.TABLE_SCHEMA as [schema],
    (
      SELECT 
        c.COLUMN_NAME as column_name,
        c.DATA_TYPE as data_type,
        CASE WHEN c.IS_NULLABLE = 'YES' THEN CAST(1 as bit) ELSE CAST(0 as bit) END as is_nullable,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN CAST(1 as bit) ELSE CAST(0 as bit) END as is_primary_key,
        CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN CAST(1 as bit) ELSE CAST(0 as bit) END as is_foreign_key,
        CASE WHEN fk.COLUMN_NAME IS NOT NULL 
             THEN (
               SELECT 
                 fk.REFERENCED_TABLE_NAME as referenced_table,
                 fk.REFERENCED_COLUMN_NAME as referenced_column
               FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
             )
             ELSE NULL END as [references],
        c.COLUMN_DEFAULT as column_default,
        c.CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
        c.NUMERIC_PRECISION as numeric_precision,
        c.NUMERIC_SCALE as numeric_scale
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT
          kcu.TABLE_NAME,
          kcu.COLUMN_NAME,
          kcu.TABLE_SCHEMA
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
          AND tc.TABLE_NAME = kcu.TABLE_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ) pk
        ON pk.TABLE_NAME = c.TABLE_NAME 
        AND pk.COLUMN_NAME = c.COLUMN_NAME
        AND pk.TABLE_SCHEMA = c.TABLE_SCHEMA
      LEFT JOIN (
        SELECT
          kcu.TABLE_NAME,
          kcu.COLUMN_NAME,
          kcu.TABLE_SCHEMA,
          ccu.TABLE_NAME AS REFERENCED_TABLE_NAME,
          ccu.COLUMN_NAME AS REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
          AND tc.TABLE_NAME = kcu.TABLE_NAME
        JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE AS ccu
          ON ccu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
          AND ccu.TABLE_SCHEMA = tc.TABLE_SCHEMA
        WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
      ) fk
        ON fk.TABLE_NAME = c.TABLE_NAME 
        AND fk.COLUMN_NAME = c.COLUMN_NAME
        AND fk.TABLE_SCHEMA = c.TABLE_SCHEMA
      WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA 
        AND c.TABLE_NAME = t.TABLE_NAME
      ORDER BY c.ORDINAL_POSITION
      FOR JSON PATH
    ) as [columns]
  FROM INFORMATION_SCHEMA.TABLES t
  WHERE t.TABLE_SCHEMA = 'dbo'
    AND t.TABLE_TYPE = 'BASE TABLE'
  ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
  FOR JSON PATH
) AS schema_json;