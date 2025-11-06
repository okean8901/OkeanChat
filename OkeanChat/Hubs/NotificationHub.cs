using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using OkeanChat.Data;
using OkeanChat.Models;

namespace OkeanChat.Hubs
{
    [Authorize]
    public class NotificationHub : Hub
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ApplicationDbContext _context;
        private static readonly Dictionary<string, string> _userConnections = new(); // ConnectionId -> UserId

        public NotificationHub(UserManager<ApplicationUser> userManager, ApplicationDbContext context)
        {
            _userManager = userManager;
            _context = context;
        }

        public override async Task OnConnectedAsync()
        {
            if (Context.User != null)
            {
                var user = await _userManager.GetUserAsync(Context.User);
                if (user != null)
                {
                    _userConnections[Context.ConnectionId] = user.Id;
                    
                    // Send unread count
                    var unreadCount = await _context.PrivateMessages
                        .CountAsync(m => m.ReceiverId == user.Id && !m.IsRead);

                    await Clients.Caller.SendAsync("ReceiveUnreadMessageCount", unreadCount);

                    // Send unread messages per friend
                    var unreadByFriend = await _context.PrivateMessages
                        .Include(m => m.Sender)
                        .Where(m => m.ReceiverId == user.Id && !m.IsRead)
                        .GroupBy(m => m.SenderId)
                        .Select(g => new
                        {
                            FriendId = g.Key,
                            Count = g.Count(),
                            LastMessage = g.OrderByDescending(m => m.CreatedAt).FirstOrDefault()
                        })
                        .ToListAsync();

                    var unreadSummary = unreadByFriend.Select(u => new
                    {
                        FriendId = u.FriendId,
                        UnreadCount = u.Count,
                        LastMessage = u.LastMessage != null ? new
                        {
                            Content = u.LastMessage.Content,
                            CreatedAt = u.LastMessage.CreatedAt
                        } : null
                    }).ToList();

                    await Clients.Caller.SendAsync("ReceiveUnreadMessagesByFriend", unreadSummary);
                }
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            _userConnections.Remove(Context.ConnectionId);
            await base.OnDisconnectedAsync(exception);
        }

        // Get all connections for a user
        public static List<string> GetUserConnections(string userId)
        {
            return _userConnections
                .Where(c => c.Value == userId)
                .Select(c => c.Key)
                .ToList();
        }
    }
}
