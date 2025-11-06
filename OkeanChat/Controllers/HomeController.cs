using Microsoft.AspNetCore.Mvc;
using OkeanChat.Data;
using Microsoft.EntityFrameworkCore;
using OkeanChat.Models;
using Microsoft.AspNetCore.Authorization;

namespace OkeanChat.Controllers
{
    public class HomeController : Controller
    {
        private readonly ApplicationDbContext _context;

        public HomeController(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IActionResult> Index()
        {
            // If user is not authenticated, show landing page
            if (!User.Identity?.IsAuthenticated ?? true)
            {
                return View("Landing");
            }

            // If authenticated, show the chat interface
            var channels = await _context.Channels
                .Where(c => c.IsActive)
                .OrderBy(c => c.Name)
                .ToListAsync();

            ViewBag.Channels = channels;
            return View("ChatInterface");
        }

        public IActionResult Landing()
        {
            return View();
        }

        [Authorize]
        public async Task<IActionResult> Chat(int channelId = 1)
        {
            var channel = await _context.Channels.FindAsync(channelId);
            if (channel == null)
            {
                return NotFound();
            }

            var messages = await _context.Messages
                .Include(m => m.User)
                .Where(m => m.ChannelId == channelId)
                .OrderBy(m => m.CreatedAt)
                .Take(50)
                .ToListAsync();

            var channels = await _context.Channels
                .Where(c => c.IsActive)
                .OrderBy(c => c.Name)
                .ToListAsync();

            ViewBag.CurrentChannel = channel;
            ViewBag.Channels = channels;
            ViewBag.Messages = messages;

            return View();
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateChannel(string name, string description)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return Json(new { success = false, message = "Channel name is required" });
            }

            var existingChannel = await _context.Channels
                .FirstOrDefaultAsync(c => c.Name.ToLower() == name.ToLower());

            if (existingChannel != null)
            {
                return Json(new { success = false, message = "Channel already exists" });
            }

            var channel = new Channel
            {
                Name = name.ToLower(),
                Description = description,
                CreatedAt = DateTime.UtcNow
            };

            _context.Channels.Add(channel);
            await _context.SaveChangesAsync();

            return Json(new { success = true, channelId = channel.Id });
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = HttpContext.TraceIdentifier });
        }
    }
}
