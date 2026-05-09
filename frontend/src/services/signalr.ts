import * as signalR from "@microsoft/signalr";
import type { ProtocolMessage } from "../types/protocol";

let connection: signalR.HubConnection | null = null;

function getConnection(): signalR.HubConnection | null {
    return connection;
}

export async function startConnection(userId: string): Promise<void> {
    if (connection) {
        await connection.stop();
    }
    connection = new signalR.HubConnectionBuilder()
        .withUrl(`http://localhost:5133/chatHub?user=${userId}`)
        .withAutomaticReconnect()
        .build();
    await connection.start();
}

export async function stopConnection(): Promise<void> {
    if (connection) {
        await connection.stop();
        connection = null;
    }
}

export function onDisconnected(cb: () => void): void {
    getConnection()?.onclose(cb);
    getConnection()?.onreconnecting(cb);
}

export function onReconnected(cb: () => void): void {
    getConnection()?.onreconnected(cb);
}

export async function createRoom(roomId: string): Promise<void> {
    await getConnection()?.invoke("CreateRoom", roomId);
}

export async function joinRoom(roomId: string): Promise<void> {
    await getConnection()?.invoke("JoinRoom", roomId);
}

export async function sendMessage(message: ProtocolMessage): Promise<void> {
    await getConnection()?.invoke("SendMessage", message);
}

export function onMessage(cb: (message: ProtocolMessage) => void): void {
    getConnection()?.on("ReceiveMessage", cb);
}

export function offMessage(cb?: (message: ProtocolMessage) => void): void {
    const conn = getConnection();
    if (!conn) return;
    if (cb) {
        conn.off("ReceiveMessage", cb);
    } else {
        conn.off("ReceiveMessage");
    }
}

export async function getRoomUsers(roomId: string): Promise<void> {
    await getConnection()?.invoke("GetRoomUsers", roomId);
}

export function onRoomUsers(cb: (users: string[]) => void): void {
    getConnection()?.on("RoomUsers", cb);
}

export function offRoomUsers(): void {
    getConnection()?.off("RoomUsers");
}

export async function getUserRooms(): Promise<void> {
    await getConnection()?.invoke("GetUserRooms");
}

export function onUserRooms(cb: (rooms: ChatRoomSummary[]) => void): void {
    getConnection()?.on("UserRooms", cb);
}

export function offUserRooms(): void {
    getConnection()?.off("UserRooms");
}

export async function getRoomHistory(roomId: string): Promise<void> {
    await getConnection()?.invoke("GetRoomHistory", roomId);
}

export function onRoomHistory(cb: (messages: StoredMessage[]) => void): void {
    getConnection()?.on("RoomHistory", cb);
}

export function offRoomHistory(): void {
    getConnection()?.off("RoomHistory");
}

export async function sendDirectMessage(toUserId: string, message: ProtocolMessage): Promise<void> {
    await getConnection()?.invoke("SendDirectMessage", toUserId, message);
}

export async function registerPublicKey(publicKey: string): Promise<void> {
    await getConnection()?.invoke("RegisterPublicKey", publicKey);
}

export async function getMemberPublicKeys(roomId: string): Promise<void> {
    await getConnection()?.invoke("GetMemberPublicKeys", roomId);
}

export function onMemberPublicKeys(cb: (keys: Record<string, string>) => void): void {
    getConnection()?.on("MemberPublicKeys", cb);
}

export function offMemberPublicKeys(): void {
    getConnection()?.off("MemberPublicKeys");
}

export async function storeRoomKey(roomId: string, encryptedKeysPerUser: Record<string, string>): Promise<void> {
    await getConnection()?.invoke("StoreRoomKey", roomId, encryptedKeysPerUser);
}

export async function getRoomKey(roomId: string): Promise<void> {
    await getConnection()?.invoke("GetRoomKey", roomId);
}

export function onRoomKey(cb: (encryptedKey: string) => void): void {
    getConnection()?.on("RoomKey", cb);
}

export function offRoomKey(): void {
    getConnection()?.off("RoomKey");
}

export interface ChatRoomSummary {
    id: string;
    createdBy: string;
    createdAt: string;
    members: string[];
}

export interface StoredMessage {
    id: string;
    type: string;
    senderId: string;
    roomId: string;
    encryptedPayload: string;
    createdAt: string;
}