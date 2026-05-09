using ChatApp.Api.Core.Models;

namespace ChatApp.Api.Core.Interfaces;

public interface IChatRepository
{
    void SaveRoom(ChatRoom room);
    ChatRoom? GetRoom(string roomId);
    IReadOnlyList<ChatRoom> GetRoomsByUser(string userId);
    void AddMemberToRoom(string roomId, string userId);
    
    void SaveMessage(ChatMessage message);
    IReadOnlyList<ChatMessage> GetMessages(string roomId);
    
    void SaveRoomKey(string roomId, string userId, string encryptedKey);
    string? GetRoomKey(string roomId, string userId);
}
