# Schema Cleaning & Enrichment với AI

## Tổng quan

Khi thêm database mới vào hệ thống, schema sẽ được tự động làm sạch và làm giàu bằng AI trước khi lưu vào IndexedDB. Điều này giúp:

1. **Giảm nhiễu thông tin**: Loại bỏ các bảng system/technical không cần thiết
2. **Tối ưu context**: Giảm kích thước context khi chat với AI
3. **Tăng độ chính xác**: AI có thông tin rõ ràng hơn về ý nghĩa business của các bảng/cột
4. **Cải thiện hiệu suất**: Ít token hơn = phản hồi nhanh hơn

## Flow xử lý

```
1. User test connection thành công
   ↓
2. Click "Add Database"
   ↓
3. Database được lưu vào IndexedDB
   ↓
4. Fetch raw schema từ database server
   ↓
5. AI clean & enrich schema (NEW!)
   ↓
6. Lưu cleaned schema vào IndexedDB
   ↓
7. Hiển thị thông báo thành công
```

## AI Cleaning Process

### ⚠️ CRITICAL RULES

**AI KHÔNG ĐƯỢC PHÉP:**

- ❌ Thay đổi tên table (table_name, TableName, etc.)
- ❌ Thay đổi tên column (user_id → userId, created_at → createdAt)
- ❌ Dịch tên (user_id → id_usuario)
- ❌ Thay đổi data type
- ❌ Thêm/bớt spaces hoặc thay đổi casing

**AI CHỈ ĐƯỢC PHÉP:**

- ✅ Thêm descriptions (business-friendly)
- ✅ Mark irrelevant tables/columns
- ✅ Thêm category metadata
- ✅ Mark primary/foreign keys
- ✅ Thêm relationships

### 1. Loại bỏ các bảng không liên quan

**Bảng bị loại bỏ:**

- System tables (migrations, schema_version, etc.)
- Session/cache tables
- Log/audit tables
- Framework-specific tables (Django admin, Laravel jobs, etc.)
- Temporary tables

**Bảng được giữ lại:**

- Business entities (users, customers, products, orders, etc.)
- Transaction data
- Master data
- Analytics/reporting tables
- Bất kỳ bảng nào chứa business data có ý nghĩa

### 2. Enrichment (làm giàu thông tin)

Mỗi bảng được làm giàu với:

- ✅ **tableDescription**: Mô tả rõ ràng mục đích business của bảng
- ✅ **category**: Phân loại (Sales, Users, Products, Analytics, etc.)
- ✅ **isRelevant**: Flag đánh dấu bảng có hữu ích không
- ✅ **primaryKey**: Danh sách các cột primary key
- ✅ **foreignKeys**: Relationships với các bảng khác

Mỗi cột được làm giàu với:

- ✅ **description**: Mô tả business-friendly về ý nghĩa của cột
- ✅ **isRelevant**: Flag đánh dấu cột có hữu ích cho query không
- ✅ **isPrimaryKey/isForeignKey**: Metadata về keys
- ✅ **referencedTable**: Bảng được reference (nếu là FK)

### 3. Ví dụ Schema Transformation

#### TRƯỚC (Raw Schema):

```json
[
  {
    "table_name": "users",
    "column_name": "id",
    "data_type": "integer"
  },
  {
    "table_name": "django_migrations",
    "column_name": "id",
    "data_type": "integer"
  },
  {
    "table_name": "users",
    "column_name": "created_at",
    "data_type": "timestamp"
  }
]
```

#### SAU (Cleaned Schema):

```json
[
  {
    "tableName": "users", // ✅ GIỮ NGUYÊN TÊN (không đổi thành "Users" hay "user")
    "tableDescription": "Stores user account information including authentication and profile data",
    "isRelevant": true,
    "category": "Users",
    "columns": [
      {
        "columnName": "id", // ✅ GIỮ NGUYÊN (không đổi thành "userId" hay "ID")
        "dataType": "integer", // ✅ GIỮ NGUYÊN TYPE
        "isPrimaryKey": true,
        "description": "Unique identifier for each user",
        "isRelevant": true
      },
      {
        "columnName": "created_at", // ✅ GIỮ NGUYÊN snake_case (không đổi thành "createdAt")
        "dataType": "timestamp",
        "description": "Timestamp when the user account was created",
        "isRelevant": true
      }
    ],
    "primaryKey": ["id"]
  }
  // Note: django_migrations table is removed (isRelevant=false)
]
```

#### ❌ VÍ DỤ SAI (KHÔNG LÀM NHƯ NÀY):

```json
[
  {
    "tableName": "Users", // ❌ SAI: Đổi casing
    "columns": [
      {
        "columnName": "userId", // ❌ SAI: Đổi từ "id" thành "userId"
        "columnName": "createdAt" // ❌ SAI: Đổi từ snake_case thành camelCase
      }
    ]
  }
]
```

**⚠️ LÝ DO QUAN TRỌNG:**

- SQL queries cần CHÍNH XÁC tên table/column từ database
- Nếu database có `user_id`, query phải dùng `user_id` (không phải `userId`)
- Thay đổi tên sẽ gây lỗi SQL syntax error: `column "userId" does not exist`

## Implementation Details

### File Changes

#### 1. `src/services/aiService.ts`

**Thêm mới:**

```typescript
// Schema cleaning response schema for structured output
const SCHEMA_CLEANING_SCHEMA = { ... }

// Main cleaning function
export async function cleanAndEnrichSchema(
  rawSchema: any[],
  databaseType: string = "postgresql"
): Promise<{
  success: boolean;
  cleanedSchema?: any[];
  error?: string;
  summary?: { ... };
}>
```

**Tính năng:**

- Sử dụng Gemini AI với structured output (JSON Schema)
- Phân tích và filter các bảng không liên quan
- Thêm mô tả business cho tables và columns
- Trả về summary statistics

#### 2. `src/components/DatabaseModal.tsx`

**Thay đổi:**

```typescript
// Import AI service
import { cleanAndEnrichSchema } from "../services/aiService";

// Thêm status mới
const [schemaFetchStatus, setSchemaFetchStatus] = useState<
  "idle" | "fetching" | "cleaning" | "success" | "error"
>("idle");

// Update flow
const schemaResult = await DatabaseSchemaService.fetchSchema(connection);

if (schemaResult.success && schemaResult.schema) {
  // Clean with AI
  setSchemaFetchStatus("cleaning");
  const cleanResult = await cleanAndEnrichSchema(
    schemaResult.schema,
    databaseType
  );

  if (cleanResult.success && cleanResult.cleanedSchema) {
    // Save cleaned schema
    await DatabaseSchemaService.saveSchemaToDatabase(
      dbId,
      cleanResult.cleanedSchema
    );
  }
}
```

**UI Changes:**

- Thêm status "cleaning" với icon loading màu purple
- Hiển thị: "AI is cleaning and enriching schema..."

## Benefits

### 1. Context Size Reduction

- **Trước**: 50-100 tables với đầy đủ system tables
- **Sau**: 10-30 tables business-relevant
- **Giảm**: ~60-80% kích thước context

### 2. Query Accuracy

- AI hiểu rõ hơn về business domain
- Mô tả cột giúp chọn đúng fields
- Relationships rõ ràng hơn

### 3. Performance

- Ít tokens trong mỗi request
- Response time nhanh hơn
- Giảm chi phí API calls

### 4. User Experience

- Query results chính xác hơn
- Fewer hallucinations
- Better suggestions từ AI

## Configuration

### API Key

Cần có `VITE_GEMINI_API_KEY` trong `.env`:

```env
VITE_GEMINI_API_KEY=your-gemini-api-key
```

### Model

Sử dụng: `gemini-2.5-flash` (fast và cost-effective)

### Fallback

Nếu AI cleaning thất bại, hệ thống sẽ:

1. Log warning
2. Lưu raw schema (không cleaned)
3. Vẫn cho phép sử dụng database

## Testing

### Test Case 1: PostgreSQL với nhiều tables

```typescript
// Schema có 50 tables (bao gồm system tables)
// Expected: Chỉ còn ~15-20 business tables
```

### Test Case 2: MySQL e-commerce

```typescript
// Schema có: users, products, orders, sessions, migrations
// Expected: Giữ users, products, orders; loại bỏ sessions, migrations
```

### Test Case 3: MSSQL với system views

```typescript
// Schema có nhiều system views/tables
// Expected: Chỉ giữ user-created tables
```

## Future Improvements

1. **Cache cleaned schemas**: Không clean lại nếu schema không đổi
2. **User customization**: Cho phép user chọn tables muốn keep/remove
3. **Schema versioning**: Track changes in schema over time
4. **Performance metrics**: Monitor cleaning time và success rate
5. **Batch processing**: Clean multiple databases cùng lúc

## Troubleshooting

### Issue: AI thay đổi tên column/table → SQL queries bị lỗi

**Triệu chứng:**

```sql
-- Database có column: user_id
-- AI đổi thành: userId
-- Generated query: SELECT userId FROM users
-- Error: column "userId" does not exist
```

**Solution:**

- ✅ Đã fix trong prompt với CRITICAL RULES
- AI được restrict không được thay đổi tên
- Nếu vẫn xảy ra: Check lại response từ AI và reject cleaning, dùng raw schema
- Thêm validation layer để verify tên columns không đổi

**Validation code:**

```typescript
// Verify column names haven't changed
const originalColumns = rawSchema.map((s) => s.column_name);
const cleanedColumns = cleanedSchema.flatMap((t) =>
  t.columns.map((c) => c.columnName)
);
const hasChanges = originalColumns.some(
  (orig) => !cleanedColumns.includes(orig)
);
if (hasChanges) {
  console.warn("AI changed column names! Using raw schema.");
  return { success: false, error: "Name changes detected" };
}
```

### Issue: AI cleaning mất quá nhiều thời gian

**Solution**: Timeout sau 30s và fallback về raw schema

### Issue: AI loại bỏ quá nhiều tables quan trọng

**Solution**: Thêm whitelist cho important tables

### Issue: Gemini API error

**Solution**: Catch error và sử dụng raw schema, log để debug

## Monitoring

Console logs để track:

```javascript
console.log("Raw schema fetched:", { tables: schemaResult.schema.length });
console.log("Schema cleaned:", cleanResult.summary);
// Output: { totalTables: 50, relevantTables: 18, removedTables: 32 }
```

## Conclusion

Tính năng Schema Cleaning & Enrichment giúp tối ưu hóa trải nghiệm chat với database bằng cách:

- ✅ Giảm noise trong schema
- ✅ Làm rõ business context
- ✅ Tăng độ chính xác của AI queries
- ✅ Cải thiện performance tổng thể

Đây là một bước quan trọng trong việc xây dựng một AI-powered database assistant thông minh và hiệu quả.
