# Schema Cleaning Validation - Name Preservation

## 🚨 Critical Issue Fixed

### Problem

AI có thể vô tình thay đổi tên table/column trong quá trình clean schema, dẫn đến SQL queries bị lỗi:

```sql
-- Database có: user_id (snake_case)
-- AI đổi thành: userId (camelCase)
-- Generated query: SELECT userId FROM users
-- ❌ ERROR: column "userId" does not exist
```

### Root Cause

AI models có xu hướng:

- Chuẩn hóa naming convention (snake_case → camelCase)
- Dịch tên columns sang ngôn ngữ khác
- Thêm/bớt spaces hoặc thay đổi casing
- "Làm đẹp" tên theo best practices

**Hậu quả:** SQL queries generated sau này sẽ reference sai tên columns → RUNTIME ERRORS

## ✅ Solution Implemented

### 1. Prompt Restrictions

Thêm **CRITICAL RULES** vào prompt:

```typescript
⚠️ CRITICAL RULES - MUST FOLLOW:
1. **NEVER change table names or column names** - use EXACT names from the raw schema
2. **NEVER rename, modify, or translate any table/column identifiers**
3. **ONLY add descriptions and metadata** - do not alter the actual database identifiers
```

**Ví dụ cụ thể trong prompt:**

```
✅ CORRECT:
  "columnName": "user_id"  // Keep exact name from database
  "description": "Unique identifier for the user"

❌ WRONG:
  "columnName": "userId"   // Don't convert snake_case to camelCase
  "columnName": "User ID"  // Don't add spaces
  "columnName": "id_usuario" // Don't translate
```

### 2. Runtime Validation

Thêm validation layer sau khi AI trả về cleaned schema:

```typescript
// Extract unique table names from raw schema
const rawTableNames = new Set(
  rawSchema.map((row: any) => row.table_name || row.tableName)
);

// Check each cleaned table
for (const table of relevantSchema) {
  // Verify table name exists in raw schema
  if (!rawTableNames.has(table.tableName)) {
    validationErrors.push(
      `Table name changed: "${table.tableName}" not found in original schema`
    );
  }

  // Get original columns for this table
  const originalColumns = rawSchema
    .filter((row: any) => (row.table_name || row.tableName) === table.tableName)
    .map((row: any) => row.column_name || row.columnName);

  // Check each column name wasn't modified
  for (const column of table.columns) {
    if (!originalColumns.includes(column.columnName)) {
      validationErrors.push(
        `Column name changed in table "${table.tableName}": "${column.columnName}" not found in original schema`
      );
    }
  }
}

// If validation errors found, reject the cleaning
if (validationErrors.length > 0) {
  console.error("Schema cleaning validation failed:", validationErrors);
  return {
    success: false,
    error: `AI modified table/column names. Validation errors:\n${validationErrors.join(
      "\n"
    )}`,
  };
}
```

### 3. Fallback Mechanism

Nếu validation fail:

1. Log chi tiết errors
2. Return `success: false`
3. DatabaseModal sẽ fallback về raw schema
4. Database vẫn được add thành công, chỉ không có enriched schema

## How It Works

```
1. AI receives raw schema
   ↓
2. AI cleans & enriches (with CRITICAL RULES)
   ↓
3. Validation checks:
   - All table names match original ✓
   - All column names match original ✓
   ↓
4a. ✅ Validation passed → Use cleaned schema
4b. ❌ Validation failed → Fallback to raw schema
```

## Test Cases

### Test Case 1: snake_case preservation

```typescript
// Input
{ table_name: "order_items", column_name: "user_id" }

// Expected Output
{ tableName: "order_items", columns: [{ columnName: "user_id" }] }

// ❌ Invalid (will be rejected)
{ tableName: "OrderItems", columns: [{ columnName: "userId" }] }
```

### Test Case 2: Mixed casing preservation

```typescript
// Input
{ table_name: "UserAccounts", column_name: "FirstName" }

// Expected Output
{ tableName: "UserAccounts", columns: [{ columnName: "FirstName" }] }

// ❌ Invalid (will be rejected)
{ tableName: "user_accounts", columns: [{ columnName: "first_name" }] }
```

### Test Case 3: Special characters

```typescript
// Input
{ table_name: "tbl_Users$Data", column_name: "user#id" }

// Expected Output
{ tableName: "tbl_Users$Data", columns: [{ columnName: "user#id" }] }

// ✅ Must preserve exact characters
```

## Benefits

### 1. 100% SQL Accuracy

- Generated queries sẽ dùng đúng tên columns từ database
- Không có runtime errors do sai tên
- Compatibility với tất cả naming conventions

### 2. Database Agnostic

- Hoạt động với mọi naming style:
  - snake_case (PostgreSQL thường dùng)
  - PascalCase (SQL Server thường dùng)
  - camelCase
  - Mixed styles

### 3. Safety First

- Validation layer đảm bảo không có changes
- Fallback mechanism cho reliability
- Clear error messages để debug

### 4. User Trust

- Users tin tưởng rằng schema không bị sửa đổi
- Transparent về việc AI làm gì
- Predictable behavior

## Monitoring

### Console Logs

**Success case:**

```javascript
Schema cleaning complete: {
  original: 50,
  cleaned: 18,
  removed: 32,
  summary: { totalTables: 50, relevantTables: 18, ... }
}
```

**Validation failure case:**

```javascript
Schema cleaning validation failed: [
  "Column name changed in table \"users\": \"userId\" not found in original schema",
  "Table name changed: \"Orders\" not found in original schema"
]
```

**Fallback case (in DatabaseModal):**

```javascript
Schema cleaning failed, saving original schema: AI modified table/column names
```

## Future Enhancements

### 1. Fuzzy Matching (Optional)

Cho phép một số changes nhỏ nếu cần:

```typescript
// Allow case-insensitive matching?
const normalizedMatch = originalColumns.some(
  (col) => col.toLowerCase() === column.columnName.toLowerCase()
);
```

**Note:** Hiện tại KHÔNG enable vì có thể gây confusion. Better safe than sorry.

### 2. User Confirmation

Nếu detect changes, hỏi user có muốn accept không:

```typescript
if (validationErrors.length > 0) {
  // Show modal with changes
  const userAccept = await confirmChanges(validationErrors);
  if (!userAccept) {
    return { success: false };
  }
}
```

### 3. Schema Diff Visualization

Show detailed diff của changes:

```
- user_id (original)
+ userId (AI suggested)
```

## Conclusion

Với 2-layer protection:

1. **Prompt-level restrictions** (AI được instructed không đổi tên)
2. **Runtime validation** (Code verify không có changes)

→ Đảm bảo 100% accuracy trong việc preserve table/column names
→ SQL queries luôn chính xác
→ No more "column does not exist" errors!

## Related Files

- `src/services/aiService.ts`: cleanAndEnrichSchema function
- `src/components/DatabaseModal.tsx`: Integration và fallback logic
- `SCHEMA_CLEANING.md`: Overall documentation
