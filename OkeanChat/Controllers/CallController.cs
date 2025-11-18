using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using OkeanChat.Models;

namespace OkeanChat.Controllers
{
    [Authorize]
    public class CallController : Controller
    {
        private readonly UserManager<ApplicationUser> _userManager;

        public CallController(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        // Start a new call (create room)
        [HttpPost]
        public async Task<IActionResult> StartCall([FromBody] StartCallRequest request)
        {
            try
            {
                var currentUser = await _userManager.GetUserAsync(User);
                if (currentUser == null)
                {
                    return Unauthorized();
                }

                // Generate room ID
                var roomId = request.RoomId ?? Guid.NewGuid().ToString();

                return Ok(new
                {
                    Success = true,
                    RoomId = roomId,
                    Message = "Room created successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    Success = false,
                    Message = "Failed to create room",
                    Error = ex.Message
                });
            }
        }

        // Join a room
        [HttpPost]
        public async Task<IActionResult> JoinRoom([FromBody] JoinRoomRequest request)
        {
            try
            {
                var currentUser = await _userManager.GetUserAsync(User);
                if (currentUser == null)
                {
                    return Unauthorized();
                }

                if (string.IsNullOrEmpty(request.RoomId))
                {
                    return BadRequest(new { Success = false, Message = "Room ID is required" });
                }

                return Ok(new
                {
                    Success = true,
                    RoomId = request.RoomId,
                    Message = "Ready to join room"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    Success = false,
                    Message = "Failed to join room",
                    Error = ex.Message
                });
            }
        }

        // Leave a room
        [HttpPost]
        public async Task<IActionResult> LeaveRoom([FromBody] LeaveRoomRequest request)
        {
            try
            {
                var currentUser = await _userManager.GetUserAsync(User);
                if (currentUser == null)
                {
                    return Unauthorized();
                }

                return Ok(new
                {
                    Success = true,
                    Message = "Left room successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    Success = false,
                    Message = "Failed to leave room",
                    Error = ex.Message
                });
            }
        }

        // Call page
        public async Task<IActionResult> Index(string? roomId = null)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser == null)
            {
                return RedirectToAction("Login", "Account");
            }

            // Generate room ID if not provided
            if (string.IsNullOrEmpty(roomId))
            {
                roomId = Guid.NewGuid().ToString();
            }

            ViewBag.RoomId = roomId;
            ViewBag.UserId = currentUser.Id;
            ViewBag.UserName = currentUser.DisplayName ?? currentUser.UserName ?? "User";
            ViewBag.Avatar = currentUser.Avatar ?? string.Empty;

            return View();
        }
    }

    // Request models
    public class StartCallRequest
    {
        public string? RoomId { get; set; }
        public string CallType { get; set; } = "video"; // video or audio
    }

    public class JoinRoomRequest
    {
        public string RoomId { get; set; } = string.Empty;
    }

    public class LeaveRoomRequest
    {
        public string RoomId { get; set; } = string.Empty;
    }
}

