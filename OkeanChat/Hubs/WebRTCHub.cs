using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Identity;
using OkeanChat.Models;

namespace OkeanChat.Hubs
{
    [Authorize]
    public class WebRTCHub : Hub
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private static readonly Dictionary<string, string> _userConnections = new();

        public WebRTCHub(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        public override async Task OnConnectedAsync()
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user != null)
            {
                _userConnections[Context.ConnectionId] = user.Id;
                await Clients.All.SendAsync("UserOnline", user.Id, user.DisplayName ?? user.UserName);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (_userConnections.TryGetValue(Context.ConnectionId, out var userId))
            {
                _userConnections.Remove(Context.ConnectionId);
                await Clients.All.SendAsync("UserOffline", userId);
            }
            await base.OnDisconnectedAsync(exception);
        }

        // Gửi offer cho cuộc gọi
        public async Task SendOffer(string targetUserId, string offer)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller != null)
            {
                await Clients.User(targetUserId).SendAsync("ReceiveOffer", caller.Id, offer);
            }
        }

        // Gửi answer cho cuộc gọi
        public async Task SendAnswer(string targetUserId, string answer)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller != null)
            {
                await Clients.User(targetUserId).SendAsync("ReceiveAnswer", caller.Id, answer);
            }
        }

        // Gửi ICE candidate
        public async Task SendIceCandidate(string targetUserId, string candidate)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller != null)
            {
                await Clients.User(targetUserId).SendAsync("ReceiveIceCandidate", caller.Id, candidate);
            }
        }

        // Từ chối cuộc gọi
        public async Task RejectCall(string targetUserId)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller != null)
            {
                await Clients.User(targetUserId).SendAsync("CallRejected", caller.Id);
            }
        }

        // Kết thúc cuộc gọi
        public async Task EndCall(string targetUserId)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller != null)
            {
                await Clients.User(targetUserId).SendAsync("CallEnded", caller.Id);
            }
        }

        // Gửi thông báo cuộc gọi đến
        public async Task SendCallNotification(string targetUserId, string callType)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller != null)
            {
                await Clients.User(targetUserId).SendAsync("IncomingCall", caller.Id, caller.DisplayName ?? caller.UserName, callType);
            }
        }

        // Lấy danh sách user online
        public async Task GetOnlineUsers()
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller != null)
            {
                var onlineUsers = _userConnections.Values
                    .Where(userId => userId != caller.Id)
                    .ToList();

                var users = new List<object>();
                foreach (var userId in onlineUsers)
                {
                    var user = await _userManager.FindByIdAsync(userId);
                    if (user != null)
                    {
                        users.Add(new
                        {
                            Id = user.Id,
                            UserName = user.UserName,
                            DisplayName = user.DisplayName ?? user.UserName,
                            Avatar = user.Avatar
                        });
                    }
                }

                await Clients.Caller.SendAsync("OnlineUsers", users);
            }
        }
    }
}
