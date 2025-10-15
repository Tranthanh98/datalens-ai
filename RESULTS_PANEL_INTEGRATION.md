# Results Panel Integration - Summary

## 🎯 Tổng quan

Tích hợp Results Panel với AI responses để hiển thị data visualization (charts) từ kết quả query của AI.
**Sử dụng QueryResult table** thay vì Message metadata để lưu trữ data - theo đúng database design pattern.

## ✅ Các thay đổi đã thực hiện

### 1. **Database Types (`db/types.ts`)**

#### Cập nhật QueryResult Interface

```typescript
export interface QueryResult {
  id?: number;
  conversationId: number;
  messageId?: number; // Link to AI message
  sqlQuery: string;
  result: {
    data: any[];
    columns: string[];
    rowCount: number;
    executionTime: number;
  };
  chartData?: ChartData; // NEW: Chart visualization data
  status: "success" | "error";
  errorMessage?: string;
  createdAt: Date;
}
```

#### Simplified Message Interface

```typescript
export interface Message {
  id?: number;
  conversationId: number;
  content: string;
  type: "user" | "ai";
  createdAt: Date;
  // NO metadata - keep it simple!
}
```

### 2. **Query Result Service (`db/services.ts`)**

#### Thêm Method Get By MessageId

```typescript
async getByMessageId(messageId: number): Promise<QueryResult | undefined> {
  return await db.queryResults
    .where('messageId')
    .equals(messageId)
    .first();
}
```

### 3. **AI Service (`aiService.ts`)**

#### Cập nhật QueryPlan Interface

```typescript
export interface ChartData {
  type: "bar" | "pie" | "line" | "none";
  data: Array<{ name: string; value: number; [key: string]: any }>;
  xAxisKey?: string;
  yAxisKey?: string;
  description?: string;
}

export interface QueryPlan {
  // ... existing fields
  finalSQL?: string; // SQL query cuối cùng được thực thi
  chartData?: ChartData; // Chart data suggestion từ AI
}
```

#### Cải thiện `generateFinalAnswer()`

- AI được prompt để tạo chart data suggestions trong format JSON
- Tự động extract chart data từ response
- Lưu final SQL query từ step cuối cùng được thực thi
- Support 3 loại chart: bar, pie, line

#### Return Value Changes

```typescript
// Before
runAIQuery(): Promise<string>

// After
runAIQuery(): Promise<{ answer: string; plan: QueryPlan }>
```

### 2. **Database Types (`db/types.ts`)**

#### Cập nhật Message Interface

```typescript
export interface Message {
  // ... existing fields
  metadata?: {
    sqlQuery?: string;
    executionTime?: number;
    resultCount?: number;
    chartData?: ChartData; // NEW: Lưu chart data
  };
}
```

### 3. **Chat Store (`store/chatSlice.ts`)**

#### Thêm Selected Message State

```typescript
export interface ChatSlice {
  selectedConversationId: string | null;
  selectedMessageId: string | null; // NEW

  setSelectedConversationId: (conversationId: string | null) => void;
  setSelectedMessageId: (messageId: string | null) => void; // NEW
}
```

### 4. **Chat Interface (`ChatInterface.tsx`)**

#### Lưu AI Response vào QueryResult Table

```typescript
const { answer, plan } = await runAIQuery(message, databaseInfo, executeSQL);

// Update message with answer text
await MessageService.update(aiMessageId, {
  content: answer,
});

// Save query result to QueryResult table (PROPER WAY!)
if (plan.finalSQL) {
  const lastContext = plan.context[plan.context.length - 1];
  await QueryResultService.save({
    conversationId: convId,
    messageId: aiMessageId,
    sqlQuery: plan.finalSQL,
    result: {
      data: lastContext?.result || [],
      columns: Object.keys(lastContext.result[0] || {}),
      rowCount: lastContext?.result?.length || 0,
      executionTime: 0,
    },
    chartData: plan.chartData,
    status: "success",
  });
}
```

#### Check Query Result Availability

```typescript
const messagesWithResults = await Promise.all(
  msgList.map(async (msg) => {
    const queryResult = msg.id
      ? await QueryResultService.getByMessageId(msg.id)
      : null;

    return {
      ...msg,
      hasQueryResult: !!queryResult,
    };
  })
);
```

#### Thêm "View Result" Button

```tsx
{
  message.hasQueryResult && (
    <button onClick={() => setSelectedMessageId(message.id)}>
      <BarChart3 /> View Result
    </button>
  );
}
```

### 5. **Results Panel (`ResultsPanel.tsx`)**

#### Lấy Data từ QueryResult Table

```typescript
const queryResult = useLiveQuery(async () => {
  if (!selectedMessageId) return null;

  // Fetch from QueryResult table instead of Message metadata
  const result = await QueryResultService.getByMessageId(
    parseInt(selectedMessageId)
  );
  return result;
}, [selectedMessageId]);

const chartData = queryResult?.chartData;
const sqlQuery = queryResult?.sqlQuery;
const resultData = queryResult?.result;
```

#### Hiển thị Charts

- **Bar Chart**: So sánh giá trị giữa các categories
- **Pie Chart**: Phân bố tỷ lệ phần trăm (với colors và percentages)
- **Line Chart**: Trends theo thời gian (fallback về bar chart)
- **None**: Hiển thị message "No visualization available"

#### Features

- ✅ Responsive charts với recharts
- ✅ Hiển thị SQL query đã thực thi
- ✅ Data table với tất cả raw data
- ✅ Chart description từ AI
- ✅ Timestamp khi query được execute
- ✅ Empty state khi chưa select message

## 🎨 User Flow

1. **User gửi câu hỏi** → AI phân tích và tạo query plan
2. **AI thực thi queries** → Lấy data từ database
3. **AI tạo markdown response** + **Chart data suggestion**
4. **Message được lưu** (chỉ text content)
5. **QueryResult được lưu** (SQL + data + chartData) → Linked to messageId
6. **User click "View Result"** → ResultsPanel query QueryResult table
7. **ResultsPanel render**:
   - Chart visualization (bar/pie/line)
   - SQL query
   - Raw data table
   - Row count & execution time
   - Timestamp

## 💡 Tại sao dùng QueryResult table?

### ✅ **Advantages:**

1. **Normalized Database Design**

   - Message chỉ chứa text content
   - QueryResult chứa data & metadata
   - Tách biệt concerns rõ ràng

2. **Scalability**

   - Có thể lưu nhiều query results cho 1 message
   - Dễ dàng query/filter results
   - Index hiệu quả hơn

3. **Data Integrity**

   - Foreign key relationship (messageId)
   - Cascade delete khi xóa conversation
   - Transaction safety

4. **Flexibility**
   - Có thể attach results từ nhiều nguồn
   - Support multiple chart types per query
   - Easy to extend with more metadata

### ❌ **Nếu dùng Message.metadata:**

- ❌ Violates single responsibility principle
- ❌ Message object quá lớn
- ❌ Khó query/filter results
- ❌ Không tận dụng được database indexing
- ❌ JSON metadata trong IndexedDB không optimal

## 📊 Chart Data Format

AI sẽ trả về chart data trong format:

```json
{
  "type": "bar",
  "data": [
    { "name": "Product A", "value": 150 },
    { "name": "Product B", "value": 200 }
  ],
  "xAxisKey": "name",
  "yAxisKey": "value",
  "description": "Sales by Product"
}
```

## 🚀 Next Steps (Optional Improvements)

1. **Export chart as image** - Thêm button download PNG
2. **Multiple chart types** - Allow user switch between chart types
3. **Chart customization** - Colors, labels, legends options
4. **Query history** - List tất cả queries trong conversation
5. **Compare results** - So sánh multiple queries side-by-side
6. **Share results** - Export hoặc share chart & data

## 🐛 Known Issues

- `any` type warnings trong aiService.ts (có thể ignore hoặc define proper types later)
- Empty interface warning trong ResultsPanel (non-critical)

## 📝 Testing Checklist

- [ ] AI tạo chart data cho numeric queries
- [ ] Bar chart hiển thị đúng với comparison data
- [ ] Pie chart hiển thị đúng với percentage data
- [ ] SQL query được lưu và hiển thị
- [ ] View Result button chỉ hiển thị khi có chart data
- [ ] Click View Result chuyển focus sang ResultsPanel
- [ ] Empty state hiển thị khi chưa select message
- [ ] Chart responsive trên mobile/tablet
- [ ] Data table hiển thị đầy đủ raw data

## 🎉 Kết quả

Hoàn thành tích hợp Results Panel với AI responses! User giờ có thể:

- ✅ Xem visual charts từ AI query results
- ✅ Inspect SQL queries được generate
- ✅ View raw data trong table format
- ✅ Navigate giữa multiple AI responses và charts của chúng
