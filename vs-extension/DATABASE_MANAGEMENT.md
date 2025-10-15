# Database Management Features

DataLens AI extension now supports comprehensive database management capabilities. Here's how to use them:

## Available Commands

### 1. **DataLens: Manage Databases** (`datalens.listDatabases`)

- Hiển thị danh sách tất cả databases đã kết nối
- Cho phép select, delete hoặc view details cho từng database
- Database hiện tại sẽ được đánh dấu với ✓

### 2. **DataLens: Select Database** (`datalens.selectDatabase`)

- Chọn database làm database hiện tại
- Database được chọn sẽ được sử dụng cho các câu truy vấn AI

### 3. **DataLens: Delete Database** (`datalens.deleteDatabase`)

- Xóa database connection khỏi danh sách
- Sẽ hỏi xác nhận trước khi xóa
- Tự động clear current database nếu database bị xóa đang được select

### 4. **DataLens: Show Current Database** (`datalens.showCurrentDatabase`)

- Hiển thị thông tin chi tiết database hiện tại
- Cho phép chuyển database hoặc xem danh sách tables

### 5. **DataLens: Connect Database** (`datalens.connectDatabase`)

- Thêm database connection mới (như cũ)

## Status Bar Integration

- Extension sẽ hiển thị database hiện tại ở status bar (góc dưới bên trái)
- Format: `🗄️ Database_Name`
- Click vào status bar sẽ mở thông tin chi tiết database
- Nếu không có database nào được chọn: `🗄️ No DB`

## Quick Access Methods

### Method 1: Command Palette

1. Mở Command Palette (`Ctrl+Shift+P`)
2. Gõ "DataLens" để xem tất cả commands
3. Chọn command cần thiết

### Method 2: Status Bar

- Click vào database name trong status bar để xem thông tin chi tiết
- Có thể nhanh chóng chuyển database từ đây

### Method 3: Activity Bar (Sidebar)

- Click vào DataLens icon trong Activity Bar
- Sử dụng Chat panel để interact với database hiện tại

## Workflow Recommendations

### Lần đầu sử dụng:

1. **Connect Database** - Thêm database connections
2. **Select Database** - Chọn database để làm việc
3. **Open Chat** - Bắt đầu chat với database

### Quản lý hàng ngày:

1. Check status bar để biết database hiện tại
2. Dùng **Manage Databases** để switch giữa các databases
3. Dùng **Show Current Database** để xem thông tin chi tiết

### Dọn dẹp:

1. Dùng **Delete Database** để xóa connections không cần thiết
2. Hệ thống sẽ tự động update status bar và clear current selection

## Security Notes

- Passwords được lưu trong VS Code's configuration (encrypted)
- Database schemas được cache trong extension's global state
- Khi xóa database, tất cả thông tin liên quan sẽ được dọn sạch

## Troubleshooting

**Database không hiển thị trong status bar:**

- Check xem có database nào được select chưa
- Thử chạy "Show Current Database" để debug

**Database bị mất sau khi restart:**

- Database connections được lưu global, schemas được lưu trong workspace state
- Current database selection chỉ lưu trong workspace, cần select lại mỗi khi mở workspace mới

**Lỗi khi delete database:**

- Check permissions ghi vào VS Code settings
- Thử restart VS Code và thử lại
