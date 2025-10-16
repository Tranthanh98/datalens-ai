# Quick Start - PostgreSQL Setup cho DataLens AI

## Bước 1: Cài đặt PostgreSQL

### Windows (PowerShell as Administrator)

```powershell
# Sử dụng Chocolatey
choco install postgresql

# Hoặc tải installer: https://www.postgresql.org/download/windows/
```

### macOS

```bash
brew install postgresql@15
brew services start postgresql@15
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

## Bước 2: Cài đặt pgvector Extension

### Windows

```powershell
# Download từ: https://github.com/pgvector/pgvector/releases
# Hoặc sử dụng pre-built binaries
```

### macOS

```bash
brew install pgvector
```

### Linux

```bash
# PostgreSQL 15
sudo apt install postgresql-15-pgvector
```

## Bước 3: Tạo Database

```bash
# Kết nối PostgreSQL (mật khẩu mặc định thường để trống hoặc 'postgres')
psql -U postgres

# Trong psql, chạy các lệnh sau:
```

```sql
-- Tạo database
CREATE DATABASE datalens_ai;

-- Kết nối vào database
\c datalens_ai

-- Kích hoạt pgvector
CREATE EXTENSION vector;

-- Kiểm tra extension đã cài đặt
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Thoát psql
\q
```

## Bước 4: Cấu hình Server

```bash
cd server

# Copy file .env.example thành .env
cp .env.example .env

# Chỉnh sửa .env với thông tin của bạn
```

Nội dung file `.env`:

```env
PORT=3001
NODE_ENV=development

# Cấu hình PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=datalens_ai
DB_USER=postgres
DB_PASSWORD=your_password_here  # Thay bằng password của bạn
DB_SSL=false

# Auto-run migrations
AUTO_RUN_MIGRATIONS=true
```

## Bước 5: Cài đặt Dependencies và Chạy Server

```bash
# Cài đặt dependencies
pnpm install

# Chạy server (migrations sẽ tự động chạy)
pnpm dev
```

Bạn sẽ thấy output như sau:

```
🔧 Initializing DataLens AI Server...
✓ Database connection pool initialized for datalens_ai
✓ Database connection established
🔄 Running database migrations...
🔄 Starting database migrations...
✓ Migrations tracking table ready
Found 1 pending migration(s)
✓ Executed migration: 001_initial_schema.sql
✓ All migrations completed successfully
✓ Migrations completed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 DataLens AI Server running on http://localhost:3001
📊 Health check: http://localhost:3001/api/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Bước 6: Kiểm tra

### Test API Health Check

```bash
# Windows PowerShell
Invoke-WebRequest http://localhost:3001/api/health

# hoặc sử dụng curl
curl http://localhost:3001/api/health
```

### Kiểm tra Database

```bash
# Kiểm tra migration status
pnpm migrate:status
```

### Kiểm tra Tables trong PostgreSQL

```sql
-- Kết nối lại vào database
psql -U postgres -d datalens_ai

-- Liệt kê tất cả tables
\dt

-- Xem cấu trúc bảng
\d database_info
\d schema_info
\d conversations
\d messages
\d query_results

-- Kiểm tra dữ liệu
SELECT * FROM user_settings;
SELECT * FROM schema_migrations;
```

## Bước 7: Test API Endpoints

### Tạo Database Connection

```bash
# Windows PowerShell
$body = @{
    name = "Test DB"
    type = "postgresql"
    host = "localhost"
    port = 5432
    database = "testdb"
    username = "postgres"
    password = "password"
    ssl = $false
    isActive = $true
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3001/api/databases `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

### Lấy danh sách Databases

```bash
Invoke-WebRequest http://localhost:3001/api/databases
```

## Troubleshooting

### Lỗi: "Cannot connect to PostgreSQL"

```bash
# Kiểm tra PostgreSQL đang chạy
# Windows
Get-Service postgresql*

# macOS/Linux
sudo systemctl status postgresql

# Nếu không chạy, start nó
# Windows
Start-Service postgresql-x64-15  # tên service có thể khác

# macOS
brew services start postgresql@15

# Linux
sudo systemctl start postgresql
```

### Lỗi: "Extension vector not found"

```sql
-- Kết nối vào database
psql -U postgres -d datalens_ai

-- Tạo extension
CREATE EXTENSION vector;

-- Verify
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Lỗi: "Password authentication failed"

1. Kiểm tra password trong file `.env`
2. Reset password PostgreSQL nếu cần:

```bash
# Windows/Linux/Mac
psql -U postgres

# Trong psql
ALTER USER postgres PASSWORD 'new_password';
```

### Lỗi: "Migration failed"

```bash
# Reset database và chạy lại
psql -U postgres

# DROP DATABASE datalens_ai;
# CREATE DATABASE datalens_ai;
# \c datalens_ai
# CREATE EXTENSION vector;
# \q

# Chạy lại server
pnpm dev
```

## Các lệnh hữu ích

```bash
# Chạy migration thủ công
pnpm migrate

# Kiểm tra migration status
pnpm migrate:status

# Chạy server development mode
pnpm dev

# Build production
pnpm build

# Chạy production
pnpm start
```

## Next Steps

1. ✅ PostgreSQL đã setup
2. ✅ Migrations đã chạy
3. ✅ Server đang chạy
4. 🔜 Integrate OpenAI API để generate embeddings
5. 🔜 Update frontend để sử dụng API endpoints mới
6. 🔜 Implement semantic search với vector embeddings

## Tài liệu chi tiết

Xem file `POSTGRESQL_MIGRATION.md` để biết thêm chi tiết về:

- Cấu trúc database
- API endpoints
- Vector search
- Performance tuning
