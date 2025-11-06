
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
                    var unreadCount = await _context.PrivateMessages
                        .CountAsync(m => m.ReceiverId == user.Id && !m.IsRead);

                    await Clients.Caller.SendAsync("ReceiveUnreadMessageCount", unreadCount);
                }
            }
            await base.OnConnectedAsync();
        }
    }
}
