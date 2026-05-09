// src/services/e2ee.ts

import type { EncryptedPayload } from "../types/protocol";

// =====================================================
// Key Generation
// =====================================================

export async function generateKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
        {
            name: "ECDH",
            namedCurve: "P-256",
        },
        true,
        ["deriveKey"]
    );
}

// =====================================================
// Public Key Export / Import
// =====================================================

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const raw = await crypto.subtle.exportKey("raw", publicKey);

    return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    return crypto.subtle.importKey(
        "raw",
        binary,
        {
            name: "ECDH",
            namedCurve: "P-256",
        },
        true,
        []
    );
}

// =====================================================
// Shared Secret Derivation
// =====================================================

export async function deriveSharedKey(
    privateKey: CryptoKey,
    publicKey: CryptoKey
): Promise<CryptoKey> {
    return crypto.subtle.deriveKey(
        {
            name: "ECDH",
            public: publicKey,
        },
        privateKey,
        {
            name: "AES-GCM",
            length: 256,
        },
        false,
        ["encrypt", "decrypt"]
    );
}

// =====================================================
// Room Key Generation
// =====================================================

export async function generateRoomKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
}

// =====================================================
// Encrypt / Decrypt Chat Messages
// =====================================================

export async function encryptMessage(
    roomKey: CryptoKey,
    text: string
): Promise<EncryptedPayload> {
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encoded = new TextEncoder().encode(text);

    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
        },
        roomKey,
        encoded
    );

    return {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted)),
    };
}

export async function decryptMessage(
    roomKey: CryptoKey,
    payload: EncryptedPayload
): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: new Uint8Array(payload.iv),
        },
        roomKey,
        new Uint8Array(payload.data)
    );

    return new TextDecoder().decode(decrypted);
}

// =====================================================
// Encrypt / Decrypt Room Key
// Used during key exchange
// =====================================================

export async function encryptRoomKey(
    roomKey: CryptoKey,
    sharedKey: CryptoKey
): Promise<EncryptedPayload> {
    const exportedRoomKey = await crypto.subtle.exportKey("raw", roomKey);

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
        },
        sharedKey,
        exportedRoomKey
    );

    return {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted)),
    };
}

export async function decryptRoomKey(
    payload: EncryptedPayload,
    sharedKey: CryptoKey
): Promise<CryptoKey> {
    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: new Uint8Array(payload.iv),
        },
        sharedKey,
        new Uint8Array(payload.data)
    );

    return crypto.subtle.importKey(
        "raw",
        decrypted,
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
}