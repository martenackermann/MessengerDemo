// src/stores/chat.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ChatRoomSummary, StoredMessage } from "../services/signalr";

export interface DisplayMessage {
  id?: string;
  display: string;
  time: string; // ISO string — serializable for localStorage
  roomId: string;
}

export const useChatStore = defineStore("chat", () => {
  // ---- Persisted identity ----
  const myId = ref(localStorage.getItem("chat:myId") ?? "");
  const displayName = ref(localStorage.getItem("chat:displayName") ?? "");

  function saveIdentity(id: string, name: string) {
    myId.value = id;
    displayName.value = name;
    localStorage.setItem("chat:myId", id);
    localStorage.setItem("chat:displayName", name);
  }

  async function clearIdentity() {
    myId.value = "";
    displayName.value = "";
    localStorage.removeItem("chat:myId");
    localStorage.removeItem("chat:displayName");
    localStorage.removeItem("chat:userRooms");
    
    // Also clear other related state
    clearLastRoom();
    connectedRoom.value = null;
    isConnected.value = false;
    userRooms.value = [];
    roomPresence.value = {};
    clearRoomMessages();
    
    const { stopConnection } = await import("../services/signalr");
    await stopConnection();
  }

  // ---- Persisted last room ----
  const lastRoomId = ref(localStorage.getItem("chat:lastRoomId") ?? "");

  function saveLastRoom(rId: string) {
    lastRoomId.value = rId;
    localStorage.setItem("chat:lastRoomId", rId);
  }

  function clearLastRoom() {
    lastRoomId.value = "";
    localStorage.removeItem("chat:lastRoomId");
  }

  // ---- Connection state (not persisted — rebuilt on mount) ----
  const isConnected = ref(false);
  const connectedRoom = ref<string | null>(null);
  const userRooms = ref<ChatRoomSummary[]>([]);

  function saveUserRooms(rooms: ChatRoomSummary[]) {
    userRooms.value = rooms;
    localStorage.setItem("chat:userRooms", JSON.stringify(rooms));
  }

  function loadUserRooms() {
    try {
      const stored = localStorage.getItem("chat:userRooms");
      if (stored) {
        userRooms.value = JSON.parse(stored);
      }
    } catch {
      userRooms.value = [];
    }
  }

  // Initialize userRooms from storage
  loadUserRooms();

  // ---- Messages (per room, persisted) ----
  function loadMessages(rId: string): DisplayMessage[] {
    try {
      return JSON.parse(localStorage.getItem(`chat:messages:${rId}`) ?? "[]");
    } catch {
      return [];
    }
  }

  function saveMessages(rId: string, msgs: DisplayMessage[]) {
    // Keep last 200 messages per room
    const trimmed = msgs.slice(-200);
    localStorage.setItem(`chat:messages:${rId}`, JSON.stringify(trimmed));
  }

  const messages = ref<DisplayMessage[]>([]);

  function pushMessage(msg: DisplayMessage) {
    if (msg.id && messages.value.some(m => m.id === msg.id)) {
      return;
    }
    messages.value.push(msg);
    if (connectedRoom.value) {
      saveMessages(connectedRoom.value, messages.value);
    }
  }

  function loadRoomMessages(rId: string) {
    messages.value = loadMessages(rId);
  }

  function clearRoomMessages() {
    messages.value = [];
  }

  // ---- Presence (per room) ----
  const roomPresence = ref<Record<string, {
    status: "online" | "offline" | "inactive";
    displayName: string;
    isTyping: boolean;
  }>>({});

  const currentPeerPresence = computed(() => {
    if (!connectedRoom.value) return null;
    
    // For direct chats, the peer is the other person in the room ID
    if (connectedRoom.value.startsWith('dm:')) {
      const parts = connectedRoom.value.split(':');
      const peerId = parts.find(p => p !== 'dm' && p !== myId.value);
      if (peerId && roomPresence.value[peerId]) {
        return roomPresence.value[peerId];
      }
      // If we don't have presence data yet, return a default with the peerId
      if (peerId) {
        return { status: "offline", displayName: peerId, isTyping: false };
      }
    }

    // For regular rooms, we find the first peer that is NOT me
    const room = userRooms.value.find(r => r.id === connectedRoom.value);
    if (!room) {
      // If room is not in userRooms yet (loading), try to find any presence in this room
      // But presence is stored by userId, not room. 
      // In a real app, we'd need roomMembers stored in the store.
      return null;
    }
    const peerId = room.members.find(m => m !== myId.value);
    if (!peerId) return null;
    return roomPresence.value[peerId] || { status: "offline", displayName: peerId, isTyping: false };
  });

  const peerStatus = computed(() => currentPeerPresence.value?.status ?? "offline");
  const peerDisplayName = computed(() => currentPeerPresence.value?.displayName ?? "Peer");
  const peerIsTyping = computed(() => currentPeerPresence.value?.isTyping ?? false);

  const presenceColor = computed(() =>
    ({ online: "green", inactive: "orange", offline: "gray" }[peerStatus.value])
  );

  const presenceLabel = computed(() =>
    ({
      online: `${peerDisplayName.value} is online`,
      inactive: `${peerDisplayName.value} is inactive`,
      offline: `${peerDisplayName.value} is offline`,
    }[peerStatus.value])
  );

  function updatePeerPresence(userId: string, data: Partial<{
    status: "online" | "offline" | "inactive";
    displayName: string;
    isTyping: boolean;
  }>) {
    if (!roomPresence.value[userId]) {
      roomPresence.value[userId] = {
        status: "offline",
        displayName: "Peer",
        isTyping: false
      };
    }
    roomPresence.value[userId] = { ...roomPresence.value[userId], ...data };
  }

  return {
    // identity
    myId, displayName, saveIdentity, clearIdentity,
    // last room
    lastRoomId, saveLastRoom, clearLastRoom,
    // connection
    isConnected, connectedRoom, userRooms, saveUserRooms,
    // messages
    messages, pushMessage, loadRoomMessages, clearRoomMessages, saveMessages,
    // presence
    peerStatus, peerDisplayName, peerIsTyping, presenceColor, presenceLabel,
    roomPresence, updatePeerPresence,
  };
});
