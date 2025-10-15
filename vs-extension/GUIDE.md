# 🚀 DataLens AI Extension - Complete Guide

Đây là VS Code Extension cho phép bạn chat với database bằng AI, tương tự như bản web nhưng đơn giản hơn và tích hợp ngay trong VS Code.

---

## 📋 Mục lục

1. [Tổng quan](#tổng-quan)
2. [Cài đặt](#cài-đặt)
3. [Sử dụng](#sử-dụng)
4. [Kiến trúc](#kiến-trúc)
5. [Development](#development)
6. [FAQ](#faq)

---

## 🎯 Tổng quan

### So sánh với bản Web

| Tính năng       | Web App                  | VS Code Extension              |
| --------------- | ------------------------ | ------------------------------ |
| Kết nối DB      | Backend API              | ✅ Direct connection           |
| Database hỗ trợ | PostgreSQL, MSSQL, MySQL | ✅ PostgreSQL, MSSQL           |
| AI Chat         | ✅ Multi-step reasoning  | ✅ Single query (đơn giản hơn) |
| Schema          | Upload SQL file          | ✅ Auto-fetch                  |
| History         | IndexedDB                | In-memory                      |
| Visualization   | Charts & tables          | Text only                      |
| Security        | Backend validation       | ✅ Client-side validation      |

### Các tính năng chính

✅ **Kết nối Database**

- PostgreSQL và SQL Server
- Form nhập liệu trực quan
- Test connection trước khi lưu
- Lưu credentials an toàn

✅ **Chat Interface**

- Sidebar panel tiện lợi
- Natural language queries
- AI-powered SQL generation
- Real-time results

✅ **AI Integration**

- Gemini AI (Google)
- Tự động hiểu database schema
- Generate SQL queries
- Format results

✅ **Security**

- Read-only queries (chỉ SELECT)
- Encrypted credentials
- API key trong secret storage

---

## 🛠️ Cài đặt

### Yêu cầu

- VS Code 1.85.0 trở lên
- Node.js 18+
- PostgreSQL hoặc SQL Server database
- Gemini API Key ([Lấy tại đây](https://makersuite.google.com/app/apikey))

### Bước 1: Install Dependencies

```bash
cd vs-extension
npm install
```

### Bước 2: Compile TypeScript

```bash
# Compile một lần
npm run compile

# Hoặc watch mode (tự động compile khi có thay đổi)
npm run watch
```

### Bước 3: Run Extension

**Cách 1: Debug trong VS Code**

1. Mở folder `vs-extension` trong VS Code
2. Nhấn `F5` hoặc Run > Start Debugging
3. Một cửa sổ VS Code mới sẽ mở với extension được load

**Cách 2: Package và Install**

```bash
npm install -g @vscode/vsce
npm run package
code --install-extension datalens-ai-extension-0.0.1.vsix
```

---

## 💡 Sử dụng

### Setup lần đầu

#### 1. Set Gemini API Key

```
1. Nhấn Ctrl+Shift+P (Windows/Linux) hoặc Cmd+Shift+P (Mac)
2. Gõ: "DataLens: Set Gemini API Key"
3. Nhập API key của bạn
4. ✅ API key được lưu an toàn trong VS Code secrets
```

#### 2. Connect Database

```
1. Nhấn Ctrl+Shift+P
2. Gõ: "DataLens: Connect Database"
3. Điền thông tin:
   - Database Name: Tên hiển thị (vd: "My PostgreSQL")
   - Type: PostgreSQL hoặc SQL Server
   - Host: localhost (hoặc IP server)
   - Port: 5432 (PostgreSQL) hoặc 1433 (MSSQL)
   - Database: Tên database
   - Username: username
   - Password: password
   - SSL: Check nếu cần
4. Click "Test Connection" để kiểm tra
5. Click "Save & Connect" để lưu
6. ✅ Extension sẽ tự động fetch schema
```

### Sử dụng Chat

#### 1. Mở Chat Panel

```
Cách 1: Click icon DataLens ở Activity Bar (thanh bên trái)
Cách 2: Ctrl+Shift+P → "DataLens: Open Chat"
```

#### 2. Hỏi câu hỏi

Gõ câu hỏi bằng ngôn ngữ tự nhiên:

**Ví dụ PostgreSQL:**

```
- "How many users do we have?"
- "Show me the top 10 products by sales"
- "What is the total revenue this month?"
- "List all orders from the last 7 days"
- "Which customers haven't ordered in 30 days?"
```

**Ví dụ SQL Server:**

```
- "Count all records in Customers table"
- "Average order value by customer"
- "Products with inventory below 10"
- "Sales trend by month this year"
```

#### 3. Xem kết quả

AI sẽ:

1. ⚡ Phân tích câu hỏi của bạn
2. 🔍 Tạo SQL query dựa trên schema
3. 🚀 Chạy query trên database
4. 📊 Trả về kết quả bằng ngôn ngữ tự nhiên

---

## 🏗️ Kiến trúc

### Cấu trúc thư mục

```
vs-extension/
├── src/
│   ├── extension.ts              # 🚪 Entry point - Activate extension
│   ├── types.ts                   # 📝 TypeScript type definitions
│   │
│   ├── services/
│   │   ├── DatabaseService.ts    # 💾 Database operations
│   │   │   - testConnection()    # Test DB connection
│   │   │   - fetchSchema()       # Get DB schema
│   │   │   - executeQuery()      # Run SQL queries
│   │   │
│   │   └── AIService.ts          # 🤖 AI integration
│   │       - generateSQLQuery()  # Natural language → SQL
│   │       - generateAnswer()    # Results → Natural language
│   │
│   └── panels/
│       ├── DatabaseConnectionPanel.ts  # 🔌 Connection form UI
│       │   - Webview with HTML form
│       │   - Test & save connections
│       │
│       └── ChatPanel.ts          # 💬 Chat interface UI
│           - Webview sidebar panel
│           - Message history
│           - Send/receive messages
│
├── resources/
│   └── icon.svg                  # 🎨 Extension icon
│
├── .vscode/
│   ├── launch.json               # 🐛 Debug configuration
│   ├── tasks.json                # ⚙️ Build tasks
│   └── settings.json             # 🔧 Editor settings
│
├── package.json                  # 📦 Extension manifest
├── tsconfig.json                 # 🔷 TypeScript config
├── README.md                     # 📖 User documentation
├── SETUP.md                      # 🛠️ Developer guide
├── QUICKSTART.md                 # ⚡ Quick start guide
└── CHANGELOG.md                  # 📝 Version history
```

### Luồng hoạt động

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
├─────────────────────────────────────────────────────────────┤
│  ChatPanel (Webview)          DatabaseConnectionPanel       │
│  - Input message              - Connection form             │
│  - Display history            - Test connection             │
│  - Show loading               - Save & fetch schema         │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
             ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Extension Core                          │
├─────────────────────────────────────────────────────────────┤
│  extension.ts                                                │
│  - Activate extension                                        │
│  - Register commands                                         │
│  - Store context globally                                    │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
             ▼                               ▼
┌──────────────────────┐         ┌──────────────────────┐
│   AIService          │         │  DatabaseService     │
├──────────────────────┤         ├──────────────────────┤
│ - Gemini AI API      │         │ - PostgreSQL client  │
│ - Generate SQL       │◄────────┤ - MSSQL client       │
│ - Format results     │         │ - Execute queries    │
└──────────────────────┘         └──────────────────────┘
             │                               │
             └───────────────┬───────────────┘
                             ▼
                    ┌─────────────────┐
                    │    Database     │
                    │  (PostgreSQL/   │
                    │   SQL Server)   │
                    └─────────────────┘
```

### Data Flow - Chat Query

```
1. User types question in ChatPanel
   ↓
2. ChatPanel sends message to extension
   ↓
3. Extension gets:
   - Gemini API key from secrets
   - Database connection from config
   - Schema from global state
   ↓
4. AIService.generateSQLQuery()
   - Sends question + schema to Gemini
   - Receives SQL query
   ↓
5. DatabaseService.executeQuery()
   - Validates query (must be SELECT)
   - Connects to database
   - Executes SQL
   - Returns results
   ↓
6. AIService.generateAnswer()
   - Sends results to Gemini
   - Receives natural language answer
   ↓
7. ChatPanel displays answer to user
```

---

## 👨‍💻 Development

### Prerequisites

```bash
# Check Node.js version
node --version  # Should be 18+

# Check npm version
npm --version
```

### Development Workflow

#### 1. Setup

```bash
cd vs-extension
npm install
```

#### 2. Development

```bash
# Terminal 1: Watch TypeScript compilation
npm run watch

# Terminal 2 (VS Code): Press F5 to start debugging
```

#### 3. Testing

**Test Database Connection:**

```sql
-- Create test database (PostgreSQL)
CREATE DATABASE testdb;

\c testdb

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (name, email) VALUES
  ('Alice', 'alice@example.com'),
  ('Bob', 'bob@example.com'),
  ('Charlie', 'charlie@example.com');
```

**Test Questions:**

```
- "How many users are there?"
- "List all users"
- "Show me users created today"
```

#### 4. Debugging

**View logs:**

```
Help > Toggle Developer Tools > Console
```

**Check errors:**

```
View > Output > Extension Host
```

### Adding New Features

#### Example: Add MySQL Support

**1. Update types.ts:**

```typescript
export type DatabaseType = "postgresql" | "mssql" | "mysql";
```

**2. Add to DatabaseService.ts:**

```typescript
private static async testMySQLConnection(connection: DatabaseConnection) {
  // Implementation
}

private static async fetchMySQLSchema(connection: DatabaseConnection) {
  // Implementation
}

private static async executeMySQLQuery(connection: DatabaseConnection, query: string) {
  // Implementation
}
```

**3. Update UI in DatabaseConnectionPanel.ts:**

```html
<button type="button" class="db-type-btn" data-type="mysql">🐬 MySQL</button>
```

---

## ❓ FAQ

### Cài đặt & Setup

**Q: Extension không hiển thị sau khi nhấn F5?**

```
A:
1. Kiểm tra đã compile: npm run compile
2. Check Output panel: View > Output > Extension Host
3. Verify package.json không có lỗi syntax
```

**Q: Làm sao biết extension đã active?**

```
A:
1. Mở Developer Tools (Help > Toggle Developer Tools)
2. Trong Console, sẽ thấy: "DataLens AI extension is now active!"
3. Icon DataLens sẽ xuất hiện ở Activity Bar
```

### Database Connection

**Q: Test connection fail với PostgreSQL?**

```
A: Kiểm tra:
1. PostgreSQL service đang chạy: sudo service postgresql status
2. pg_hba.conf cho phép connection từ localhost
3. User có quyền connect: GRANT CONNECT ON DATABASE dbname TO username;
4. Thử kết nối bằng psql: psql -h localhost -U username -d dbname
```

**Q: SQL Server connection timeout?**

```
A:
1. Enable TCP/IP trong SQL Server Configuration Manager
2. Restart SQL Server service
3. Check firewall cho phép port 1433
4. Thử: telnet localhost 1433
```

**Q: Schema không load được?**

```
A:
1. User phải có quyền đọc information_schema
2. Database phải có ít nhất 1 table
3. Check lỗi trong Output panel
```

### AI & Chat

**Q: AI không response?**

```
A:
1. Verify API key: Settings > Extensions > DataLens AI
2. Check internet connection
3. Gemini API quota: https://console.cloud.google.com/
4. View error trong Output panel
```

**Q: SQL query không chính xác?**

```
A:
1. Schema có thể chưa đầy đủ - reconnect database
2. Câu hỏi nên rõ ràng hơn
3. Thử phân tích câu hỏi thành các bước nhỏ hơn
```

**Q: Kết quả trả về rỗng nhưng database có data?**

```
A:
1. Check SQL query được generate (xem trong Output/Console)
2. Thử chạy query trực tiếp trong database client
3. Có thể WHERE condition quá strict
```

### Performance & Security

**Q: Query chậm với bảng lớn?**

```
A:
1. Database thiếu index
2. Thêm LIMIT vào câu hỏi: "Show 10 users..."
3. AI có thể generate query không tối ưu - kiểm tra EXPLAIN
```

**Q: Có thể chạy UPDATE/DELETE không?**

```
A: KHÔNG!
Extension chỉ cho phép SELECT queries để bảo mật.
Nếu cần modify data, dùng database client truyền thống.
```

**Q: Password có được mã hóa không?**

```
A: CÓ!
- Passwords lưu trong VS Code's encrypted storage
- API keys lưu trong VS Code's secret storage
- Không bao giờ log plaintext passwords
```

---

## 🔗 Links hữu ích

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Gemini AI Documentation](https://ai.google.dev/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [SQL Server Documentation](https://docs.microsoft.com/en-us/sql/)

---

## 📞 Support

Nếu gặp vấn đề:

1. Check các file hướng dẫn: SETUP.md, QUICKSTART.md
2. Xem FAQ ở trên
3. Check Output panel trong VS Code
4. Open issue trên GitHub

---

**Happy Coding! 🚀**

Made with ❤️ for AI Got Talent 2025
