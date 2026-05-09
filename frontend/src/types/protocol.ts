// src/services/protocol.ts

export type MessageType =
    | "connect"
    | "handshake"
    | "identity"
    | "chat"
    | "typing"
    | "error"
    | "presence";

// ======================================================
// Base Protocol Message
// ======================================================

export interface ProtocolMessage {
    id?: string;
    type: MessageType;
    senderId: string;
    senderDisplayName?: string;
    roomId: string;
    payload: unknown;
}

// ======================================================
// Chat Payload
// ======================================================

export interface ChatPayload {
    senderDisplayName?: string;
    encrypted: EncryptedPayload;
}

// ======================================================
// Typing Payload
// ======================================================

export interface TypingPayload {

    isTyping: boolean;

}

// ======================================================
// Presence Payload
// ======================================================

export interface PresencePayload {

    status: "online" | "offline" | "inactive";

    displayName: string;

}

// ======================================================
// Public Key Handshake
// ======================================================

export interface HandshakePayload {

    publicKey: string;

}

// ======================================================
// Identity Announcement
// Includes fingerprint verification data
// ======================================================

export interface IdentityPayload {

    publicKey: string;

    fingerprint: string;

}

// ======================================================
// Error Payload
// ======================================================

export interface ErrorPayload {

    message: string;

}

// ======================================================
// Encrypted Message Payload
// ======================================================

export interface EncryptedPayload {

    iv: number[];

    data: number[];

}