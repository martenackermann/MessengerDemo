using Microsoft.AspNetCore.SignalR;
using System.Text.Json;
using System.Collections.Concurrent;
using ChatApp.Api.Core.Interfaces;
using ChatApp.Api.Core.Models;

namespace ChatApp.Api.Hubs;

public record ProtocolMessage(
    string Type,
    string SenderId,
    string RoomId,
    JsonElement Payload,
    string? SenderDisplayName = null
);

public class ChatHub(IChatService chatService) : Hub
{
    private static readonly ConcurrentDictionary<string, string> UserConnections = new();
    private static readonly ConcurrentDictionary<string, string> PublicKeys = new();

    // ---- Lifecycle ----

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        if (string.IsNullOrEmpty(userId)) { Context.Abort(); return; }

        UserConnections[userId] = Context.ConnectionId;
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        if (userId is null) return;

        UserConnections.TryRemove(userId, out _);

        var userRooms = await chatService.GetUserRoomsAsync(userId);
        foreach (var room in userRooms)
        {
            await BroadcastToRoom(room.Id, new ProtocolMessage(
                Type: "presence",
                SenderId: userId,
                RoomId: room.Id,
                Payload: Serialize(new { status = "offline", displayName = userId })
            ));
        }

        await base.OnDisconnectedAsync(exception);
    }

    // ---- Room Management ----

    public async Task CreateRoom(string roomId)
    {
        var userId = GetUserId();
        if (userId is null) return;

        try
        {
            await chatService.CreateRoomAsync(roomId, userId);
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
            await GetUserRooms();
        }
        catch (InvalidOperationException ex)
        {
            await SendError(ex.Message);
        }
    }

    public async Task JoinRoom(string roomId)
    {
        var userId = GetUserId();
        if (userId is null) return;

        await chatService.JoinRoomAsync(roomId, userId);
        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

        await BroadcastToRoom(roomId, new ProtocolMessage(
            Type: "presence",
            SenderId: userId,
            RoomId: roomId,
            Payload: Serialize(new { status = "online", displayName = userId })
        ));

        await GetUserRooms();
    }

    public async Task GetUserRooms()
    {
        var userId = GetUserId();
        if (userId is null) return;

        var rooms = await chatService.GetUserRoomsAsync(userId);
        await Clients.Caller.SendAsync("UserRooms", rooms);
    }

    public async Task GetRoomHistory(string roomId)
    {
        var userId = GetUserId();
        if (userId is null) return;

        // In a real app, we'd have permission checks in the service
        var messages = await chatService.GetMessagesAsync(roomId);
        await Clients.Caller.SendAsync("RoomHistory", messages);
    }

    public async Task GetRoomUsers(string roomId)
    {
        // This is a bit inefficient, but keeping it simple for now
        var rooms = await chatService.GetUserRoomsAsync(GetUserId() ?? "");
        var room = rooms.FirstOrDefault(r => r.Id == roomId);
        
        if (room is not null)
            await Clients.Caller.SendAsync("RoomUsers", room.Members);
    }

    // ---- Messaging ----

    public async Task SendMessage(ProtocolMessage message)
    {
        var userId = GetUserId();
        if (userId is null) return;

        if (!IsValid(message))
        {
            await SendError("Invalid message format");
            return;
        }

        var authorizedMessage = message with { SenderId = userId };

        if (authorizedMessage.Type == "chat")
        {
            var stored = new ChatMessage(
                Id: Guid.NewGuid().ToString(),
                Type: authorizedMessage.Type,
                SenderId: authorizedMessage.SenderId,
                RoomId: authorizedMessage.RoomId,
                EncryptedPayload: authorizedMessage.Payload.GetRawText(),
                CreatedAt: DateTime.UtcNow
            );
            await chatService.SaveMessageAsync(stored);
        }

        await BroadcastToRoom(authorizedMessage.RoomId, authorizedMessage);
    }
    
    public async Task SendDirectMessage(string toUserId, ProtocolMessage message)
    {
        var userId = GetUserId();
        if (userId is null) return;

        if (!IsValid(message))
        {
            await SendError("Invalid message format");
            return;
        }

        var authorizedMessage = message with { SenderId = userId };

        if (UserConnections.TryGetValue(toUserId, out var connectionId))
        {
            await Clients.Client(connectionId).SendAsync("ReceiveMessage", authorizedMessage);
        }
    }
    
    public async Task RegisterPublicKey(string publicKey)
    {
        var userId = GetUserId();
        if (userId is null) return;
        PublicKeys[userId] = publicKey;
    }

    public async Task StoreRoomKey(string roomId, Dictionary<string, string> encryptedKeysPerUser)
    {
        var userId = GetUserId();
        if (userId is null) return;

        foreach (var (memberId, encryptedKey) in encryptedKeysPerUser)
        {
            await chatService.SaveRoomKeyAsync(roomId, memberId, encryptedKey);
        }
    }

    public async Task GetRoomKey(string roomId)
    {
        var userId = GetUserId();
        if (userId is null) return;

        var encryptedKey = await chatService.GetRoomKeyAsync(roomId, userId);
        if (encryptedKey is not null)
            await Clients.Caller.SendAsync("RoomKey", encryptedKey);
    }

    public async Task GetMemberPublicKeys(string roomId)
    {
        // Simple implementation for now
        var rooms = await chatService.GetUserRoomsAsync(GetUserId() ?? "");
        var room = rooms.FirstOrDefault(r => r.Id == roomId);
        if (room is null) return;

        var keys = room.Members
            .Where(m => PublicKeys.ContainsKey(m))
            .ToDictionary(m => m, m => PublicKeys[m]);

        await Clients.Caller.SendAsync("MemberPublicKeys", keys);
    }

    // ---- Helpers ----

    private async Task BroadcastToRoom(string roomId, ProtocolMessage message) =>
        await Clients.Group(roomId).SendAsync("ReceiveMessage", message);

    private async Task SendError(string error) =>
        await Clients.Caller.SendAsync("ReceiveMessage", new ProtocolMessage(
            Type: "error",
            SenderId: "server",
            RoomId: "",
            Payload: Serialize(new { error })
        ));

    private static JsonElement Serialize<T>(T value) =>
        JsonSerializer.SerializeToElement(value);

    private static bool IsValid(ProtocolMessage m) =>
        !string.IsNullOrWhiteSpace(m.Type) &&
        !string.IsNullOrWhiteSpace(m.SenderId) &&
        !string.IsNullOrWhiteSpace(m.RoomId) &&
        m.Payload.ValueKind != JsonValueKind.Undefined;

    private string? GetUserId() =>
        Context.GetHttpContext()?.Request.Query["user"];
}