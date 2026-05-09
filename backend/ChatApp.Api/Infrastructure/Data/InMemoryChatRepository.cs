using System.Collections.Concurrent;
using ChatApp.Api.Core.Interfaces;
using ChatApp.Api.Core.Models;

namespace ChatApp.Api.Infrastructure.Data;

public class InMemoryChatRepository : IChatRepository
{
    private readonly ConcurrentDictionary<string, ChatRoom> _rooms = new();
    private readonly ConcurrentDictionary<string, List<ChatMessage>> _messages = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, string>> _roomKeys = new();

    public void SaveRoomKey(string roomId, string userId, string encryptedKey)
    {
        var keys = _roomKeys.GetOrAdd(roomId, _ => new ConcurrentDictionary<string, string>());
        keys[userId] = encryptedKey;
    }

    public string? GetRoomKey(string roomId, string userId)
    {
        if (_roomKeys.TryGetValue(roomId, out var keys) && keys.TryGetValue(userId, out var key))
            return key;
        return null;
    }

    public void SaveRoom(ChatRoom room)
    {
        _rooms[room.Id] = room;
        _messages.TryAdd(room.Id, new List<ChatMessage>());
    }

    public ChatRoom? GetRoom(string roomId) =>
        _rooms.GetValueOrDefault(roomId);

    public IReadOnlyList<ChatRoom> GetRoomsByUser(string userId) =>
        _rooms.Values.Where(r => r.Members.Contains(userId)).ToList();

    public void SaveMessage(ChatMessage message)
    {
        var roomMessages = _messages.GetOrAdd(message.RoomId, _ => new List<ChatMessage>());
        lock (roomMessages)
        {
            roomMessages.Add(message);
        }
    }

    public IReadOnlyList<ChatMessage> GetMessages(string roomId)
    {
        if (_messages.TryGetValue(roomId, out var roomMessages))
        {
            lock (roomMessages)
            {
                return roomMessages.ToList();
            }
        }
        return Array.Empty<ChatMessage>();
    }

    public void AddMemberToRoom(string roomId, string userId)
    {
        _rooms.AddOrUpdate(roomId, 
            _ => throw new KeyNotFoundException($"Room {roomId} not found"),
            (_, room) => room.Members.Contains(userId) 
                ? room 
                : room with { Members = [..room.Members, userId] }
        );
    }
}
