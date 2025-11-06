using System.Collections.Concurrent;

namespace OkeanChat.Services
{
    public class OnlineUserService
    {
        // Thread-safe dictionary to track online users: UserId -> Set of ConnectionIds
        private readonly ConcurrentDictionary<string, HashSet<string>> _onlineUsers = new();

        public void AddConnection(string userId, string connectionId)
        {
            _onlineUsers.AddOrUpdate(
                userId,
                new HashSet<string> { connectionId },
                (key, existingSet) =>
                {
                    existingSet.Add(connectionId);
                    return existingSet;
                });
        }

        public void RemoveConnection(string userId, string connectionId)
        {
            if (_onlineUsers.TryGetValue(userId, out var connections))
            {
                connections.Remove(connectionId);
                if (connections.Count == 0)
                {
                    _onlineUsers.TryRemove(userId, out _);
                }
            }
        }

        public bool IsUserOnline(string userId)
        {
            return _onlineUsers.ContainsKey(userId) && _onlineUsers[userId].Count > 0;
        }

        public HashSet<string> GetUserConnections(string userId)
        {
            return _onlineUsers.TryGetValue(userId, out var connections) ? connections : new HashSet<string>();
        }

        public List<string> GetAllOnlineUserIds()
        {
            return _onlineUsers.Keys.ToList();
        }

        public int GetOnlineCount()
        {
            return _onlineUsers.Count;
        }
    }
}

