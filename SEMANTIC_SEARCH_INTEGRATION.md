# Semantic Search Integration

## Tổng quan

Tài liệu này mô tả các thay đổi đã được thực hiện để tích hợp semantic search vào flow AI query.

## Các thay đổi chính

### 1. Cập nhật `aiService.ts`

**Trước:**

- `runAIQuery()` nhận `databaseInfo: DatabaseInfo` object
- Lấy schema từ IndexDB thông qua `SchemaService.getByDatabase()`
- Sử dụng toàn bộ schema trong database

**Sau:**

- `runAIQuery()` nhận `databaseId: number` và `databaseType: string`
- Gọi API `/api/database/:id/schema/search-similar-tables` để tìm các bảng liên quan
- Chỉ sử dụng schema của các bảng liên quan đến câu hỏi của user (semantic search)

**Lợi ích:**

- Giảm token count khi gọi AI (chỉ truyền schema liên quan)
- Cải thiện độ chính xác của AI (ít nhiễu hơn)
- Tận dụng vector embeddings đã được tạo sẵn
- Không cần lưu trữ schema trong IndexDB nữa

### 2. Cập nhật `ChatInterface2.tsx`

**Thay đổi:**

```typescript
// Trước
const databaseInfo: DatabaseInfo = {
  ...legacyToDatabase(selectedDatabase),
  id: parseInt(selectedDatabase.id),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const { answer, plan } = await runAIQuery(
  message,
  databaseInfo,
  executeSQL,
  conversationHistory
);

// Sau
const { answer, plan } = await runAIQuery(
  message,
  parseInt(selectedDatabase.id),
  selectedDatabase.type || "postgresql",
  executeSQL,
  conversationHistory
);
```

### 3. Service mới: `schemaSearchService.ts`

Tạo service mới để handle việc gọi API search similar tables:

```typescript
export async function searchSimilarTables(
  databaseId: number,
  query: string,
  limit: number = 10
): Promise<SearchSimilarTablesResponse>;
```

**Chức năng:**

- Gọi API `/api/database/:id/schema/search-similar-tables`
- Trả về danh sách các bảng liên quan nhất dựa trên semantic similarity
- Handle errors và type safety

## Flow mới

1. **User gửi câu hỏi** trong ChatInterface2
2. **Gọi API search** `/api/database/:id/schema/search-similar-tables` với:
   - `databaseId`: ID của database được chọn
   - `query`: Câu hỏi của user
   - `limit`: Số lượng bảng liên quan tối đa (mặc định 10)
3. **Server tìm kiếm** các bảng liên quan bằng:
   - Generate embedding cho câu hỏi của user
   - So sánh với embeddings của các bảng trong database
   - Trả về top N bảng có similarity cao nhất
4. **AI generates plan** với schema được filter:
   - Chỉ sử dụng schema của các bảng liên quan
   - Giảm token count và noise
   - Tăng độ chính xác
5. **Thực thi query** như cũ

## API Endpoint

### POST `/api/database/:id/schema/search-similar-tables`

**Request:**

```json
{
  "query": "Show me top selling products",
  "limit": 10
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "schema": {
        "tableName": "products",
        "tableDescription": "Product catalog with pricing and inventory",
        "columns": [...]
      },
      "similarity": 0.89
    },
    {
      "schema": {
        "tableName": "orders",
        "tableDescription": "Customer orders and sales data",
        "columns": [...]
      },
      "similarity": 0.82
    }
  ],
  "query": "Show me top selling products",
  "resultsCount": 2
}
```

## Cấu hình

Đảm bảo có biến môi trường trong `.env`:

```env
# API URL for backend server
VITE_API_URL=http://localhost:3001
```

## Testing

Để test semantic search:

1. Đảm bảo database đã có embeddings cho các bảng (chạy qua API `/api/databases/:id/schema`)
2. Gửi câu hỏi trong chat interface
3. Kiểm tra Console logs để xem:
   - API call đến `/search-similar-tables`
   - Số lượng bảng được trả về
   - Similarity scores
4. Verify rằng AI chỉ sử dụng các bảng liên quan trong query plan

## Troubleshooting

### Lỗi "Failed to retrieve relevant schema"

- Kiểm tra database có embeddings chưa
- Verify API endpoint đang chạy
- Check network tab trong browser DevTools

### Không có kết quả phù hợp

- Similarity threshold có thể quá cao
- Database chưa có embeddings
- Table descriptions chưa đủ chi tiết

### Performance issues

- Giảm `limit` xuống (default 10)
- Optimize embedding model
- Add caching layer

## Migration Notes

**Breaking Changes:**

- `runAIQuery()` signature đã thay đổi
- Không còn dependency vào `DatabaseInfo` type
- Không còn sử dụng `SchemaService` từ IndexDB

**Backward Compatibility:**

- Các components khác sử dụng `runAIQuery` cần update
- Database phải có embeddings trước khi sử dụng semantic search

## Future Improvements

1. **Caching:** Cache search results cho các câu hỏi tương tự
2. **Adaptive limit:** Tự động điều chỉnh số lượng bảng dựa trên complexity
3. **Hybrid search:** Kết hợp keyword search và semantic search
4. **User feedback:** Cho phép user đánh giá kết quả để improve embeddings
