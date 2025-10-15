# DataLens AI Extension - Hướng dẫn sử dụng

## 🎯 Giới thiệu

Extension VS Code cho phép bạn chat với database bằng ngôn ngữ tự nhiên, hỗ trợ PostgreSQL và SQL Server.

## 🚀 Cài đặt & Chạy

### Bước 1: Cài đặt dependencies

```bash
cd vs-extension
npm install
```

### Bước 2: Compile TypeScript

```bash
npm run compile
```

Hoặc tự động compile khi có thay đổi:

```bash
npm run watch
```

### Bước 3: Chạy extension

1. Mở thư mục `vs-extension` trong VS Code
2. Nhấn `F5` để debug
3. Một cửa sổ VS Code mới sẽ mở với extension đã được load

## ⚙️ Cấu hình

### 1. Set Gemini API Key

- Nhấn `Ctrl+Shift+P`
- Gõ: "DataLens: Set Gemini API Key"
- Nhập API key từ [Google AI Studio](https://makersuite.google.com/app/apikey)

### 2. Kết nối Database

- Nhấn `Ctrl+Shift+P`
- Gõ: "DataLens: Connect Database"
- Điền thông tin kết nối:
  - Tên database (tên hiển thị)
  - Loại database (PostgreSQL hoặc SQL Server)
  - Host (localhost)
  - Port (5432 cho PostgreSQL, 1433 cho SQL Server)
  - Tên database
  - Username
  - Password
  - SSL (tùy chọn)
- Nhấn "Test Connection" để kiểm tra
- Nhấn "Save & Connect" để lưu và lấy schema

## 💬 Sử dụng Chat

### Mở Chat Panel

1. Click vào icon DataLens ở Activity Bar (thanh bên trái)
2. Hoặc dùng Command Palette: "DataLens: Open Chat"

### Hỏi câu hỏi

Gõ câu hỏi bằng ngôn ngữ tự nhiên, ví dụ:

- "Có bao nhiêu user trong database?"
- "Top 5 sản phẩm bán chạy nhất?"
- "Tổng doanh thu tháng này?"
- "Danh sách khách hàng đã mua hàng trong 7 ngày qua?"

AI sẽ:

1. Phân tích câu hỏi
2. Tạo câu SQL query dựa trên schema
3. Chạy query
4. Trả về kết quả bằng ngôn ngữ tự nhiên

## 🔧 Cấu trúc Project

```
vs-extension/
├── src/
│   ├── extension.ts              # Entry point chính
│   ├── types.ts                   # Định nghĩa kiểu dữ liệu
│   ├── services/
│   │   ├── DatabaseService.ts    # Kết nối & query database
│   │   └── AIService.ts          # Tích hợp Gemini AI
│   └── panels/
│       ├── DatabaseConnectionPanel.ts  # Form kết nối DB
│       └── ChatPanel.ts          # Giao diện chat
├── package.json                   # Manifest của extension
├── tsconfig.json                  # Config TypeScript
└── README.md                      # Tài liệu
```

## 🎨 Tính năng chính

### 1. Kết nối Database

- Hỗ trợ PostgreSQL và SQL Server
- Form nhập thông tin trực quan
- Test connection trước khi lưu
- Tự động fetch schema

### 2. Chat với Database

- Giao diện chat đơn giản, dễ sử dụng
- Hiển thị lịch sử chat
- Loading indicator khi xử lý
- Xóa lịch sử chat

### 3. AI Query Generation

- Sử dụng Gemini AI
- Tự động hiểu schema database
- Generate SQL query an toàn (chỉ SELECT)
- Trả về kết quả bằng ngôn ngữ tự nhiên

### 4. Bảo mật

- API key lưu trong VS Code secret storage
- Password database mã hóa
- Chỉ cho phép SELECT query
- Không cho phép INSERT, UPDATE, DELETE

## 🐛 Xử lý lỗi thường gặp

### Extension không hiển thị

- Kiểm tra đã compile: `npm run compile`
- Xem Output panel để check lỗi

### Không kết nối được database

- Kiểm tra database đang chạy
- Verify thông tin kết nối
- PostgreSQL: check `pg_hba.conf`
- SQL Server: enable TCP/IP

### AI không phản hồi

- Kiểm tra API key đã set đúng chưa
- Check internet connection
- Xem Output panel để debug

### Schema không load

- Kiểm tra user có quyền đọc schema
- Database phải có tables

## 📚 So sánh với bản Web

| Tính năng     | Web App            | VS Code Extension     |
| ------------- | ------------------ | --------------------- |
| Kết nối DB    | ✅ Qua backend API | ✅ Direct connection  |
| Chat AI       | ✅ Full featured   | ✅ Simplified version |
| Schema        | ✅ Upload SQL file | ✅ Auto-fetch từ DB   |
| Visualization | ✅ Charts & tables | ❌ Chỉ text response  |
| History       | ✅ IndexedDB       | ✅ In-memory          |
| Multi-step    | ✅ Complex queries | ✅ Basic queries      |

## 📝 Next Steps

Có thể mở rộng thêm:

- [ ] Hỗ trợ MySQL
- [ ] Lưu history vào file
- [ ] Export kết quả ra CSV
- [ ] Syntax highlighting cho SQL
- [ ] Multiple database connections
- [ ] Database schema viewer
- [ ] Query history panel

## 🤝 Credits

- Dựa trên DataLens AI web app
- Sử dụng Gemini AI
- Tạo cho AI Got Talent 2025

## 📄 License

MIT

---

**Chúc bạn code vui vẻ! 🚀**
