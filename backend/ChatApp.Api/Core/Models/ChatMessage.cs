namespace ChatApp.Api.Core.Models;

public record ChatMessage(
    string Id,
    string Type,
    string SenderId,
    string RoomId,
    string EncryptedPayload, 
    DateTime CreatedAt
);
