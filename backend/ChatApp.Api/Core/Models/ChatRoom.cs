namespace ChatApp.Api.Core.Models;

public record ChatRoom(
    string Id,
    string CreatedBy,
    DateTime CreatedAt,
    string[] Members
);
