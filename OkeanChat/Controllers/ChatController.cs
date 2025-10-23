using Microsoft.AspNetCore.Mvc;
using OkeanChat.Data;
using Microsoft.EntityFrameworkCore;
using OkeanChat.Models;
using Microsoft.AspNetCore.Identity;

namespace OkeanChat.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public ChatController(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        [HttpGet("messages/{channelId}")]
        public async Task<IActionResult> GetMessages(int channelId, int page = 1, int pageSize = 50)
        {
            var messages = await _context.Messages
                .Include(m => m.User)
                .Where(m => m.ChannelId == channelId)
                .OrderByDescending(m => m.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(m => new ChatMessage
                {
                    Id = m.Id,
                    Content = m.Content,
                    Username = m.User.DisplayName ?? m.User.UserName,
                    Avatar = m.User.Avatar,
                    CreatedAt = m.CreatedAt,
                    IsEdited = m.IsEdited,
                    ChannelId = m.ChannelId
                })
                .ToListAsync();

            return Ok(messages.OrderBy(m => m.CreatedAt));
        }

        [HttpGet("channels")]
        public async Task<IActionResult> GetChannels()
        {
            var channels = await _context.Channels
                .Where(c => c.IsActive)
                .OrderBy(c => c.Name)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.Description,
                    c.CreatedAt,
                    MessageCount = c.Messages.Count
                })
                .ToListAsync();

            return Ok(channels);
        }

        [HttpPost("users")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username))
            {
                return BadRequest(new { message = "Username is required" });
            }

            var existingUser = await _userManager.FindByNameAsync(request.Username);

            if (existingUser != null)
            {
                return Ok(new { userId = existingUser.Id, username = existingUser.UserName });
            }

            var user = new ApplicationUser
            {
                UserName = request.Username,
                Email = $"{request.Username}@temp.com",
                Avatar = $"https://ui-avatars.com/api/?name={request.Username}&background=7289da&color=ffffff",
                CreatedAt = DateTime.UtcNow,
                LastSeen = DateTime.UtcNow
            };

            var result = await _userManager.CreateAsync(user);
            if (result.Succeeded)
            {
                return Ok(new { userId = user.Id, username = user.UserName });
            }

            return BadRequest(new { message = "Failed to create user" });
        }
    }

    public class CreateUserRequest
    {
        public string Username { get; set; } = string.Empty;
    }
}
