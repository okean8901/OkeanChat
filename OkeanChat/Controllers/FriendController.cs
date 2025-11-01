using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using OkeanChat.Data;
using OkeanChat.Models;
using Microsoft.EntityFrameworkCore;

namespace OkeanChat.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FriendController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public FriendController(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchUsers(string username)
        {
            if (string.IsNullOrWhiteSpace(username) || username.Length < 3)
            {
                return BadRequest(new { message = "Username must be at least 3 characters" });
            }

            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null)
            {
                return Unauthorized();
            }

            var users = await _userManager.Users
                .Where(u => u.UserName != null && u.UserName.Contains(username) && u.Id != currentUser.Id)
                .Select(u => new
                {
                    Id = u.Id,
                    UserName = u.UserName,
                    DisplayName = u.DisplayName ?? u.UserName,
                    Avatar = u.Avatar
                })
                .Take(10)
                .ToListAsync();

            // Get friendship status for each user
            var userIds = users.Select(u => u.Id).ToList();
            var friendships = await _context.Friendships
                .Where(f => 
                    (f.RequesterId == currentUser.Id && userIds.Contains(f.AddresseeId)) ||
                    (f.AddresseeId == currentUser.Id && userIds.Contains(f.RequesterId)))
                .ToListAsync();

            var result = users.Select(u => new
            {
                u.Id,
                u.UserName,
                u.DisplayName,
                u.Avatar,
                FriendshipStatus = GetFriendshipStatus(currentUser.Id, u.Id, friendships)
            }).ToList();

            return Ok(result);
        }

        private object? GetFriendshipStatus(string currentUserId, string targetUserId, List<Friendship> friendships)
        {
            var friendship = friendships.FirstOrDefault(f =>
                (f.RequesterId == currentUserId && f.AddresseeId == targetUserId) ||
                (f.RequesterId == targetUserId && f.AddresseeId == currentUserId));

            if (friendship == null)
                return null;

            return new
            {
                Status = friendship.Status.ToString(),
                FriendshipId = friendship.Id,
                IsRequester = friendship.RequesterId == currentUserId
            };
        }

        [HttpPost("request")]
        public async Task<IActionResult> SendFriendRequest([FromBody] FriendRequestModel model)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null)
            {
                return Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(model.UserId))
            {
                return BadRequest(new { message = "User ID is required" });
            }

            if (model.UserId == currentUser.Id)
            {
                return BadRequest(new { message = "Cannot send friend request to yourself" });
            }

            var targetUser = await _userManager.FindByIdAsync(model.UserId);
            if (targetUser == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Check if friendship already exists
            var existingFriendship = await _context.Friendships
                .FirstOrDefaultAsync(f => 
                    (f.RequesterId == currentUser.Id && f.AddresseeId == model.UserId) ||
                    (f.RequesterId == model.UserId && f.AddresseeId == currentUser.Id));

            if (existingFriendship != null)
            {
                if (existingFriendship.Status == FriendshipStatus.Accepted)
                {
                    return BadRequest(new { message = "Already friends" });
                }
                if (existingFriendship.Status == FriendshipStatus.Pending)
                {
                    return BadRequest(new { message = "Friend request already pending" });
                }
                if (existingFriendship.Status == FriendshipStatus.Blocked)
                {
                    return BadRequest(new { message = "Cannot send friend request" });
                }
            }

            var friendship = new Friendship
            {
                RequesterId = currentUser.Id,
                AddresseeId = model.UserId,
                Status = FriendshipStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _context.Friendships.Add(friendship);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Friend request sent", friendshipId = friendship.Id });
        }

        [HttpPost("accept")]
        public async Task<IActionResult> AcceptFriendRequest([FromBody] FriendRequestModel model)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null)
            {
                return Unauthorized();
            }

            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => f.Id == model.FriendshipId && 
                                          f.AddresseeId == currentUser.Id && 
                                          f.Status == FriendshipStatus.Pending);

            if (friendship == null)
            {
                return NotFound(new { message = "Friend request not found" });
            }

            friendship.Status = FriendshipStatus.Accepted;
            friendship.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Friend request accepted" });
        }

        [HttpPost("reject")]
        public async Task<IActionResult> RejectFriendRequest([FromBody] FriendRequestModel model)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null)
            {
                return Unauthorized();
            }

            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => f.Id == model.FriendshipId && 
                                          f.AddresseeId == currentUser.Id && 
                                          f.Status == FriendshipStatus.Pending);

            if (friendship == null)
            {
                return NotFound(new { message = "Friend request not found" });
            }

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Friend request rejected" });
        }

        [HttpGet("list")]
        public async Task<IActionResult> GetFriends()
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null)
            {
                return Unauthorized();
            }

            var friendships = await _context.Friendships
                .Include(f => f.Requester)
                .Include(f => f.Addressee)
                .Where(f => (f.RequesterId == currentUser.Id || f.AddresseeId == currentUser.Id) &&
                           f.Status == FriendshipStatus.Accepted)
                .Select(f => new
                {
                    FriendshipId = f.Id,
                    Friend = f.RequesterId == currentUser.Id 
                        ? new
                        {
                            Id = f.Addressee.Id,
                            UserName = f.Addressee.UserName,
                            DisplayName = f.Addressee.DisplayName ?? f.Addressee.UserName,
                            Avatar = f.Addressee.Avatar
                        }
                        : new
                        {
                            Id = f.Requester.Id,
                            UserName = f.Requester.UserName,
                            DisplayName = f.Requester.DisplayName ?? f.Requester.UserName,
                            Avatar = f.Requester.Avatar
                        }
                })
                .ToListAsync();

            return Ok(friendships);
        }

        [HttpGet("requests")]
        public async Task<IActionResult> GetFriendRequests()
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null)
            {
                return Unauthorized();
            }

            var pendingRequests = await _context.Friendships
                .Include(f => f.Requester)
                .Where(f => f.AddresseeId == currentUser.Id && f.Status == FriendshipStatus.Pending)
                .Select(f => new
                {
                    FriendshipId = f.Id,
                    Requester = new
                    {
                        Id = f.Requester.Id,
                        UserName = f.Requester.UserName,
                        DisplayName = f.Requester.DisplayName ?? f.Requester.UserName,
                        Avatar = f.Requester.Avatar
                    },
                    CreatedAt = f.CreatedAt
                })
                .ToListAsync();

            return Ok(pendingRequests);
        }

        [HttpPost("cancel")]
        public async Task<IActionResult> CancelFriendRequest([FromBody] FriendRequestModel model)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null)
            {
                return Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(model.UserId))
            {
                return BadRequest(new { message = "User ID is required" });
            }

            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => f.RequesterId == currentUser.Id &&
                                          f.AddresseeId == model.UserId &&
                                          f.Status == FriendshipStatus.Pending);

            if (friendship == null)
            {
                return NotFound(new { message = "Friend request not found" });
            }

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Friend request cancelled" });
        }

        [HttpPost("remove")]
        public async Task<IActionResult> RemoveFriend([FromBody] FriendRequestModel model)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null)
            {
                return Unauthorized();
            }

            var friendship = await _context.Friendships
                .FirstOrDefaultAsync(f => f.Id == model.FriendshipId &&
                                          (f.RequesterId == currentUser.Id || f.AddresseeId == currentUser.Id) &&
                                          f.Status == FriendshipStatus.Accepted);

            if (friendship == null)
            {
                return NotFound(new { message = "Friendship not found" });
            }

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Friend removed" });
        }
    }

    public class FriendRequestModel
    {
        public string? UserId { get; set; }
        public int? FriendshipId { get; set; }
    }
}
