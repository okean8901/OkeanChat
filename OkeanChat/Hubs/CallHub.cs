using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Identity;
using OkeanChat.Models;
using OkeanChat.Services;
using System.Collections.Concurrent;

namespace OkeanChat.Hubs
{
    [Authorize]
    public class CallHub : Hub
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly OnlineUserService _onlineUserService;
        
        // Store room information: RoomId -> CallRoom
        private static readonly ConcurrentDictionary<string, CallRoom> _rooms = new();
        
        // Store user's current room: UserId -> RoomId
        private static readonly ConcurrentDictionary<string, string> _userRooms = new();

        public CallHub(UserManager<ApplicationUser> userManager, OnlineUserService onlineUserService)
        {
            _userManager = userManager;
            _onlineUserService = onlineUserService;
        }

        public override async Task OnConnectedAsync()
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user != null)
            {
                _onlineUserService.AddConnection(user.Id, Context.ConnectionId);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var user = await _userManager.GetUserAsync(Context.User);
            if (user != null)
            {
                _onlineUserService.RemoveConnection(user.Id, Context.ConnectionId);
                
                // Leave room if user is in one
                if (_userRooms.TryGetValue(user.Id, out var roomId))
                {
                    await LeaveRoom(roomId, user.Id);
                }
            }
            await base.OnDisconnectedAsync(exception);
        }

        // Join a room
        public async Task JoinRoom(string roomId, string userId)
        {
            try
            {
                var currentUser = await _userManager.GetUserAsync(Context.User);
                if (currentUser == null || currentUser.Id != userId)
                {
                    await Clients.Caller.SendAsync("Error", "Unauthorized");
                    return;
                }

                // Get or create room
                var room = _rooms.GetOrAdd(roomId, new CallRoom
                {
                    RoomId = roomId,
                    RoomName = $"Room {roomId}",
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                });

                // Check if user is already in another room
                if (_userRooms.TryGetValue(userId, out var existingRoomId) && existingRoomId != roomId)
                {
                    await LeaveRoom(existingRoomId, userId);
                }

                // Add user to room
                var roomUser = new RoomUser
                {
                    UserId = userId,
                    UserName = currentUser.UserName ?? string.Empty,
                    DisplayName = currentUser.DisplayName ?? currentUser.UserName ?? string.Empty,
                    Avatar = currentUser.Avatar ?? string.Empty,
                    ConnectionId = Context.ConnectionId,
                    JoinedAt = DateTime.UtcNow,
                    IsVideoEnabled = true,
                    IsAudioEnabled = true
                };

                // Thread-safe add user to room
                lock (room.Users)
                {
                    var existingUser = room.Users.FirstOrDefault(u => u.UserId == userId);
                    if (existingUser != null)
                    {
                        existingUser.ConnectionId = Context.ConnectionId;
                    }
                    else
                    {
                        room.Users.Add(roomUser);
                    }
                }

                // Track user's room
                _userRooms.AddOrUpdate(userId, roomId, (key, oldValue) => roomId);

                // Join SignalR group
                await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

                // Get list of existing users in room (excluding current user)
                var otherUsers = room.Users
                    .Where(u => u.UserId != userId)
                    .Select(u => new
                    {
                        u.UserId,
                        u.UserName,
                        u.DisplayName,
                        u.Avatar,
                        u.ConnectionId,
                        u.IsVideoEnabled,
                        u.IsAudioEnabled
                    })
                    .ToList();

                // Notify caller about existing users
                await Clients.Caller.SendAsync("JoinedRoom", new
                {
                    RoomId = roomId,
                    Users = otherUsers
                });

                // Notify other users in room about new user
                await Clients.Group(roomId).SendAsync("UserJoined", new
                {
                    UserId = userId,
                    UserName = roomUser.UserName,
                    DisplayName = roomUser.DisplayName,
                    Avatar = roomUser.Avatar,
                    ConnectionId = Context.ConnectionId,
                    IsVideoEnabled = roomUser.IsVideoEnabled,
                    IsAudioEnabled = roomUser.IsAudioEnabled
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in JoinRoom: {ex.Message}\n{ex.StackTrace}");
                await Clients.Caller.SendAsync("Error", "Failed to join room");
            }
        }

        // Leave a room
        public async Task LeaveRoom(string roomId, string userId)
        {
            try
            {
                var currentUser = await _userManager.GetUserAsync(Context.User);
                if (currentUser == null || currentUser.Id != userId)
                {
                    return;
                }

                if (_rooms.TryGetValue(roomId, out var room))
                {
                    // Remove user from room
                    lock (room.Users)
                    {
                        room.Users.RemoveAll(u => u.UserId == userId);
                    }

                    // Remove user's room tracking
                    _userRooms.TryRemove(userId, out _);

                    // Leave SignalR group
                    await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);

                    // Notify other users in room
                    await Clients.Group(roomId).SendAsync("UserLeft", new
                    {
                        UserId = userId
                    });

                    // Clean up empty room
                    if (room.Users.Count == 0)
                    {
                        _rooms.TryRemove(roomId, out _);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in LeaveRoom: {ex.Message}\n{ex.StackTrace}");
            }
        }

        // Send WebRTC offer
        public async Task SendOffer(string targetUserId, string offer, string fromUserId)
        {
            try
            {
                var currentUser = await _userManager.GetUserAsync(Context.User);
                if (currentUser == null || currentUser.Id != fromUserId)
                {
                    await Clients.Caller.SendAsync("Error", "Unauthorized");
                    return;
                }

                // Get target user's connections
                var targetConnections = _onlineUserService.GetUserConnections(targetUserId);
                if (targetConnections != null && targetConnections.Count > 0)
                {
                    var fromUserInfo = new
                    {
                        UserId = fromUserId,
                        UserName = currentUser.UserName ?? string.Empty,
                        DisplayName = currentUser.DisplayName ?? currentUser.UserName ?? string.Empty
                    };

                    foreach (var connectionId in targetConnections)
                    {
                        await Clients.Client(connectionId).SendAsync("ReceiveOffer", fromUserInfo, offer);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in SendOffer: {ex.Message}\n{ex.StackTrace}");
            }
        }

        // Send WebRTC answer
        public async Task SendAnswer(string targetUserId, string answer, string fromUserId)
        {
            try
            {
                var currentUser = await _userManager.GetUserAsync(Context.User);
                if (currentUser == null || currentUser.Id != fromUserId)
                {
                    await Clients.Caller.SendAsync("Error", "Unauthorized");
                    return;
                }

                // Get target user's connections
                var targetConnections = _onlineUserService.GetUserConnections(targetUserId);
                if (targetConnections != null && targetConnections.Count > 0)
                {
                    var fromUserInfo = new
                    {
                        UserId = fromUserId,
                        UserName = currentUser.UserName ?? string.Empty,
                        DisplayName = currentUser.DisplayName ?? currentUser.UserName ?? string.Empty
                    };

                    foreach (var connectionId in targetConnections)
                    {
                        await Clients.Client(connectionId).SendAsync("ReceiveAnswer", fromUserInfo, answer);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in SendAnswer: {ex.Message}\n{ex.StackTrace}");
            }
        }

        // Send ICE candidate
        public async Task SendIceCandidate(string targetUserId, string candidate, string fromUserId)
        {
            try
            {
                var currentUser = await _userManager.GetUserAsync(Context.User);
                if (currentUser == null || currentUser.Id != fromUserId)
                {
                    return; // Silently ignore unauthorized
                }

                // Get target user's connections
                var targetConnections = _onlineUserService.GetUserConnections(targetUserId);
                if (targetConnections != null && targetConnections.Count > 0)
                {
                    var fromUserInfo = new
                    {
                        UserId = fromUserId,
                        UserName = currentUser.UserName ?? string.Empty,
                        DisplayName = currentUser.DisplayName ?? currentUser.UserName ?? string.Empty
                    };

                    foreach (var connectionId in targetConnections)
                    {
                        await Clients.Client(connectionId).SendAsync("ReceiveIceCandidate", fromUserInfo, candidate);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in SendIceCandidate: {ex.Message}\n{ex.StackTrace}");
            }
        }

        // Get room users
        public async Task GetRoomUsers(string roomId)
        {
            try
            {
                var currentUser = await _userManager.GetUserAsync(Context.User);
                if (currentUser == null)
                {
                    return;
                }

                if (_rooms.TryGetValue(roomId, out var room))
                {
                    var users = room.Users
                        .Select(u => new
                        {
                            u.UserId,
                            u.UserName,
                            u.DisplayName,
                            u.Avatar,
                            u.ConnectionId,
                            u.IsVideoEnabled,
                            u.IsAudioEnabled
                        })
                        .ToList();

                    await Clients.Caller.SendAsync("RoomUsers", users);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetRoomUsers: {ex.Message}\n{ex.StackTrace}");
            }
        }
    }
}

