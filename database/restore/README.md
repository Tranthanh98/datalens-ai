# SQL Server Database Restore Guide

## 📁 Cách restore database từ file .bak

### Bước 1: Đặt file .bak vào folder

Copy file .bak của bạn vào folder:

```
./database/restore/your-database.bak
```

### Bước 2: Kết nối vào SQL Server container

```powershell
docker exec -it datalens-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P YourStrong@Passw0rd
```

### Bước 3: Restore database

```sql
-- Xem thông tin file backup (optional)
RESTORE FILELISTONLY FROM DISK = '/var/opt/mssql/restore/your-database.bak'
GO

-- Restore database
RESTORE DATABASE YourDatabaseName
FROM DISK = '/var/opt/mssql/restore/your-database.bak'
WITH MOVE 'LogicalDataFileName' TO '/var/opt/mssql/data/YourDatabase.mdf',
     MOVE 'LogicalLogFileName' TO '/var/opt/mssql/data/YourDatabase_log.ldf',
     REPLACE
GO

-- Kiểm tra database đã restore
SELECT name FROM sys.databases
GO

-- Thoát
exit
```

### Hoặc dùng lệnh một dòng:

```powershell
# Xem file list trong backup
docker exec -it datalens-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P YourStrong@Passw0rd -Q "RESTORE FILELISTONLY FROM DISK = '/var/opt/mssql/restore/your-database.bak'"

# Restore trực tiếp (thay tên file và logical names)
docker exec -it datalens-sqlserver /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P YourStrong@Passw0rd -Q "RESTORE DATABASE YourDB FROM DISK = '/var/opt/mssql/restore/your-database.bak' WITH MOVE 'LogicalDataFile' TO '/var/opt/mssql/data/YourDB.mdf', MOVE 'LogicalLogFile' TO '/var/opt/mssql/data/YourDB_log.ldf', REPLACE"
```

## 📝 Notes:

- File .bak trong `./database/restore/` sẽ được map tới `/var/opt/mssql/restore/` trong container
- Thay `YourDatabaseName` bằng tên database bạn muốn
- Thay `LogicalDataFileName` và `LogicalLogFileName` bằng tên logical files từ `RESTORE FILELISTONLY`
- Connection string sau khi restore: `Server=localhost,1433;Database=YourDatabaseName;User Id=sa;Password=YourStrong@Passw0rd;TrustServerCertificate=True`
