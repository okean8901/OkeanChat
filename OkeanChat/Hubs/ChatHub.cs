using Microsoft.AspNetCore.SignalR;
using OkeanChat.Data;
using OkeanChat.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;

namespace OkeanChat.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private static readonly Dictionary<string, string> _userConnections = new();
        private static readonly Dictionary<string, HashSet<string>> _typingUsers = new();

        public ChatHub(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        public async Task JoinChannel(int channelId)
        {
            var channel = await _context.Channels.FindAsync(channelId);
            if (channel != null)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"Channel_{channelId}");
                var user = await _userManager.GetUserAsync(Context.User);
                if (user != null)
                {
                    await Clients.Group($"Channel_{channelId}").SendAsync("UserJoined", user.DisplayName ?? user.UserName);
                }
            }
        }

        public async Task LeaveChannel(int channelId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Channel_{channelId}");
            var user = await _userManager.GetUserAsync(Context.User);
            if (user != null)
            {
                await Clients.Group($"Channel_{channelId}").SendAsync("UserLeft", user.DisplayName ?? user.UserName);
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
                _userConnections[Context.ConnectionId] = username;

                // Update last seen
                user.LastSeen = DateTime.UtcNow;
                await _userManager.UpdateAsync(user);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (_userConnections.TryGetValue(Context.ConnectionId, out var username))
            {
                _userConnections.Remove(Context.ConnectionId);

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
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task GetOnlineUsers(int channelId)
        {
            var groupName = $"Channel_{channelId}";
            var onlineUsers = _userConnections.Values.Distinct().ToList();
            await Clients.Group(groupName).SendAsync("OnlineUsers", onlineUsers);
        }
    }
}
