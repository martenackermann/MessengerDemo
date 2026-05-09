using ChatApp.Api.Core.Models;

namespace ChatApp.Api.Core.Interfaces;

public interface IChatService
{
    Task<ChatRoom> CreateRoomAsync(string roomId, string userId);
    Task<ChatRoom> JoinRoomAsync(string roomId, string userId);
    Task<IReadOnlyList<ChatRoom>> GetUserRoomsAsync(string userId);
    Task SaveMessageAsync(ChatMessage message);
    Task<IReadOnlyList<ChatMessage>> GetMessagesAsync(string roomId);
    Task SaveRoomKeyAsync(string roomId, string userId, string encryptedKey);
    Task<string?> GetRoomKeyAsync(string roomId, string userId);
}
