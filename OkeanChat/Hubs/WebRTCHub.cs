using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Identity;
using OkeanChat.Models;
using OkeanChat.Services;
using OkeanChat.Data;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Collections.Concurrent;

namespace OkeanChat.Hubs
{
    [Authorize]
    public class WebRTCHub : Hub
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly OnlineUserService _onlineUserService;
        private readonly ApplicationDbContext _context;
        // Thread-safe dictionaries for concurrent access
        private static readonly ConcurrentDictionary<string, string> _activeCalls = new(); // CallerId -> TargetUserId
        private static readonly ConcurrentDictionary<string, string> _callConnections = new(); // ConnectionId -> CallId
        private static readonly ConcurrentDictionary<string, string> _callTypes = new(); // CallId -> CallType (audio/video)

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
                
                // Clean up connection mappings
                _callConnections.TryRemove(Context.ConnectionId, out _);
                
                // End any active calls where user is the caller
                if (_activeCalls.TryRemove(user.Id, out var targetUserId))
                {
                    var callerInfo = new
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        DisplayName = user.DisplayName ?? user.UserName,
                        Avatar = user.Avatar
                    };
                    
                    var targetConnections = _onlineUserService.GetUserConnections(targetUserId);
                    foreach (var connectionId in targetConnections)
                    {
                        await Clients.Client(connectionId).SendAsync("CallEnded", callerInfo);
                    }
                    
                    // Clean up call type
                    var callId = $"{user.Id}_{targetUserId}";
                    _callTypes.TryRemove(callId, out _);
                }
                
                // Remove from active calls if user is being called
                var callingUserEntry = _activeCalls.FirstOrDefault(x => x.Value == user.Id);
                if (!string.IsNullOrEmpty(callingUserEntry.Key))
                {
                    if (_activeCalls.TryRemove(callingUserEntry.Key, out _))
                    {
                        var callerInfo = new
                        {
                            Id = callingUserEntry.Key,
                            UserName = "User",
                            DisplayName = "User",
                            Avatar = (string?)null
                        };
                        
                        var callerConnections = _onlineUserService.GetUserConnections(callingUserEntry.Key);
                        foreach (var connectionId in callerConnections)
                        {
                            await Clients.Client(connectionId).SendAsync("CallEnded", callerInfo);
                        }
                        
                        // Clean up call type
                        var callId = $"{callingUserEntry.Key}_{user.Id}";
                        _callTypes.TryRemove(callId, out _);
                    }
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

            // Validate call type
            if (callType != "audio" && callType != "video")
            {
                await Clients.Caller.SendAsync("CallError", "Invalid call type");
                return;
            }

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

            // Check if target is already in a call (as caller or receiver)
            if (_activeCalls.ContainsKey(targetUserId) || _activeCalls.Values.Contains(targetUserId))
            {
                await Clients.Caller.SendAsync("CallError", "User is busy");
                return;
            }

            // Register the call
            var callId = $"{caller.Id}_{targetUserId}";
            if (_activeCalls.TryAdd(caller.Id, targetUserId))
            {
                _callConnections.TryAdd(Context.ConnectionId, callId);
                _callTypes.TryAdd(callId, callType);

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
            else
            {
                await Clients.Caller.SendAsync("CallError", "Failed to initiate call. Please try again.");
            }
        }

        // Gửi offer cho cuộc gọi
        public async Task SendOffer(string targetUserId, string offer)
        {
            var caller = await _userManager.GetUserAsync(Context.User);
            if (caller == null) return;

            // Verify call is active
            if (!_activeCalls.TryGetValue(caller.Id, out var targetId) || targetId != targetUserId)
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
            var sender = await _userManager.GetUserAsync(Context.User);
            if (sender == null) return;

            // Determine who is the actual target (the other party in the call)
            string? actualTargetId = null;

            // Check if sender is the caller
            if (_activeCalls.TryGetValue(sender.Id, out var calledUserId) && calledUserId == targetUserId)
            {
                actualTargetId = targetUserId;
            }
            // Check if sender is the receiver (targetUserId is the caller)
            else if (_activeCalls.TryGetValue(targetUserId, out var receiverId) && receiverId == sender.Id)
            {
                actualTargetId = targetUserId;
            }

            if (actualTargetId == null)
            {
                await Clients.Caller.SendAsync("CallError", "Call not found");
                return;
            }

            var senderInfo = new
            {
                Id = sender.Id,
                UserName = sender.UserName,
                DisplayName = sender.DisplayName ?? sender.UserName,
                Avatar = sender.Avatar
            };

            var targetConnections = _onlineUserService.GetUserConnections(actualTargetId);
            if (targetConnections.Any())
            {
                foreach (var connectionId in targetConnections)
                {
                    await Clients.Client(connectionId).SendAsync("ReceiveAnswer", senderInfo, answer);
                }
            }
        }

        // Gửi ICE candidate
        public async Task SendIceCandidate(string targetUserId, string candidate)
        {
            var sender = await _userManager.GetUserAsync(Context.User);
            if (sender == null) return;

            // Determine who is the actual target (the other party in the call)
            string? actualTargetId = null;

            // Check if sender is the caller
            if (_activeCalls.TryGetValue(sender.Id, out var calledUserId) && calledUserId == targetUserId)
            {
                actualTargetId = targetUserId;
            }
            // Check if sender is the receiver (targetUserId is the caller)
            else if (_activeCalls.TryGetValue(targetUserId, out var receiverId) && receiverId == sender.Id)
            {
                actualTargetId = targetUserId;
            }

            if (actualTargetId == null)
            {
                return; // Silently ignore if call not active
            }

            var senderInfo = new
            {
                Id = sender.Id,
                UserName = sender.UserName,
                DisplayName = sender.DisplayName ?? sender.UserName,
                Avatar = sender.Avatar
            };

            var targetConnections = _onlineUserService.GetUserConnections(actualTargetId);
            if (targetConnections.Any())
            {
                foreach (var connectionId in targetConnections)
                {
                    await Clients.Client(connectionId).SendAsync("ReceiveIceCandidate", senderInfo, candidate);
                }
            }
        }

        // Chấp nhận cuộc gọi
        public async Task AcceptCall(string callerId)
        {
            try
            {
                // Validate input
                if (string.IsNullOrEmpty(callerId))
                {
                    await Clients.Caller.SendAsync("CallError", "Invalid caller ID");
                    return;
                }

                var receiver = await _userManager.GetUserAsync(Context.User);
                if (receiver == null)
                {
                    await Clients.Caller.SendAsync("CallError", "User not found");
                    return;
                }

                // Verify call is active
                if (!_activeCalls.TryGetValue(callerId, out var receiverId) || receiverId != receiver.Id)
                {
                    await Clients.Caller.SendAsync("CallError", "Call not found");
                    return;
                }

                var receiverInfo = new
                {
                    Id = receiver.Id,
                    UserName = receiver.UserName ?? string.Empty,
                    DisplayName = receiver.DisplayName ?? receiver.UserName ?? string.Empty,
                    Avatar = receiver.Avatar ?? string.Empty
                };

                // Notify caller that call is accepted
                var callerConnections = _onlineUserService.GetUserConnections(callerId);
                if (callerConnections != null && callerConnections.Count > 0)
                {
                    var tasks = new List<Task>();
                    foreach (var connectionId in callerConnections)
                    {
                        if (!string.IsNullOrEmpty(connectionId))
                        {
                            tasks.Add(SendToConnectionSafely(connectionId, "CallAccepted", receiverInfo));
                        }
                    }
                    
                    // Wait for all messages, but don't fail if some fail
                    if (tasks.Count > 0)
                    {
                        await Task.WhenAll(tasks.Select(t => t.ContinueWith(task => 
                        {
                            if (task.IsFaulted)
                            {
                                // Log but don't throw
                                Console.WriteLine($"Error sending CallAccepted: {task.Exception?.GetBaseException()?.Message}");
                            }
                        })));
                    }
                }
                else
                {
                    await Clients.Caller.SendAsync("CallError", "Caller is not connected");
                }
            }
            catch (Exception ex)
            {
                // Log error
                Console.WriteLine($"Error in AcceptCall: {ex.Message}\n{ex.StackTrace}");
                
                // Try to notify caller, but don't throw if this fails
                try
                {
                    await Clients.Caller.SendAsync("CallError", "An error occurred while accepting the call");
                }
                catch
                {
                    // Ignore if we can't send error message
                }
                
                // Don't re-throw - SignalR will handle it, but we've already notified the client
            }
        }

        // Helper method to safely send messages to a connection
        private async Task SendToConnectionSafely(string connectionId, string method, object data)
        {
            try
            {
                await Clients.Client(connectionId).SendAsync(method, data);
            }
            catch (Exception ex)
            {
                // Log but don't throw
                Console.WriteLine($"Error sending {method} to {connectionId}: {ex.Message}");
            }
        }

        // Từ chối cuộc gọi
        public async Task RejectCall(string callerId)
        {
            var receiver = await _userManager.GetUserAsync(Context.User);
            if (receiver == null) return;

            // Remove call from active calls
            if (_activeCalls.TryRemove(callerId, out var receiverId))
            {
                // Clean up call type
                var callId = $"{callerId}_{receiverId}";
                _callTypes.TryRemove(callId, out _);

                var receiverInfo = new
                {
                    Id = receiver.Id,
                    UserName = receiver.UserName,
                    DisplayName = receiver.DisplayName ?? receiver.UserName,
                    Avatar = receiver.Avatar
                };

                // Notify caller that call is rejected
                var callerConnections = _onlineUserService.GetUserConnections(callerId);
                foreach (var connectionId in callerConnections)
                {
                    await Clients.Client(connectionId).SendAsync("CallRejected", receiverInfo);
                }
            }
        }

        // Kết thúc cuộc gọi
        public async Task EndCall(string targetUserId)
        {
            var sender = await _userManager.GetUserAsync(Context.User);
            if (sender == null) return;

            // Remove call from active calls
            bool removed = false;
            string callId = null;

            // Check if sender is the caller
            if (_activeCalls.TryGetValue(sender.Id, out var calledUserId) && calledUserId == targetUserId)
            {
                if (_activeCalls.TryRemove(sender.Id, out _))
                {
                    callId = $"{sender.Id}_{targetUserId}";
                    removed = true;
                }
            }
            // Check if sender is the receiver
            else if (_activeCalls.TryGetValue(targetUserId, out var receiverId) && receiverId == sender.Id)
            {
                if (_activeCalls.TryRemove(targetUserId, out _))
                {
                    callId = $"{targetUserId}_{sender.Id}";
                    removed = true;
                }
            }

            if (removed)
            {
                // Clean up call type
                if (callId != null)
                {
                    _callTypes.TryRemove(callId, out _);
                }

                var senderInfo = new
                {
                    Id = sender.Id,
                    UserName = sender.UserName,
                    DisplayName = sender.DisplayName ?? sender.UserName,
                    Avatar = sender.Avatar
                };

                // Notify target that call ended
                var targetConnections = _onlineUserService.GetUserConnections(targetUserId);
                if (targetConnections.Any())
                {
                    foreach (var connectionId in targetConnections)
                    {
                        await Clients.Client(connectionId).SendAsync("CallEnded", senderInfo);
                    }
                }
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
