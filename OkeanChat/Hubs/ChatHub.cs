using Microsoft.AspNetCore.SignalR;
using OkeanChat.Data;
using OkeanChat.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using OkeanChat.Services;
using OkeanChat.Hubs;

namespace OkeanChat.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly OnlineUserService _onlineUserService;
        private readonly IHubContext<NotificationHub> _notificationHub;
        private static readonly Dictionary<string, string> _userConnections = new(); // ConnectionId -> UserId
        private static readonly Dictionary<string, string> _connectionToUsername = new(); // ConnectionId -> Username
        private static readonly Dictionary<string, HashSet<string>> _typingUsers = new();
        private static readonly Dictionary<string, HashSet<string>> _connectionGroups = new(); // ConnectionId -> Groups
        private static readonly Dictionary<string, HashSet<string>> _privateChatConnections = new(); // UserId -> Set of friend UserIds they're chatting with

        public ChatHub(ApplicationDbContext context, UserManager<ApplicationUser> userManager, OnlineUserService onlineUserService, IHubContext<NotificationHub> notificationHub)
        {
            _context = context;
            _userManager = userManager;
            _onlineUserService = onlineUserService;
            _notificationHub = notificationHub;
        }

        public async Task JoinChannel(int channelId)
        {
            var channel = await _context.Channels.FindAsync(channelId);
            if (channel != null)
            {
                var user = await _userManager.GetUserAsync(Context.User);
                if (user != null)
                {
                    Console.WriteLine($"[ChatHub] JoinChannel: ConnectionId={Context.ConnectionId}, UserId={user.Id}, ChannelId={channelId}, UserName={user.UserName}");
                    var groupName = $"Channel_{channelId}";
                    await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
                    
                    // Track the group for this connection
                    if (!_connectionGroups.ContainsKey(Context.ConnectionId))
                    {
                        _connectionGroups[Context.ConnectionId] = new HashSet<string>();
                    }
                    _connectionGroups[Context.ConnectionId].Add(groupName);
                    
                    await Clients.Group(groupName).SendAsync("UserJoined", user.DisplayName ?? user.UserName);
                    
                    // Notify all users in the channel that this user came online (client will filter out current user)
                    var userInfo = new
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        DisplayName = user.DisplayName ?? user.UserName,
                        Avatar = user.Avatar
                    };
                    await Clients.Group(groupName).SendAsync("UserCameOnline", userInfo);
                    
                    // Send current online users to the newly joined user only (exclude the caller)
                    await SendOnlineUsersToCaller(channelId, user.Id);
                }
            }
        }

        public async Task LeaveChannel(int channelId)
        {
            var groupName = $"Channel_{channelId}";
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
            
            // Remove from tracking
            if (_connectionGroups.ContainsKey(Context.ConnectionId))
            {
                _connectionGroups[Context.ConnectionId].Remove(groupName);
            }
            
            var user = await _userManager.GetUserAsync(Context.User);
            if (user != null)
            {
                await Clients.Group(groupName).SendAsync("UserLeft", user.DisplayName ?? user.UserName);
            }
        }

        public async Task SendMessage(string content, int channelId)
        {
            if (string.IsNullOrWhiteSpace(content))
                return;

            var user = await _userManager.GetUserAsync(Context.User);
            if (user == null)
                return;

            var message = new Message
            {
                Content = content,
                UserId = user.Id,
                ChannelId = channelId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            // Update user's last seen
            user.LastSeen = DateTime.UtcNow;
            await _userManager.UpdateAsync(user);

            // Send message to all clients in the channel
            var chatMessage = new ChatMessage
            {
                Id = message.Id,
                Content = message.Content,
                Username = user.DisplayName ?? user.UserName,
                Avatar = user.Avatar,
                CreatedAt = message.CreatedAt,
                IsEdited = message.IsEdited,
                ChannelId = channelId
            };

            await Clients.Group($"Channel_{channelId}").SendAsync("ReceiveMessage", chatMessage);
        }

        public async Task StartTyping(int channelId)
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user == null) return;

            var username = user.DisplayName ?? user.UserName;

            if (!_typingUsers.ContainsKey($"Channel_{channelId}"))
            {
                _typingUsers[$"Channel_{channelId}"] = new HashSet<string>();
            }

            _typingUsers[$"Channel_{channelId}"].Add(username);

            await Clients.Group($"Channel_{channelId}").SendAsync("UserTyping", new TypingUser
            {
                Username = username,
                ChannelId = channelId
            });
        }

        public async Task StopTyping(int channelId)
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user == null) return;

            var username = user.DisplayName ?? user.UserName;

            if (_typingUsers.ContainsKey($"Channel_{channelId}"))
            {
                _typingUsers[$"Channel_{channelId}"].Remove(username);
            }

            await Clients.Group($"Channel_{channelId}").SendAsync("UserStoppedTyping", new TypingUser
            {
                Username = username,
                ChannelId = channelId
            });
        }

        public override async Task OnConnectedAsync()
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user != null)
            {
                var username = user.DisplayName ?? user.UserName;
                _userConnections[Context.ConnectionId] = user.Id;
                _connectionToUsername[Context.ConnectionId] = username;

                // Add to online service
                _onlineUserService.AddConnection(user.Id, Context.ConnectionId);

                // Update last seen
                user.LastSeen = DateTime.UtcNow;
                await _userManager.UpdateAsync(user);

                Console.WriteLine($"[ChatHub] OnConnectedAsync: ConnectionId={Context.ConnectionId}, UserId={user.Id}, UserName={username}, IsAuthenticated={Context.User?.Identity?.IsAuthenticated}");
                
                // Notify all channels that a user came online
                await NotifyUserOnline(user);
                
                // Notify friends that user is online
                await NotifyFriendsUserOnline(user.Id);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (_userConnections.TryGetValue(Context.ConnectionId, out var userId))
            {
                Console.WriteLine($"[ChatHub] OnDisconnectedAsync: ConnectionId={Context.ConnectionId}, UserId={userId}, Exception={(exception != null ? exception.Message : "none")}");
                
                // Remove from online service
                _onlineUserService.RemoveConnection(userId, Context.ConnectionId);
                
                // Get groups from tracking before removing connection
                HashSet<string>? userGroups = null;
                if (_connectionGroups.TryGetValue(Context.ConnectionId, out var groups))
                {
                    userGroups = new HashSet<string>(groups);
                }
                _userConnections.Remove(Context.ConnectionId);
                _connectionGroups.Remove(Context.ConnectionId);

                if (_connectionToUsername.TryGetValue(Context.ConnectionId, out var username))
                {
                    _connectionToUsername.Remove(Context.ConnectionId);

                    // Remove from all typing lists
                    foreach (var kvp in _typingUsers.ToList())
                    {
                        if (kvp.Value.Contains(username))
                        {
                            kvp.Value.Remove(username);
                            await Clients.Group(kvp.Key).SendAsync("UserStoppedTyping", new TypingUser
                            {
                                Username = username,
                                ChannelId = int.Parse(kvp.Key.Split('_')[1])
                            });
                        }
                    }

                    // Only broadcast offline if this was the user's last active connection
                    var stillConnected = _onlineUserService.IsUserOnline(userId);
                    if (!stillConnected)
                    {
                        if (userGroups != null)
                        {
                            foreach (var group in userGroups)
                            {
                                // Just send UserWentOffline, client will remove the user from the list
                                await Clients.Group(group).SendAsync("UserWentOffline", userId);
                            }
                        }
                        
                        // Notify friends that user went offline
                        await NotifyFriendsUserOffline(userId);
                    }
                    else
                    {
                        // There are other active connections for this user; do not mark offline.
                    }
                }
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task GetOnlineUsers(int channelId)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller != null)
            {
                Console.WriteLine($"[ChatHub] GetOnlineUsers: ConnectionId={Context.ConnectionId}, CallerId={caller.Id}, ChannelId={channelId}");
                await SendOnlineUsersToCaller(channelId, caller.Id);
            }
        }

        private async Task SendOnlineUsersToCaller(int channelId, string excludeUserId)
        {
            var onlineUserIds = _onlineUserService.GetAllOnlineUserIds();
            Console.WriteLine($"[ChatHub] SendOnlineUsersToCaller: ChannelId={channelId}, Exclude={excludeUserId}, OnlineCount={onlineUserIds.Count}");
            var onlineUsers = new List<object>();

            foreach (var userId in onlineUserIds)
            {
                // Exclude the current user from the list
                if (userId == excludeUserId)
                    continue;

                var user = await _userManager.FindByIdAsync(userId);
                if (user != null)
                {
                    onlineUsers.Add(new
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        DisplayName = user.DisplayName ?? user.UserName,
                        Avatar = user.Avatar,
                        IsOnline = true
                    });
                }
            }

            // Send only to the caller
            await Clients.Caller.SendAsync("OnlineUsers", onlineUsers);
        }

        private async Task SendOnlineUsersToGroup(int channelId, string? excludeUserId = null)
        {
            var groupName = $"Channel_{channelId}";
            var onlineUserIds = _onlineUserService.GetAllOnlineUserIds();
            var onlineUsers = new List<object>();

            foreach (var userId in onlineUserIds)
            {
                // Exclude the current user from the list
                if (excludeUserId != null && userId == excludeUserId)
                    continue;

                var user = await _userManager.FindByIdAsync(userId);
                if (user != null)
                {
                    onlineUsers.Add(new
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        DisplayName = user.DisplayName ?? user.UserName,
                        Avatar = user.Avatar,
                        IsOnline = true
                    });
                }
            }

            await Clients.Group(groupName).SendAsync("OnlineUsers", onlineUsers);
        }


        private async Task NotifyUserOnline(ApplicationUser user)
        {
            Console.WriteLine($"[ChatHub] NotifyUserOnline: ConnectionId={Context.ConnectionId}, UserId={user.Id}");
            var userInfo = new
            {
                Id = user.Id,
                UserName = user.UserName,
                DisplayName = user.DisplayName ?? user.UserName,
                Avatar = user.Avatar
            };

            // Get all channels user is in from tracking and notify them
            if (_connectionGroups.TryGetValue(Context.ConnectionId, out var userGroups))
            {
                foreach (var group in userGroups)
                {
                    await Clients.Group(group).SendAsync("UserCameOnline", userInfo);
                }
            }
        }

        // Notify friends when user comes online
        private async Task NotifyFriendsUserOnline(string userId)
        {
            var friendships = await _context.Friendships
                .Where(f => 
                    (f.RequesterId == userId || f.AddresseeId == userId) &&
                    f.Status == FriendshipStatus.Accepted)
                .ToListAsync();

            var friendIds = friendships
                .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
                .ToList();

            foreach (var friendId in friendIds)
            {
                var friendConnections = _onlineUserService.GetUserConnections(friendId);
                foreach (var connectionId in friendConnections)
                {
                    await Clients.Client(connectionId).SendAsync("FriendOnline", userId);
                }
            }
        }

        // Notify friends when user goes offline
        private async Task NotifyFriendsUserOffline(string userId)
        {
            var friendships = await _context.Friendships
                .Where(f => 
                    (f.RequesterId == userId || f.AddresseeId == userId) &&
                    f.Status == FriendshipStatus.Accepted)
                .ToListAsync();

            var friendIds = friendships
                .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
                .ToList();

            foreach (var friendId in friendIds)
            {
                var friendConnections = _onlineUserService.GetUserConnections(friendId);
                foreach (var connectionId in friendConnections)
                {
                    await Clients.Client(connectionId).SendAsync("FriendOffline", userId);
                }
            }
        }

        // Get friend online status for private chat
        public async Task GetFriendOnlineStatus(string friendId)
        {
            var currentUser = await _userManager.GetUserAsync(Context.User);
            if (currentUser == null) return;

            // Check if users are friends
            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => 
                    ((f.RequesterId == currentUser.Id && f.AddresseeId == friendId) ||
                     (f.RequesterId == friendId && f.AddresseeId == currentUser.Id)) &&
                    f.Status == FriendshipStatus.Accepted);

            if (friendship == null) return;

            var isOnline = _onlineUserService.IsUserOnline(friendId);
            await Clients.Caller.SendAsync("FriendOnlineStatus", friendId, isOnline);
        }

        // Join private chat room
        public async Task JoinPrivateChat(string friendId)
        {
            var currentUser = await _userManager.GetUserAsync(Context.User);
            if (currentUser == null) return;

            // Check if users are friends
            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => 
                    ((f.RequesterId == currentUser.Id && f.AddresseeId == friendId) ||
                     (f.RequesterId == friendId && f.AddresseeId == currentUser.Id)) &&
                    f.Status == FriendshipStatus.Accepted);

            if (friendship == null) return;

            // Track private chat connection
            if (!_privateChatConnections.ContainsKey(currentUser.Id))
            {
                _privateChatConnections[currentUser.Id] = new HashSet<string>();
            }
            _privateChatConnections[currentUser.Id].Add(friendId);

            // Send online status to caller
            var isOnline = _onlineUserService.IsUserOnline(friendId);
            await Clients.Caller.SendAsync("FriendOnlineStatus", friendId, isOnline);
        }

        // Leave private chat room
        public async Task LeavePrivateChat(string friendId)
        {
            var currentUser = await _userManager.GetUserAsync(Context.User);
            if (currentUser == null) return;

            if (_privateChatConnections.ContainsKey(currentUser.Id))
            {
                _privateChatConnections[currentUser.Id].Remove(friendId);
            }
        }

        // Private Chat Methods
        public async Task SendPrivateMessage(string content, string receiverId)
        {
            if (string.IsNullOrWhiteSpace(content))
                return;

            var sender = await _userManager.GetUserAsync(Context.User);
            if (sender == null)
                return;

            // Check if users are friends
            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => 
                    ((f.RequesterId == sender.Id && f.AddresseeId == receiverId) ||
                     (f.RequesterId == receiverId && f.AddresseeId == sender.Id)) &&
                    f.Status == FriendshipStatus.Accepted);

            if (friendship == null)
            {
                await Clients.Caller.SendAsync("Error", "You are not friends with this user");
                return;
            }

            var privateMessage = new PrivateMessage
            {
                Content = content,
                SenderId = sender.Id,
                ReceiverId = receiverId,
                CreatedAt = DateTime.UtcNow,
                IsRead = false
            };

            _context.PrivateMessages.Add(privateMessage);
            await _context.SaveChangesAsync();

            // Update sender's last seen
            sender.LastSeen = DateTime.UtcNow;
            await _userManager.UpdateAsync(sender);

            var messageInfo = new
            {
                Id = privateMessage.Id,
                Content = privateMessage.Content,
                SenderId = sender.Id,
                ReceiverId = receiverId,
                SenderName = sender.DisplayName ?? sender.UserName,
                SenderAvatar = sender.Avatar,
                CreatedAt = privateMessage.CreatedAt,
                IsRead = privateMessage.IsRead
            };

            // Send to sender
            await Clients.Caller.SendAsync("ReceivePrivateMessage", messageInfo);

            // Send to receiver if online
            if (_onlineUserService.IsUserOnline(receiverId))
            {
                var receiverConnections = _onlineUserService.GetUserConnections(receiverId);
                foreach (var connectionId in receiverConnections)
                {
                    await Clients.Client(connectionId).SendAsync("ReceivePrivateMessage", messageInfo);
                }
            }

            // Send notification to receiver via IHubContext (NotificationHub)
            await NotifyNewPrivateMessage(receiverId, sender, messageInfo);
        }

        public async Task GetPrivateMessages(string friendId, int page = 1, int pageSize = 50)
        {
            var currentUser = await _userManager.GetUserAsync(Context.User);
            if (currentUser == null)
                return;

            // Check if users are friends
            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => 
                    ((f.RequesterId == currentUser.Id && f.AddresseeId == friendId) ||
                     (f.RequesterId == friendId && f.AddresseeId == currentUser.Id)) &&
                    f.Status == FriendshipStatus.Accepted);

            if (friendship == null)
            {
                await Clients.Caller.SendAsync("Error", "You are not friends with this user");
                return;
            }

            var messages = await _context.PrivateMessages
                .Include(m => m.Sender)
                .Include(m => m.Receiver)
                .Where(m => 
                    (m.SenderId == currentUser.Id && m.ReceiverId == friendId) ||
                    (m.SenderId == friendId && m.ReceiverId == currentUser.Id))
                .OrderByDescending(m => m.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(m => new
                {
                    Id = m.Id,
                    Content = m.Content,
                    SenderId = m.SenderId,
                    ReceiverId = m.ReceiverId,
                    SenderName = m.Sender.DisplayName ?? m.Sender.UserName,
                    SenderAvatar = m.Sender.Avatar,
                    CreatedAt = m.CreatedAt,
                    IsRead = m.IsRead,
                    IsEdited = m.IsEdited
                })
                .ToListAsync();

            await Clients.Caller.SendAsync("PrivateMessages", messages.OrderBy(m => m.CreatedAt).ToList());

            // Mark messages as read
            var unreadMessages = await _context.PrivateMessages
                .Where(m => m.ReceiverId == currentUser.Id && 
                           m.SenderId == friendId && 
                           !m.IsRead)
                .ToListAsync();

            if (unreadMessages.Any())
            {
                foreach (var msg in unreadMessages)
                {
                    msg.IsRead = true;
                }

                await _context.SaveChangesAsync();

                // Update notification hub with new unread count
                await UpdateUnreadCountForUser(currentUser.Id);
            }
        }

        // Notify receiver about new private message
        private async Task NotifyNewPrivateMessage(string receiverId, ApplicationUser sender, object messageInfo)
        {
            var notificationConnections = NotificationHub.GetUserConnections(receiverId);
            
            if (notificationConnections.Any())
            {
                // Get unread count
                var unreadCount = await _context.PrivateMessages
                    .CountAsync(m => m.ReceiverId == receiverId && !m.IsRead);

                // Send notification
                foreach (var connectionId in notificationConnections)
                {
                    await _notificationHub.Clients.Client(connectionId).SendAsync("NewPrivateMessage", new
                    {
                        SenderId = sender.Id,
                        SenderName = sender.DisplayName ?? sender.UserName,
                        SenderAvatar = sender.Avatar,
                        Message = messageInfo,
                        UnreadCount = unreadCount
                    });
                    
                    await _notificationHub.Clients.Client(connectionId).SendAsync("ReceiveUnreadMessageCount", unreadCount);
                }
            }
        }

        // Update unread count for user
        private async Task UpdateUnreadCountForUser(string userId)
        {
            var unreadCount = await _context.PrivateMessages
                .CountAsync(m => m.ReceiverId == userId && !m.IsRead);

            var notificationConnections = NotificationHub.GetUserConnections(userId);
            foreach (var connectionId in notificationConnections)
            {
                await _notificationHub.Clients.Client(connectionId).SendAsync("ReceiveUnreadMessageCount", unreadCount);
            }
        }

        public async Task StartTypingPrivate(string receiverId)
        {
            var sender = await _userManager.GetUserAsync(Context.User);
            if (sender == null)
                return;

            // Check if users are friends
            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => 
                    ((f.RequesterId == sender.Id && f.AddresseeId == receiverId) ||
                     (f.RequesterId == receiverId && f.AddresseeId == sender.Id)) &&
                    f.Status == FriendshipStatus.Accepted);

            if (friendship == null)
                return;

            var senderInfo = new
            {
                UserId = sender.Id,
                UserName = sender.DisplayName ?? sender.UserName
            };

            // Send to receiver if online
            if (_onlineUserService.IsUserOnline(receiverId))
            {
                var receiverConnections = _onlineUserService.GetUserConnections(receiverId);
                foreach (var connectionId in receiverConnections)
                {
                    await Clients.Client(connectionId).SendAsync("UserTypingPrivate", senderInfo);
                }
            }
        }

        public async Task StopTypingPrivate(string receiverId)
        {
            var sender = await _userManager.GetUserAsync(Context.User);
            if (sender == null)
                return;

            // Check if users are friends
            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => 
                    ((f.RequesterId == sender.Id && f.AddresseeId == receiverId) ||
                     (f.RequesterId == receiverId && f.AddresseeId == sender.Id)) &&
                    f.Status == FriendshipStatus.Accepted);

            if (friendship == null)
                return;

            var senderInfo = new
            {
                UserId = sender.Id,
                UserName = sender.DisplayName ?? sender.UserName
            };

            // Send to receiver if online
            if (_onlineUserService.IsUserOnline(receiverId))
            {
                var receiverConnections = _onlineUserService.GetUserConnections(receiverId);
                foreach (var connectionId in receiverConnections)
                {
                    await Clients.Client(connectionId).SendAsync("UserStoppedTypingPrivate", senderInfo);
                }
            }
        }

    }
}
