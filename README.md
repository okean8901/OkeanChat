# OkeanChat - Discord-like Chat Application

## 🚀 Tổng quan

OkeanChat là một ứng dụng web chat thời gian thực giống Discord, được xây dựng bằng ASP.NET Core MVC với SignalR, Entity Framework Core và SQL Server.

## ✨ Tính năng

- 💬 **Chat thời gian thực** với SignalR
- 📱 **Giao diện responsive** với Bootstrap + Tailwind CSS
- 🏷️ **Quản lý kênh chat** (channels)
- 👤 **Hệ thống người dùng** đơn giản
- ⌨️ **Typing indicator** (hiển thị ai đang gõ)
- 🎨 **Giao diện đẹp** giống Discord
- 📊 **Database** với Entity Framework Core

## 🛠️ Công nghệ sử dụng

- **Backend**: ASP.NET Core 8.0 MVC
- **Database**: SQL Server với Entity Framework Core
- **Real-time**: SignalR
- **Frontend**: Bootstrap 5 + Tailwind CSS
- **Icons**: Font Awesome
- **JavaScript**: jQuery

## 📋 Yêu cầu hệ thống

- .NET 8.0 SDK
- SQL Server (LocalDB hoặc Express)
- Visual Studio 2022 hoặc VS Code

## 🔧 Hướng dẫn Setup

### 1. Clone và Setup Project

```bash
# Di chuyển vào thư mục project
cd "T:\SOURCE CODE C#\OkeanChat\OkeanChat"

# Restore packages
dotnet restore

# Build project
dotnet build
```

### 2. Cấu hình Database

#### Option 1: Sử dụng SQL Server LocalDB (Khuyến nghị)

```bash
# Database sẽ được tạo tự động khi chạy ứng dụng
# Connection string trong appsettings.json:
# "Server=(localdb)\\mssqllocaldb;Database=Okean_Chat;Trusted_Connection=True;TrustServerCertificate=True;"
```

#### Option 2: Sử dụng SQL Server Express

1. Cài đặt SQL Server Express
2. Cập nhật connection string trong `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=DESKTOP-NB4LK8U\\SQLEXPRESS;Database=Okean_Chat;Trusted_Connection=True;TrustServerCertificate=True;"
  }
}
```

### 3. Chạy Migrations

```bash
# Tạo migration (đã được tạo sẵn)
dotnet ef migrations add InitialCreate

# Cập nhật database
dotnet ef database update
```

### 4. Chạy ứng dụng

```bash
# Chạy ứng dụng
dotnet run

# Hoặc chạy với hot reload
dotnet watch run
```

Ứng dụng sẽ chạy tại: `https://localhost:7000` hoặc `http://localhost:5000`

## 🎯 Cách sử dụng

### 1. Truy cập ứng dụng

- Mở trình duyệt và truy cập `https://localhost:7000`
- Nhập username để tham gia chat

### 2. Sử dụng các tính năng

- **Chọn kênh**: Click vào tên kênh ở sidebar
- **Gửi tin nhắn**: Nhập tin nhắn và nhấn Enter hoặc click Send
- **Tạo kênh mới**: Click nút "+" ở sidebar
- **Typing indicator**: Hiển thị khi ai đó đang gõ

### 3. Kênh có sẵn

- `#general` - Thảo luận chung
- `#random` - Chat ngẫu nhiên
- `#announcements` - Thông báo quan trọng

## 📁 Cấu trúc Project

```
OkeanChat/
├── Controllers/
│   ├── HomeController.cs      # Controller chính
│   └── ChatController.cs      # API Controller
├── Data/
│   └── ApplicationDbContext.cs # DbContext
├── Hubs/
│   └── ChatHub.cs            # SignalR Hub
├── Models/
│   └── User.cs               # Models (User, Channel, Message)
├── Views/
│   ├── Home/
│   │   ├── Index.cshtml      # Trang chủ
│   │   └── Chat.cshtml       # Trang chat
│   └── Shared/
│       └── _Layout.cshtml    # Layout chính
├── wwwroot/
│   ├── css/site.css          # Custom CSS
│   └── js/site.js            # JavaScript functions
├── Program.cs                # Startup configuration
└── appsettings.json         # Configuration
```

## 🔧 Cấu hình nâng cao

### 1. Thay đổi Port

Trong `Properties/launchSettings.json`:

```json
{
  "profiles": {
    "OkeanChat": {
      "commandName": "Project",
      "launchBrowser": true,
      "applicationUrl": "https://localhost:7001;http://localhost:5001",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      }
    }
  }
}
```

### 2. Cấu hình SignalR

Trong `Program.cs`, có thể thêm các tùy chọn SignalR:

```csharp
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.MaximumReceiveMessageSize = 1024 * 1024; // 1MB
});
```

### 3. Thêm Authentication

Để thêm xác thực người dùng, có thể tích hợp:

- ASP.NET Core Identity
- JWT Authentication
- OAuth (Google, Facebook, etc.)

## 🐛 Troubleshooting

### 1. Lỗi Database Connection

```
Error: Cannot connect to SQL Server
```

**Giải pháp**:

- Kiểm tra SQL Server đang chạy
- Cập nhật connection string
- Sử dụng LocalDB: `dotnet ef database update`

### 2. Lỗi SignalR Connection

```
Error: SignalR connection failed
```

**Giải pháp**:

- Kiểm tra firewall
- Đảm bảo HTTPS được cấu hình đúng
- Kiểm tra browser console để xem lỗi chi tiết

### 3. Lỗi Build

```
Error: Build failed
```

**Giải pháp**:

```bash
# Clean và rebuild
dotnet clean
dotnet restore
dotnet build
```

## 🚀 Deployment

### 1. Publish cho Production

```bash
# Publish release
dotnet publish -c Release -o ./publish

# Hoặc publish với Docker
docker build -t okeanchat .
docker run -p 8080:80 okeanchat
```

### 2. Cấu hình Production

- Cập nhật `appsettings.Production.json`
- Cấu hình HTTPS
- Thiết lập logging
- Cấu hình database production

## 📝 API Endpoints

### Chat API

- `GET /api/Chat/messages/{channelId}` - Lấy tin nhắn
- `GET /api/Chat/channels` - Lấy danh sách kênh
- `POST /api/Chat/users` - Tạo người dùng mới

### SignalR Hub

- `/chatHub` - SignalR connection endpoint

## 🤝 Đóng góp

1. Fork project
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Liên hệ

- **Developer**: OkeanChat Team
- **Email**: contact@okeanchat.com
- **Project Link**: [https://github.com/okeanchat/okeanchat](https://github.com/okeanchat/okeanchat)

---

## 🎉 Chúc mừng!

Bạn đã hoàn thành việc setup OkeanChat! Hãy mở trình duyệt và truy cập `https://localhost:7000` để bắt đầu chat.

**Lưu ý**: Để test tính năng real-time, hãy mở nhiều tab trình duyệt và thử chat với các username khác nhau.
