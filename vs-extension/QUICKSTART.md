# Quick Start - DataLens AI Extension

## ⚡ Cài đặt nhanh (5 phút)

### 1. Install & Compile

```bash
cd vs-extension
npm install
npm run compile
```

### 2. Run Extension

- Nhấn `F5` trong VS Code
- Một cửa sổ mới sẽ mở

### 3. Setup (trong cửa sổ mới)

#### a. Set API Key

```
Ctrl+Shift+P → "DataLens: Set Gemini API Key"
→ Nhập API key
```

#### b. Connect Database

```
Ctrl+Shift+P → "DataLens: Connect Database"
→ Điền thông tin → Test → Save
```

#### c. Start Chatting

```
Click icon DataLens ở sidebar trái
→ Gõ câu hỏi
→ Nhận kết quả
```

## 🎯 Ví dụ câu hỏi

### PostgreSQL

```
- "Có bao nhiêu bản ghi trong bảng users?"
- "Liệt kê 10 orders gần nhất"
- "Tổng revenue theo tháng"
```

### SQL Server

```
- "Top 5 customers by total purchases"
- "Average order value last 30 days"
- "Products with low inventory"
```

## 🔧 Test nhanh

### Tạo database test (PostgreSQL)

```sql
CREATE DATABASE testdb;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name, email) VALUES
  ('John Doe', 'john@example.com'),
  ('Jane Smith', 'jane@example.com'),
  ('Bob Wilson', 'bob@example.com');
```

### Kết nối

```
Host: localhost
Port: 5432
Database: testdb
Username: postgres
Password: your_password
```

### Test câu hỏi

```
"How many users do we have?"
→ Kết quả: "You have 3 users in the database."
```

## 📦 Package Extension

```bash
# Install vsce
npm install -g @vscode/vsce

# Package
npm run package

# Sẽ tạo file: datalens-ai-extension-0.0.1.vsix
```

## 🚨 Troubleshooting nhanh

| Lỗi                      | Giải pháp                      |
| ------------------------ | ------------------------------ |
| Extension không hiển thị | `npm run compile`              |
| Database connection fail | Check DB running + credentials |
| AI không response        | Verify API key + internet      |
| Schema không load        | Check DB permissions           |

## 📁 File quan trọng

```
extension.ts          → Entry point
DatabaseService.ts    → DB connection logic
AIService.ts          → Gemini AI integration
ChatPanel.ts          → Chat UI
DatabaseConnectionPanel.ts → Connection form UI
```

## 🎨 Customize

### Thay đổi model AI

```typescript
// AIService.ts, line ~25
model: "gemini-2.5-flash"; // → 'gemini-pro' hoặc khác
```

### Thêm database type

```typescript
// types.ts
export type DatabaseType = "postgresql" | "mssql" | "mysql";

// DatabaseService.ts
// Thêm methods: testMySQLConnection, fetchMySQLSchema, executeMySQLQuery
```

---

**Ready to go! 🚀**

Nhấn F5 và bắt đầu chat với database của bạn!
