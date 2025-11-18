# 🎯 OkeanChat - Project Overview

## 📌 Project Summary

**OkeanChat** là một ứng dụng chat và video call thời gian thực được xây dựng bằng **ASP.NET Core 8** và **SignalR**. Ứng dụng cung cấp các tính năng giao tiếp toàn diện cho người dùng, bao gồm chat công khai, tin nhắn riêng tư, quản lý bạn bè, và cuộc gọi âm thanh/video.

---

## 🏗️ Architecture & Technology Stack

### Backend
- **Framework**: ASP.NET Core 8 (Web + MVC)
- **Real-time Communication**: SignalR 1.1.0
- **Database**: SQL Server (Entity Framework Core 8)
- **Authentication**: ASP.NET Core Identity
- **ORM**: Entity Framework Core 8

### Frontend
- **HTML/CSS/JavaScript**: Vanilla JS + jQuery
- **UI Framework**: Bootstrap 5
- **Real-time Library**: SignalR Client
- **WebRTC**: Peer.js / Native WebRTC API
- **Icons**: Font Awesome

### Key Dependencies
```xml
- Microsoft.AspNetCore.Identity.EntityFrameworkCore (8.0.0)
- Microsoft.AspNetCore.SignalR (1.1.0)
- Microsoft.EntityFrameworkCore.SqlServer (8.0.0)
- Microsoft.EntityFrameworkCore.Tools (8.0.0)
```

---

## 📁 Project Structure

```
OkeanChat/
├── Controllers/
│   ├── AccountController.cs      # User authentication & profile management
│   ├── ChatController.cs         # API endpoints for chat messages
│   ├── FriendController.cs       # Friend management API
│   ├── CallController.cs         # Call room management
│   └── HomeController.cs         # Main chat interface
├── Hubs/
│   ├── ChatHub.cs               # Real-time messaging (public & private)
│   ├── WebRTCHub.cs             # P2P voice/video call signaling
│   ├── CallHub.cs               # Multi-participant call management
│   └── NotificationHub.cs        # Notifications (unread messages)
├── Models/
│   ├── User.cs                  # ApplicationUser + Channel, Message, Friendship, PrivateMessage
│   └── CallRoom.cs              # Call room & RoomUser classes
├── Data/
│   └── ApplicationDbContext.cs   # EF Core DbContext
├── Services/
│   └── OnlineUserService.cs      # Online user tracking service
├── Views/
│   ├── Home/
│   │   ├── ChatInterface.cshtml  # Main chat UI with sidebar
│   │   ├── Chat.cshtml          # Single channel view
│   │   └── Landing.cshtml       # Landing page
│   ├── Account/
│   │   ├── Login.cshtml
│   │   ├── Register.cshtml
│   │   └── Profile.cshtml
│   ├── Call/
│   │   └── Index.cshtml         # Video call interface
│   └── Shared/
│       ├── _Layout.cshtml
│       └── _Sidebar.cshtml
├── wwwroot/
│   ├── css/
│   ├── js/
│   │   ├── site.js              # General utilities
│   │   ├── call.js              # WebRTC call manager
│   │   └── webrtc.js            # WebRTC utilities
│   ├── avatars/                 # User uploaded avatars
│   └── img/
├── Migrations/                  # Database migrations
├── Program.cs                   # Application startup configuration
└── appsettings.json            # Configuration settings
```

---

## 🔑 Core Features

### 1. **Authentication & User Management**
- ✅ User registration with email validation
- ✅ User login (by username or email)
- ✅ User profile with avatar upload/removal
- ✅ Display name management
- ✅ Automatic avatar generation via UI Avatars API

**Location**: `Controllers/AccountController.cs`

### 2. **Public Channel Chat**
- ✅ Create new channels
- ✅ Real-time message broadcasting via SignalR
- ✅ Message history (pagination)
- ✅ Typing indicators
- ✅ Online user presence
- ✅ Message metadata (edit status, timestamps)

**Location**: `Hubs/ChatHub.cs`, `Controllers/ChatController.cs`

### 3. **Private Messaging**
- ✅ One-to-one direct messages between friends
- ✅ Unread message notifications
- ✅ Message read status
- ✅ Private chat history
- ✅ Typing indicators in private chats
- ✅ Unread badge on friends list

**Location**: `Hubs/ChatHub.cs` (SendPrivateMessage, GetPrivateMessages methods)

### 4. **Friend Management**
- ✅ Search users by username
- ✅ Send friend requests
- ✅ Accept/reject friend requests
- ✅ View friend list with online status
- ✅ Remove friends
- ✅ Friend request notifications
- ✅ Real-time online/offline status updates

**Location**: `Controllers/FriendController.cs`, `Hubs/ChatHub.cs`

### 5. **Online User Tracking**
- ✅ Track all online users
- ✅ Support for multiple connections per user (multiple tabs)
- ✅ Real-time online status notifications
- ✅ Last seen timestamp

**Location**: `Services/OnlineUserService.cs`, `Hubs/ChatHub.cs`

### 6. **Voice & Video Calls**
- ✅ P2P WebRTC audio/video calls
- ✅ Call initiation with friendship verification
- ✅ Call acceptance/rejection
- ✅ ICE candidate handling
- ✅ Call end notifications
- ✅ Busy status checking

**Location**: `Hubs/WebRTCHub.cs`

### 7. **Multi-participant Video Calls**
- ✅ Create call rooms with unique IDs
- ✅ Multiple participants support
- ✅ Share room ID to invite others
- ✅ WebRTC mesh topology (P2P connections)
- ✅ Mic/camera toggle controls
- ✅ Participant list with status indicators
- ✅ Real-time user join/leave notifications

**Location**: `Hubs/CallHub.cs`, `Controllers/CallController.cs`, `Views/Call/Index.cshtml`

### 8. **Notifications**
- ✅ Browser push notifications
- ✅ Unread message count
- ✅ Friend request notifications
- ✅ New message notifications
- ✅ Call notifications

**Location**: `Hubs/NotificationHub.cs`

---

## 🔄 Database Schema

### Tables (Key Entities)

#### AspNetUsers (ApplicationUser)
```csharp
- Id (PK)
- UserName, Email
- PasswordHash
- DisplayName
- Avatar
- CreatedAt, LastSeen
- (Identity properties: EmailConfirmed, PhoneNumber, etc.)
```

#### Channels
```csharp
- Id (PK)
- Name (UNIQUE)
- Description
- CreatedAt
- IsActive
```

#### Messages
```csharp
- Id (PK)
- Content
- UserId (FK → AspNetUsers)
- ChannelId (FK → Channels)
- CreatedAt, EditedAt
- IsEdited
```

#### Friendships
```csharp
- Id (PK)
- RequesterId (FK → AspNetUsers)
- AddresseeId (FK → AspNetUsers)
- Status (Pending=0, Accepted=1, Blocked=2)
- CreatedAt, UpdatedAt
- Unique index on (RequesterId, AddresseeId)
```

#### PrivateMessages
```csharp
- Id (PK)
- Content
- SenderId (FK → AspNetUsers)
- ReceiverId (FK → AspNetUsers)
- CreatedAt, EditedAt
- IsEdited, IsRead
```

---

## 🔌 SignalR Hubs

### 1. **ChatHub** (`/chatHub`)
**Purpose**: Handle public channel chat, private messages, and friend notifications

**Key Methods (Client → Server)**:
- `JoinChannel(channelId)` - Join a channel
- `LeaveChannel(channelId)` - Leave a channel
- `SendMessage(content, channelId)` - Send public message
- `StartTyping(channelId)` / `StopTyping(channelId)` - Typing indicators
- `SendPrivateMessage(content, receiverId)` - Send private message
- `GetPrivateMessages(friendId, page)` - Load private chat history
- `StartTypingPrivate(receiverId)` / `StopTypingPrivate(receiverId)`
- `GetOnlineUsers(channelId)` - Get online users
- `GetFriendOnlineStatus(friendId)` - Check friend status

**Server → Client Events**:
- `ReceiveMessage(chatMessage)` - Receive public message
- `ReceivePrivateMessage(messageInfo)` - Receive private message
- `UserJoined(username)` - User joined channel
- `UserLeft(username)` - User left channel
- `UserCameOnline(userInfo)` - Friend came online
- `UserWentOffline(userId)` - Friend went offline
- `UserTyping(typingUser)` - Someone typing
- `UserStoppedTyping(typingUser)`
- `FriendOnline(userId)` - Friend online notification
- `FriendOffline(userId)` - Friend offline notification

### 2. **WebRTCHub** (`/webrtcHub`)
**Purpose**: Handle P2P WebRTC signaling for 1-on-1 calls

**Key Methods (Client → Server)**:
- `InitiateCall(targetUserId, callType)` - Start voice/video call
- `SendOffer(targetUserId, offer)` - Send WebRTC offer
- `SendAnswer(targetUserId, answer)` - Send WebRTC answer
- `SendIceCandidate(targetUserId, candidate)` - Send ICE candidate
- `AcceptCall(callerId)` - Accept incoming call
- `RejectCall(callerId)` - Reject incoming call
- `EndCall(targetUserId)` - End active call
- `GetOnlineUsers()` - Get available users to call

**Server → Client Events**:
- `IncomingCall(callerInfo, callType)` - Incoming call notification
- `CallInitiated(targetUserId, callType)` - Call started
- `CallAccepted(receiverInfo)` - Call accepted
- `CallRejected(receiverInfo)` - Call rejected
- `CallEnded(userInfo)` - Call ended
- `ReceiveOffer(callerInfo, offer)` - Receive WebRTC offer
- `ReceiveAnswer(answerInfo, answer)` - Receive WebRTC answer
- `ReceiveIceCandidate(candidateInfo, candidate)` - Receive ICE candidate
- `OnlineUsers(users)` - List of online users

### 3. **CallHub** (`/callHub`)
**Purpose**: Handle multi-participant video calls

**Key Methods (Client → Server)**:
- `JoinRoom(roomId, userId)` - Join call room
- `LeaveRoom(roomId, userId)` - Leave call room
- `SendOffer(targetUserId, offer, fromUserId)` - Send offer in room
- `SendAnswer(targetUserId, answer, fromUserId)` - Send answer in room
- `SendIceCandidate(targetUserId, candidate, fromUserId)` - ICE in room
- `GetRoomUsers(roomId)` - Get participants list

**Server → Client Events**:
- `JoinedRoom(roomData)` - Successfully joined
- `UserJoined(userInfo)` - New participant joined
- `UserLeft(userData)` - Participant left
- `ReceiveOffer(fromUserInfo, offer)`
- `ReceiveAnswer(fromUserInfo, answer)`
- `ReceiveIceCandidate(fromUserInfo, candidate)`
- `RoomUsers(users)` - List of room participants

### 4. **NotificationHub** (`/notificationHub`)
**Purpose**: Send notifications (unread messages, friend requests)

**Key Methods**:
- (Automatic on connection)

**Server → Client Events**:
- `ReceiveUnreadMessageCount(count)` - Total unread count
- `ReceiveUnreadMessagesByFriend(unreadSummary)` - Unread per friend
- `NewPrivateMessage(data)` - New private message notification

---

## 🎨 UI Components & Views

### Main Views

#### `ChatInterface.cshtml`
- **Purpose**: Main chat dashboard
- **Features**:
  - Sidebar with channels and friends list
  - Mobile hamburger menu
  - Friend search
  - Friend requests modal
  - Add channel modal
  - User profile section
  - Real-time online status
  - Unread badges

#### `Call/Index.cshtml`
- **Purpose**: Multi-participant video call interface
- **Features**:
  - Remote video grid
  - Local video preview (picture-in-picture)
  - Room info & ID copy button
  - Participants list with status
  - Mic/camera toggle controls
  - Leave call button
  - Responsive design

#### `Account/Profile.cshtml`
- **Purpose**: User profile management
- **Features**:
  - Display name editing
  - Avatar upload/change
  - Avatar removal
  - Message history

---

## 🔐 Security Features

- ✅ **Authentication**: ASP.NET Core Identity (password hashing, email verification)
- ✅ **Authorization**: 
  - `[Authorize]` attribute on controllers/hubs
  - Friend verification before calls
  - Private message access control
- ✅ **HTTPS**: Enforced redirection
- ✅ **CSRF Protection**: `[ValidateAntiForgeryToken]`
- ✅ **Account Lockout**: After 5 failed login attempts
- ✅ **File Upload Validation**: File type and size restrictions
- ✅ **Input Sanitization**: HTML encoding in views

---

## 📊 Database Relationships

```
ApplicationUser
├── ← Messages (UserId FK, cascade delete)
├── ← Friendships (RequesterId FK, restrict delete)
├── ← Friendships (AddresseeId FK, restrict delete)
├── ← PrivateMessages (SenderId FK, restrict delete)
└── ← PrivateMessages (ReceiverId FK, restrict delete)

Channel
└── ← Messages (ChannelId FK, cascade delete)
```

---

## 🚀 Startup Configuration (Program.cs)

**Key Configuration**:

1. **Entity Framework**
   ```csharp
   builder.Services.AddDbContext<ApplicationDbContext>(options =>
       options.UseSqlServer(connectionString));
   ```

2. **Identity**
   ```csharp
   builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options => {
       // Password: Min 6 chars, 1 uppercase, 1 lowercase, 1 digit
       // Lockout: 5 attempts → 5 minutes lockout
   })
   .AddEntityFrameworkStores<ApplicationDbContext>()
   .AddDefaultTokenProviders();
   ```

3. **SignalR**
   ```csharp
   builder.Services.AddSignalR();
   ```

4. **Online User Service**
   ```csharp
   builder.Services.AddSingleton<OnlineUserService>();
   ```

5. **CORS**
   ```csharp
   builder.Services.AddCors(options => {
       options.AddPolicy("AllowAll", policy => {
           policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
       });
   });
   ```

6. **File Upload**
   - Max 10MB request body size
   - Avatar upload: 5MB max, JPG/PNG/GIF/WebP only

---

## 📱 Responsive Design

- **Breakpoints**: Tailwind CSS defaults (lg: 1024px)
- **Mobile Menu**: Hamburger toggle, sidebar overlay
- **Mobile-first CSS**: Progressive enhancement
- **Touch-friendly**: Large buttons for mobile

---

## 🔄 Data Flow Examples

### Example 1: Send Public Message
```
User Types Message
    ↓
JavaScript: chatConnection.invoke("SendMessage", content, channelId)
    ↓
ChatHub.SendMessage() [Server]
    ├─ Save to DB
    ├─ Create ChatMessage DTO
    └─ Broadcast: Clients.Group($"Channel_{channelId}").SendAsync("ReceiveMessage", chatMessage)
    ↓
JavaScript: connection.on("ReceiveMessage", (msg) => displayMessage(msg))
    ↓
Display on UI
```

### Example 2: Send Friend Request
```
Click "Add Friend" Button
    ↓
JavaScript: $.post('/api/Friend/request', { userId })
    ↓
FriendController.SendFriendRequest() [Server]
    ├─ Verify not already friends
    ├─ Create Friendship record with Status=Pending
    └─ Return success
    ↓
JavaScript: Update UI (button changes to "Added")
    ↓
Recipient: loadFriendRequests() shows new request
```

### Example 3: Start Video Call
```
User1 Clicks Call Button
    ↓
JavaScript: webrtcConnection.invoke("InitiateCall", targetUserId, "video")
    ↓
WebRTCHub.InitiateCall() [Server]
    ├─ Check if users are friends
    ├─ Check if both users online
    ├─ Check if neither is already in call
    ├─ Register active call
    └─ Send: Clients.Client(targetConnId).SendAsync("IncomingCall", callerInfo, "video")
    ↓
User2 UI: Shows incoming call modal
    ↓
User2 Clicks Accept
    ↓
JavaScript: webrtcConnection.invoke("AcceptCall", callerId)
    ↓
WebRTCHub.AcceptCall() [Server]
    ├─ Verify call is active
    └─ Send: Clients.Client(callerConnId).SendAsync("CallAccepted", receiverInfo)
    ↓
Both Users: Start WebRTC handshake (offer/answer/ICE)
    ↓
Video Call Established
```

---

## 🐛 Known Features & Limitations

### ✅ Fully Implemented
- Public channel chat with persistence
- Private messaging
- Friend management system
- P2P voice/video calls
- Multi-participant video calls
- Online status tracking
- Message read status
- Typing indicators
- Browser notifications

### 🔄 Real-time Features via SignalR
- Message synchronization across clients
- Presence detection
- Instant notifications
- Call signaling

---

## 📈 Performance Optimizations

1. **Database Indexes**
   - Unique index on (RequesterId, AddresseeId) in Friendships
   - Index on (SenderId, ReceiverId) in PrivateMessages
   - Index on CreatedAt for sorting

2. **Pagination**
   - Messages: 50 per page default
   - Private messages: 50 per page default

3. **Online User Service**
   - Thread-safe concurrent dictionary
   - Efficient connection tracking

4. **SignalR Groups**
   - Channel-based grouping for broadcasting
   - Reduces unnecessary message distribution

---

## 🧪 Testing Recommendations

### Unit Tests
- OnlineUserService connection/disconnection logic
- Friend request validation
- Message creation and persistence

### Integration Tests
- SignalR message broadcasting
- Database operations (CRUD)
- Authentication flow

### E2E Tests
- Complete chat workflow
- Friend request flow
- Video call initiation
- Message notifications

---

## 🚀 Deployment Considerations

1. **Database**: SQL Server connection string in `appsettings.Production.json`
2. **HTTPS**: Configure certificate
3. **SignalR**: Configure for production (WebSocket fallbacks)
4. **File Storage**: Configure avatar storage (cloud/local)
5. **Environment Variables**: Sensitive configs via env vars
6. **Logging**: Configure application logging
7. **CORS**: Configure for production domain

---

## 📚 API Endpoints

### Authentication
- `POST /Account/Register` - Register new user
- `POST /Account/Login` - User login
- `POST /Account/Logout` - User logout
- `GET /Account/Profile` - Get user profile
- `POST /Account/UpdateProfile` - Update profile
- `POST /Account/UploadAvatar` - Upload avatar
- `POST /Account/RemoveAvatar` - Remove avatar

### Chat
- `GET /api/Chat/messages/{channelId}` - Get messages (paginated)
- `GET /api/Chat/channels` - Get all channels
- `POST /api/Chat/users` - Create temporary user

### Friends
- `GET /api/Friend/search?username=` - Search users
- `POST /api/Friend/request` - Send friend request
- `POST /api/Friend/accept` - Accept friend request
- `POST /api/Friend/reject` - Reject friend request
- `GET /api/Friend/list` - Get friends list
- `GET /api/Friend/requests` - Get pending requests
- `POST /api/Friend/remove` - Remove friend
- `POST /api/Friend/cancel` - Cancel sent request
- `GET /api/Friend/unread-count` - Get unread count
- `GET /api/Friend/unread-by-friend` - Get unread by friend

### Calls
- `POST /Call/StartCall` - Start call
- `POST /Call/JoinRoom` - Join call room
- `POST /Call/LeaveRoom` - Leave call room
- `GET /Call/Index?roomId=` - Get call interface

---

## 🎓 Portfolio Presentation

This project demonstrates:

✅ **Full-Stack Development**
- ASP.NET Core backend
- Real-time communication
- Database design and optimization
- RESTful API design

✅ **Advanced Features**
- WebRTC P2P implementation
- SignalR real-time communication
- Multi-user online presence tracking
- Complex relational database schema

✅ **Software Engineering Practices**
- MVC architecture
- Dependency injection
- Entity Framework Core
- Security best practices
- Responsive UI design

✅ **Problem Solving**
- Scalable connection management
- Concurrent operations handling
- Real-time event synchronization
- Friend verification logic

---

## 📞 Contact & Support

For questions about this project, refer to the code structure above and individual file implementations.

---

**Version**: 1.0  
**Last Updated**: November 2025  
**Technology Stack**: ASP.NET Core 8 + SignalR + SQL Server + WebRTC
