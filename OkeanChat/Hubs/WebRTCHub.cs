using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Identity;
using OkeanChat.Models;
using OkeanChat.Services;
using OkeanChat.Data;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace OkeanChat.Hubs
{
    [Authorize]
    public class WebRTCHub : Hub
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly OnlineUserService _onlineUserService;
        private readonly ApplicationDbContext _context;
        private static readonly Dictionary<string, string> _activeCalls = new(); // CallerId -> TargetUserId
        private static readonly Dictionary<string, string> _callConnections = new(); // ConnectionId -> CallId

        public WebRTCHub(UserManager<ApplicationUser> userManager, OnlineUserService onlineUserService, ApplicationDbContext context)
        {
            _userManager = userManager;
            _onlineUserService = onlineUserService;
            _context = context;
        }

        public override async Task OnConnectedAsync()
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user != null)
            {
                _onlineUserService.AddConnection(user.Id, Context.ConnectionId);
                await Clients.All.SendAsync("UserOnline", user.Id, user.DisplayName ?? user.UserName);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user != null)
            {
                _onlineUserService.RemoveConnection(user.Id, Context.ConnectionId);
                
                // End any active calls
                if (_activeCalls.ContainsKey(user.Id))
                {
                    var targetUserId = _activeCalls[user.Id];
                    _activeCalls.Remove(user.Id);
                    await Clients.User(targetUserId).SendAsync("CallEnded", user.Id);
                }
                
                // Remove from active calls if user is being called
                var callingUser = _activeCalls.FirstOrDefault(x => x.Value == user.Id);
                if (callingUser.Key != null)
                {
                    _activeCalls.Remove(callingUser.Key);
                    await Clients.User(callingUser.Key).SendAsync("CallEnded", user.Id);
                }
                
                await Clients.All.SendAsync("UserOffline", user.Id);
            }
            await base.OnDisconnectedAsync(exception);
        }

        // Gửi thông báo cuộc gọi đến (voice hoặc video)
        public async Task InitiateCall(string targetUserId, string callType)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller == null) return;

            // Check if users are friends
            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => 
                    ((f.RequesterId == caller.Id && f.AddresseeId == targetUserId) ||
                     (f.RequesterId == targetUserId && f.AddresseeId == caller.Id)) &&
                    f.Status == FriendshipStatus.Accepted);

            if (friendship == null)
            {
                await Clients.Caller.SendAsync("CallError", "You can only call your friends");
                return;
            }

            // Check if target is online
            if (!_onlineUserService.IsUserOnline(targetUserId))
            {
                await Clients.Caller.SendAsync("CallError", "User is offline");
                return;
            }

            // Check if caller already has an active call
            if (_activeCalls.ContainsKey(caller.Id))
            {
                await Clients.Caller.SendAsync("CallError", "You already have an active call");
                return;
            }

            // Check if target is already in a call
            if (_activeCalls.ContainsValue(targetUserId))
            {
                await Clients.Caller.SendAsync("CallError", "User is busy");
                return;
            }

            // Register the call
            _activeCalls[caller.Id] = targetUserId;
            _callConnections[Context.ConnectionId] = $"{caller.Id}_{targetUserId}";

            var callerInfo = new
            {
                Id = caller.Id,
                UserName = caller.UserName,
                DisplayName = caller.DisplayName ?? caller.UserName,
                Avatar = caller.Avatar
            };

            // Send notification to target
            var targetConnections = _onlineUserService.GetUserConnections(targetUserId);
            foreach (var connectionId in targetConnections)
            {
                await Clients.Client(connectionId).SendAsync("IncomingCall", callerInfo, callType);
            }

            // Notify caller that call is initiated
            await Clients.Caller.SendAsync("CallInitiated", targetUserId, callType);
        }

        // Gửi offer cho cuộc gọi
        public async Task SendOffer(string targetUserId, string offer)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller == null) return;

            // Verify call is active
            if (!_activeCalls.ContainsKey(caller.Id) || _activeCalls[caller.Id] != targetUserId)
            {
                await Clients.Caller.SendAsync("CallError", "Call not found");
                return;
            }

            var callerInfo = new
            {
                Id = caller.Id,
                UserName = caller.UserName,
                DisplayName = caller.DisplayName ?? caller.UserName,
                Avatar = caller.Avatar
            };

            var targetConnections = _onlineUserService.GetUserConnections(targetUserId);
            if (targetConnections.Any())
            {
                foreach (var connectionId in targetConnections)
                {
                    await Clients.Client(connectionId).SendAsync("ReceiveOffer", callerInfo, offer);
                }
            }
            else
            {
                await Clients.Caller.SendAsync("CallError", "User is not connected");
            }
        }

        // Gửi answer cho cuộc gọi
        public async Task SendAnswer(string targetUserId, string answer)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller == null) return;

            // Verify call is active (either caller or receiver can send answer)
            var isCaller = _activeCalls.ContainsKey(caller.Id) && _activeCalls[caller.Id] == targetUserId;
            var isReceiver = _activeCalls.ContainsKey(targetUserId) && _activeCalls[targetUserId] == caller.Id;

            if (!isCaller && !isReceiver)
            {
                await Clients.Caller.SendAsync("CallError", "Call not found");
                return;
            }

            var callerInfo = new
            {
                Id = caller.Id,
                UserName = caller.UserName,
                DisplayName = caller.DisplayName ?? caller.UserName,
                Avatar = caller.Avatar
            };

            var targetConnections = _onlineUserService.GetUserConnections(targetUserId);
            if (targetConnections.Any())
            {
                foreach (var connectionId in targetConnections)
                {
                    await Clients.Client(connectionId).SendAsync("ReceiveAnswer", callerInfo, answer);
                }
            }
        }

        // Gửi ICE candidate
        public async Task SendIceCandidate(string targetUserId, string candidate)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller == null) return;

            // Verify call is active
            var isCaller = _activeCalls.ContainsKey(caller.Id) && _activeCalls[caller.Id] == targetUserId;
            var isReceiver = _activeCalls.ContainsKey(targetUserId) && _activeCalls[targetUserId] == caller.Id;

            if (!isCaller && !isReceiver)
            {
                return; // Silently ignore if call not active
            }

            var callerInfo = new
            {
                Id = caller.Id,
                UserName = caller.UserName,
                DisplayName = caller.DisplayName ?? caller.UserName,
                Avatar = caller.Avatar
            };

            var targetConnections = _onlineUserService.GetUserConnections(targetUserId);
            if (targetConnections.Any())
            {
                foreach (var connectionId in targetConnections)
                {
                    await Clients.Client(connectionId).SendAsync("ReceiveIceCandidate", callerInfo, candidate);
                }
            }
        }

        // Chấp nhận cuộc gọi
        public async Task AcceptCall(string callerId)
        {
            var receiver = await _userManager.GetUserAsync(Context.User);
            if (receiver == null) return;

            // Verify call is active
            if (!_activeCalls.ContainsKey(callerId) || _activeCalls[callerId] != receiver.Id)
            {
                await Clients.Caller.SendAsync("CallError", "Call not found");
                return;
            }

            var receiverInfo = new
            {
                Id = receiver.Id,
                UserName = receiver.UserName,
                DisplayName = receiver.DisplayName ?? receiver.UserName
            };

            // Notify caller that call is accepted
            var callerConnections = _onlineUserService.GetUserConnections(callerId);
            foreach (var connectionId in callerConnections)
            {
                await Clients.Client(connectionId).SendAsync("CallAccepted", receiverInfo);
            }

            await Clients.Caller.SendAsync("CallAccepted", receiverInfo);
        }

        // Từ chối cuộc gọi
        public async Task RejectCall(string callerId)
        {
            var receiver = await _userManager.GetUserAsync(Context.User);
            if (receiver == null) return;

            // Remove call from active calls
            if (_activeCalls.ContainsKey(callerId))
            {
                _activeCalls.Remove(callerId);
            }

            var receiverInfo = new
            {
                Id = receiver.Id,
                UserName = receiver.UserName,
                DisplayName = receiver.DisplayName ?? receiver.UserName
            };

            // Notify caller that call is rejected
            var callerConnections = _onlineUserService.GetUserConnections(callerId);
            foreach (var connectionId in callerConnections)
            {
                await Clients.Client(connectionId).SendAsync("CallRejected", receiverInfo);
            }

            await Clients.Caller.SendAsync("CallRejected", receiverInfo);
        }

        // Kết thúc cuộc gọi
        public async Task EndCall(string targetUserId)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller == null) return;

            // Remove call from active calls
            bool removed = false;
            if (_activeCalls.ContainsKey(caller.Id) && _activeCalls[caller.Id] == targetUserId)
            {
                _activeCalls.Remove(caller.Id);
                removed = true;
            }
            else if (_activeCalls.ContainsKey(targetUserId) && _activeCalls[targetUserId] == caller.Id)
            {
                _activeCalls.Remove(targetUserId);
                removed = true;
            }

            if (removed)
            {
                var callerInfo = new
                {
                    Id = caller.Id,
                    UserName = caller.UserName,
                    DisplayName = caller.DisplayName ?? caller.UserName,
                    Avatar = caller.Avatar
                };

                // Notify target that call ended
                var targetConnections = _onlineUserService.GetUserConnections(targetUserId);
                if (targetConnections.Any())
                {
                    foreach (var connectionId in targetConnections)
                    {
                        await Clients.Client(connectionId).SendAsync("CallEnded", callerInfo);
                    }
                }

                await Clients.Caller.SendAsync("CallEnded", callerInfo);
            }
        }

        // Lấy danh sách user online
        public async Task GetOnlineUsers()
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller == null) return;

            var onlineUserIds = _onlineUserService.GetAllOnlineUserIds()
                .Where(userId => userId != caller.Id)
                .ToList();

            var users = new List<object>();
            foreach (var userId in onlineUserIds)
            {
                var user = await _userManager.FindByIdAsync(userId);
                if (user != null)
                {
                    // Check if users are friends
                    var friendship = await _context.Friendships
                        .FirstOrDefaultAsync(f => 
                            ((f.RequesterId == caller.Id && f.AddresseeId == userId) ||
                             (f.RequesterId == userId && f.AddresseeId == caller.Id)) &&
                            f.Status == FriendshipStatus.Accepted);

                    if (friendship != null)
                    {
                        users.Add(new
                        {
                            Id = user.Id,
                            UserName = user.UserName,
                            DisplayName = user.DisplayName ?? user.UserName,
                            Avatar = user.Avatar,
                            IsOnline = true
                        });
                    }
                }
            }

            await Clients.Caller.SendAsync("OnlineUsers", users);
        }
    }
}
