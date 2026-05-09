// src/services/keyExchange.ts

import { toRaw } from "vue";

import {

  generateKeyPair,
  deriveSharedKey,
  encryptRoomKey,
  decryptRoomKey,
  exportPublicKey,
  importPublicKey,

} from "./e2ee";

import {

  saveKeyPair,
  loadKeyPair,

} from "../stores/keystore";

import {

  generateFingerprint,

} from "./fingerprint";

// ======================================================
// Key Exchange State
// ======================================================

export interface KeyExchangeState {

  // Our long-term identity key pair

  keyPair: CryptoKeyPair;

  // Shared ECDH keys per peer

  sharedKeys: Map<string, CryptoKey>;

  // Current room encryption key

  roomKey: CryptoKey | null;

  // Pending encrypted room key
  // used before shared secret becomes available

  pendingRoomKey: {
    iv: number[];
    data: number[];
  } | null;

  // Creator flag

  isRoomCreator: boolean;

  // Peers we've completed exchange with

  exchangedPeers: Set<string>;

  // ==================================================
  // Fingerprint Verification
  // ==================================================

  // Peer fingerprints

  peerFingerprints: Map<string, string>;

  // Verified peers

  verifiedPeers: Set<string>;

  // Queued identity messages that couldn't be decrypted yet
  // (e.g. because handshake hasn't completed)

  pendingIdentityMessages: Map<string, any[]>;

}

// ======================================================
// Create State
// ======================================================

export function createKeyExchangeState(): KeyExchangeState {

  return {

    keyPair: { publicKey: null!, privateKey: null! },

    sharedKeys: new Map(),

    roomKey: null,

    pendingRoomKey: null,

    isRoomCreator: false,

    exchangedPeers: new Set(),

    peerFingerprints: new Map(),

    verifiedPeers: new Set(),

    pendingIdentityMessages: new Map(),

  };

}

// ======================================================
// Initialize Persistent Identity Keypair
// ======================================================

export async function initKeyPair(
    state: KeyExchangeState,
    userId: string
): Promise<string> {

  const existing = await loadKeyPair(userId);

  if (existing) {

    state.keyPair = toRaw(existing);

    console.log(
        "🔑 Loaded existing key pair from IndexedDB"
    );

  } else {

    state.keyPair = await generateKeyPair();

    await saveKeyPair(userId, toRaw(state.keyPair));

    console.log(
        "🔑 Generated new key pair and saved to IndexedDB"
    );

  }

  return exportPublicKey(
      state.keyPair.publicKey
  );

}

// ======================================================
// Public Key Helpers
// ======================================================

export async function getMyPublicKey(
    state: KeyExchangeState
): Promise<string> {

  return exportPublicKey(
      state.keyPair.publicKey
  );

}

// ======================================================
// Fingerprint Helpers
// ======================================================

export async function getMyFingerprint(
    state: KeyExchangeState
): Promise<string> {

  const publicKey = await exportPublicKey(
      state.keyPair.publicKey
  );

  return generateFingerprint(publicKey);

}

export function setPeerFingerprint(
    state: KeyExchangeState,
    userId: string,
    fingerprint: string
) {

  state.peerFingerprints.set(
      userId,
      fingerprint
  );

}

export function getPeerFingerprint(
    state: KeyExchangeState,
    userId: string
): string | undefined {

  return state.peerFingerprints.get(userId);

}

// ======================================================
// Verification State
// ======================================================

export function verifyPeer(
    state: KeyExchangeState,
    userId: string
) {

  state.verifiedPeers.add(userId);

}

export function unverifyPeer(
    state: KeyExchangeState,
    userId: string
) {

  state.verifiedPeers.delete(userId);

}

export function isPeerVerified(
    state: KeyExchangeState,
    userId: string
): boolean {

  return state.verifiedPeers.has(userId);

}

// ======================================================
// Shared Secret Derivation
// ======================================================

export async function processIncomingPublicKey(

    state: KeyExchangeState,

    fromUserId: string,

    publicKeyBase64: string,

): Promise<{ sharedKey: CryptoKey; decryptedRoomKey: boolean }> {

  console.log(`[KeyExchange] Processing public key from ${fromUserId}`);

  const importedKey = await importPublicKey(
      publicKeyBase64
  );

  const sharedKey = await deriveSharedKey(
      toRaw(state.keyPair.privateKey),
      importedKey
  );

  state.sharedKeys.set(
      fromUserId,
      sharedKey
  );

  // Check if we have pending identity messages from this user
  const pending = state.pendingIdentityMessages.get(fromUserId);
  if (pending && pending.length > 0) {
    console.log(`[KeyExchange] Found ${pending.length} pending identity messages from ${fromUserId}. Retrying decryption...`);
    // We only care about the latest identity message (newest key)
    const latest = pending[pending.length - 1];
    const success = await tryDecryptRoomKey(state, latest, fromUserId);
    if (success) {
      state.pendingIdentityMessages.delete(fromUserId);
      // Return true to signal the UI that it might need to update the room key
      return { sharedKey, decryptedRoomKey: true };
    }
  }

  return { sharedKey, decryptedRoomKey: false };
}

// ======================================================
// Room Key Encryption
// ======================================================

export async function buildEncryptedRoomKey(

    state: KeyExchangeState,

    sharedKey: CryptoKey,
    
    roomKey: CryptoKey

): Promise<{
  iv: number[];
  data: number[];
}> {

  return encryptRoomKey(
      toRaw(roomKey),
      toRaw(sharedKey)
  );

}

// ======================================================
// Room Key Decryption
// ======================================================

export async function tryDecryptRoomKey(

    state: KeyExchangeState,

    payload: {
      iv: number[];
      data: number[];
    },

    senderId?: string

): Promise<boolean> {

  if (senderId) {
    console.log(`[KeyExchange] Attempting to decrypt room key from ${senderId}`);
    const sharedKey = state.sharedKeys.get(senderId);
    if (sharedKey) {
      try {
        state.roomKey = await decryptRoomKey(payload, toRaw(sharedKey));
        state.pendingRoomKey = null;
        console.log(`[KeyExchange] Successfully decrypted room key from ${senderId}`);
        return true;
      } catch (e) {
        console.warn(`[KeyExchange] Failed to decrypt room key from ${senderId} specifically`, e);
      }
    } else {
      console.log(`[KeyExchange] No shared key for ${senderId} yet. Queueing identity message.`);
      if (!state.pendingIdentityMessages.has(senderId)) {
        state.pendingIdentityMessages.set(senderId, []);
      }
      state.pendingIdentityMessages.get(senderId)!.push(payload);
    }
  }

  console.log(`[KeyExchange] Attempting fallback decryption with ${state.sharedKeys.size} shared keys`);

  for (const [userId, sharedKey] of state.sharedKeys.entries()) {

    try {

      state.roomKey =
          await decryptRoomKey(
              payload,
              toRaw(sharedKey)
          );

      state.pendingRoomKey = null;

      console.log(`[KeyExchange] Successfully decrypted room key using shared key for ${userId}`);

      return true;

    } catch {

      console.warn(`[KeyExchange] Failed to decrypt room key using shared key for ${userId}`);
      // try next shared key

    }

  }

  return false;

}