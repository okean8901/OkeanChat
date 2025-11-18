namespace OkeanChat.Models
{
    public class CallRoom
    {
        public string RoomId { get; set; } = string.Empty;
        public string RoomName { get; set; } = string.Empty;
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;
        public List<RoomUser> Users { get; set; } = new List<RoomUser>();
    }

    public class RoomUser
    {
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Avatar { get; set; } = string.Empty;
        public string ConnectionId { get; set; } = string.Empty;
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
        public bool IsVideoEnabled { get; set; } = true;
        public bool IsAudioEnabled { get; set; } = true;
    }
}

