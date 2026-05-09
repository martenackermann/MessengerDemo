using ChatApp.Api.Core.Interfaces;
using ChatApp.Api.Core.Models;

namespace ChatApp.Api.Core.Services;

public class ChatService(IChatRepository repository) : IChatService
{
    public Task<ChatRoom> CreateRoomAsync(string roomId, string userId)
    {
        var existingRoom = repository.GetRoom(roomId);
        if (existingRoom != null)
        {
            throw new InvalidOperationException("Room already exists");
        }

        var room = new ChatRoom(
            Id: roomId,
            CreatedBy: userId,
            CreatedAt: DateTime.UtcNow,
            Members: [userId]
        );

        repository.SaveRoom(room);
        return Task.FromResult(room);
    }

    public Task<ChatRoom> JoinRoomAsync(string roomId, string userId)
    {
        var room = repository.GetRoom(roomId);
        if (room == null)
        {
            // Auto-create room if it doesn't exist (matching current behavior)
            room = new ChatRoom(
                Id: roomId,
                CreatedBy: userId,
                CreatedAt: DateTime.UtcNow,
                Members: [userId]
            );
            repository.SaveRoom(room);
        }
        else
        {
            repository.AddMemberToRoom(roomId, userId);
            // Re-fetch to get updated members
            room = repository.GetRoom(roomId)!;
        }

        return Task.FromResult(room);
    }

    public Task<IReadOnlyList<ChatRoom>> GetUserRoomsAsync(string userId)
    {
        return Task.FromResult(repository.GetRoomsByUser(userId));
    }

    public Task SaveMessageAsync(ChatMessage message)
    {
        repository.SaveMessage(message);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<ChatMessage>> GetMessagesAsync(string roomId)
    {
        return Task.FromResult(repository.GetMessages(roomId));
    }

    public Task SaveRoomKeyAsync(string roomId, string userId, string encryptedKey)
    {
        repository.SaveRoomKey(roomId, userId, encryptedKey);
        return Task.CompletedTask;
    }

    public Task<string?> GetRoomKeyAsync(string roomId, string userId)
    {
        return Task.FromResult(repository.GetRoomKey(roomId, userId));
    }
}
