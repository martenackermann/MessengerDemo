<template>
  <AppLayout
    :title="'Room: ' + displayRoomName"
    :user-rooms="formattedRooms"
    :display-name="chat.displayName"
    @logout="handleLogout">
    <div class="flex flex-col h-full max-h-full">
      <div class="flex justify-between items-center mb-4">
        <div class="flex flex-col">
          <span class="text-lg font-bold text-white">Room: {{ displayRoomName }}</span>
        </div>
      </div>

      <!-- MESSAGES -->
      <div
        ref="messageContainer"
        class="flex-1 bg-gray-800/50 border border-white/10 rounded-xl overflow-y-auto p-4 mb-4"
      >
        <div
          v-for="(msg, i) in chat.messages"
          :key="i"
          class="mb-3 last:mb-0"
        >
          <div class="flex items-baseline gap-2">
            <span class="font-bold text-indigo-400 text-sm">{{ getSenderDisplayName(msg) }}</span>
            <span class="text-xs text-gray-500">{{ formatTime(msg.time) }}</span>
          </div>
          <p class="text-gray-200 text-sm mt-0.5">{{ getMessageContent(msg) }}</p>
        </div>
        <div v-for="typingUser in typingUsers" :key="typingUser.id" class="text-gray-500 italic text-xs animate-pulse">
          {{ typingUser.displayName }} is typing...
        </div>
      </div>

      <!-- SEND -->
      <div class="flex flex-col gap-2">
        <div class="flex gap-2">
          <input
            v-model="messageText"
            placeholder="Type a message..."
            @input="onTyping"
            @keydown.enter="send"
            class="flex-1 bg-gray-900 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          <button
            @click="send"
            :disabled="!messageText.trim()"
            class="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
        <div v-if="!roomKey" class="text-xs text-amber-500 font-medium">
          Establishing secure channel...
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, toRaw, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat'
import * as signalR from '../services/signalr'
import * as e2ee from '../services/e2ee'
import * as keyExchange from '../services/keyExchange'
import { loadRoomKey, saveRoomKey } from '../stores/keystore'
import AppLayout from '../components/AppLayout.vue'
import type { ProtocolMessage, ChatPayload, HandshakePayload, PresencePayload } from '../types/protocol'

const route = useRoute()
const router = useRouter()
const chat = useChatStore()
const roomId = ref(route.params.roomId as string)
const roomUsers = ref<string[]>([])

const formattedRooms = computed(() => {
  return chat.userRooms.map(room => ({
    id: room.id,
    name: getRoomDisplayName(room.id),
    initial: getRoomDisplayName(room.id).charAt(0).toUpperCase(),
    current: chat.connectedRoom === room.id
  }))
})


  const typingUsers = computed(() => {
  return Object.keys(chat.roomPresence)
    .filter(uid => uid !== chat.myId && chat.roomPresence[uid]?.isTyping)
    .map(uid => ({
      id: uid,
      displayName: chat.roomPresence[uid]?.displayName || uid
    }))
})

const displayRoomName = computed(() => {
  if (roomId.value.startsWith('dm:')) {
    const parts = roomId.value.split(':')
    const otherUserId = parts.find(p => p !== 'dm' && p !== chat.myId)
    const otherDisplayName = otherUserId ? (chat.roomPresence[otherUserId]?.displayName || otherUserId) : 'Unknown'
    return `Direct Chat with ${otherDisplayName}`
  }
  return roomId.value
})

const messageText = ref('')
const roomKey = ref<CryptoKey | null>(null)
const kxState = ref(keyExchange.createKeyExchangeState())
const messageContainer = ref<HTMLElement | null>(null)

let typingTimeout: any = null

onMounted(async () => {
  await init()
  setupSignalRHandlers()
})

onUnmounted(() => {
  broadcastPresence('offline')
  signalR.offMessage(handleIncomingMessage)
  signalR.offRoomKey()
  signalR.offRoomUsers()
  signalR.offUserRooms()
  signalR.offRoomHistory()
})

watch(() => route.params.roomId, async (newId) => {
  if (newId) {
    roomId.value = newId as string
    await init()
  }
})

watch(() => chat.messages.length, () => {
  nextTick(() => {
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight
    }
  })
})

async function init() {
  if (!chat.isConnected) {
    await signalR.startConnection(chat.myId)
    chat.isConnected = true
  }

  if (roomId.value.startsWith('dm:')) {
    const parts = roomId.value.split(':')
    const ids = parts.filter(p => p !== 'dm').sort()
    const sortedRoomId = `dm:${ids[0]}:${ids[1]}`
    if (roomId.value !== sortedRoomId) {
      roomId.value = sortedRoomId
      router.replace(`/chat/${sortedRoomId}`)
      return
    }
  }

  chat.connectedRoom = roomId.value
  chat.loadRoomMessages(roomId.value)

  await joinRoom()
}

function setupSignalRHandlers() {
  signalR.onMessage(handleIncomingMessage)
  signalR.onRoomKey(async (encryptedKey) => {
    const success = await keyExchange.tryDecryptRoomKey(toRaw(kxState.value), JSON.parse(encryptedKey))
    if (success && kxState.value.roomKey) {
       await setRoomKey(toRaw(kxState.value.roomKey))
    }
  })
  signalR.onRoomUsers((users) => {
    roomUsers.value = users
    users.forEach(u => {
      if (u !== chat.myId && !chat.roomPresence[u]) {
        chat.updatePeerPresence(u, { status: 'online' })
      }
    })
  })
  signalR.onUserRooms((rooms) => {
    chat.saveUserRooms(rooms)
  })
  signalR.onRoomHistory(handleRoomHistory)
}

async function joinRoom() {
  resetState()
  await signalR.joinRoom(roomId.value)
  chat.saveLastRoom(roomId.value)

  const storedKey = await loadRoomKey(roomId.value)
  if (storedKey) {
    await setRoomKey(storedKey)
  }

  broadcastPresence('online')
  await signalR.getRoomUsers(roomId.value)
  await signalR.getUserRooms()
  
  kxState.value = keyExchange.createKeyExchangeState()
  await keyExchange.initKeyPair(toRaw(kxState.value), chat.myId)
  
  if (roomKey.value) {
    kxState.value.roomKey = toRaw(roomKey.value)
  }

  const myPubKey = await keyExchange.getMyPublicKey(toRaw(kxState.value))
  await signalR.sendMessage({
    type: 'handshake',
    senderId: chat.myId,
    roomId: roomId.value,
    payload: { publicKey: myPubKey } as HandshakePayload
  })

  if (!roomKey.value) {
    await signalR.getRoomKey(roomId.value)
  }

  if (roomKey.value) {
    await signalR.getRoomHistory(roomId.value)
  } else {
    pushSystem('Establishing secure channel...')
  }
}

function resetState() {
  roomKey.value = null
  chat.roomPresence = {}
}

async function setRoomKey(key: CryptoKey, senderId?: string) {
  const rawKey = toRaw(key);
  const exported = await crypto.subtle.exportKey("raw", rawKey);
  const hashArray = await crypto.subtle.digest("SHA-1", exported);
  const thumbprint = btoa(String.fromCharCode(...new Uint8Array(hashArray))).substring(0, 8);

  if (roomKey.value) {
    const exportedExisting = await crypto.subtle.exportKey("raw", toRaw(roomKey.value));
    const exportedNew = await crypto.subtle.exportKey("raw", rawKey);
    const b64Existing = btoa(String.fromCharCode(...new Uint8Array(exportedExisting)));
    const b64New = btoa(String.fromCharCode(...new Uint8Array(exportedNew)));
    if (b64Existing === b64New) {
      // Same key, nothing to do
      return;
    }
  }
  roomKey.value = rawKey
  kxState.value.roomKey = rawKey 
  await saveRoomKey(roomId.value, rawKey)
  chat.messages = chat.messages.filter(message => 
    !message.display.includes('Establishing secure channel') &&
    !message.display.includes('⚠️ Failed to decrypt') && 
    !message.display.includes('[Encrypted message - waiting for key]')
  );

  await signalR.getRoomHistory(roomId.value)
}

async function handleIncomingMessage(msg: ProtocolMessage) {
  if (msg.roomId !== roomId.value) return

  if (!kxState.value.keyPair.publicKey || !kxState.value.keyPair.privateKey) {
      //Ignoring messages until we have a key pair
     return
  }

  if (msg.type === 'chat') {
    await handleChatMessage(msg)
  } else if (msg.type === 'handshake') {
    await handleHandshake(msg)
  } else if (msg.type === 'identity') {
    await handleIdentity(msg)
  } else if (msg.type === 'presence') {
    const p = msg.payload as PresencePayload
    chat.updatePeerPresence(msg.senderId, { status: p.status, displayName: p.displayName })
  } else if (msg.type === 'typing') {
    const t = msg.payload as any
    chat.updatePeerPresence(msg.senderId, { isTyping: t.isTyping, displayName: msg.senderDisplayName || msg.senderId })
  }
}

async function handleChatMessage(msg: ProtocolMessage) {
  const payload = msg.payload as ChatPayload
  if (!roomKey.value) {
    chat.pushMessage({
      id: msg.id,
      display: `${msg.senderId}: [Encrypted message - waiting for key]`,
      time: msg.time || new Date().toISOString(),
      roomId: msg.roomId
    })
    return
  }
  try {
    const rawRoomKey = toRaw(roomKey.value)
    const exported = await crypto.subtle.exportKey("raw", rawRoomKey);
    const hashArray = await crypto.subtle.digest("SHA-1", exported);
    
    const text = await e2ee.decryptMessage(rawRoomKey, payload.encrypted)
    
    // Remove the "[waiting for key]" message if it exists
    if (msg.id) {
       chat.messages = chat.messages.filter(m => m.id !== msg.id);
    }

    chat.pushMessage({
      id: msg.id,
      display: `${payload.senderDisplayName || msg.senderId}: ${text}`,
      time: msg.time || new Date().toISOString(),
      roomId: msg.roomId
    })
  } catch (e) {
    //Error Catching for Chat Messages
    chat.pushMessage({
      id: msg.id,
      display: `⚠️ Failed to decrypt from ${msg.senderId}`,
      time: new Date().toISOString(),
      roomId: msg.roomId
    })
  }
}

async function handleHandshake(msg: ProtocolMessage) {
  if (msg.senderId === chat.myId) return

  const payload = msg.payload as HandshakePayload
  const alreadyHadSharedKey = kxState.value.sharedKeys.has(msg.senderId)
  const { sharedKey, decryptedRoomKey } = await keyExchange.processIncomingPublicKey(toRaw(kxState.value), msg.senderId, payload.publicKey)
  
  if (!alreadyHadSharedKey) {
    const myPubKey = await keyExchange.getMyPublicKey(toRaw(kxState.value))
    await signalR.sendDirectMessage(msg.senderId, {
      type: 'handshake',
      senderId: chat.myId,
      roomId: roomId.value,
      payload: { publicKey: myPubKey } as HandshakePayload
    })
  }
  
  if (decryptedRoomKey && kxState.value.roomKey) {
     await setRoomKey(toRaw(kxState.value.roomKey), msg.senderId)
  } else if (!roomKey.value && kxState.value.roomKey) {
     await setRoomKey(toRaw(kxState.value.roomKey), msg.senderId)
  }

  // Reload roomKey value from state just in case it was updated above
  const currentRoomKey = roomKey.value || (kxState.value.roomKey ? toRaw(kxState.value.roomKey) : null);

  if (sharedKey && currentRoomKey) {
    // Only share the room key if it's the first time we establish a shared key with them.
    if (!alreadyHadSharedKey) {
      // We have the room key, send it to the new peer
      const encryptedRoomKey = await keyExchange.buildEncryptedRoomKey(toRaw(kxState.value), sharedKey, toRaw(currentRoomKey))
      await signalR.sendDirectMessage(msg.senderId, {
        type: 'identity', // using identity type for room key exchange
        senderId: chat.myId,
        roomId: roomId.value,
        payload: encryptedRoomKey
      })
    }
  }
}

async function handleIdentity(msg: ProtocolMessage) {
  // This is where we receive the encrypted room key
  const success = await keyExchange.tryDecryptRoomKey(toRaw(kxState.value), msg.payload as any, msg.senderId)
  if (success && kxState.value.roomKey) {
    await setRoomKey(toRaw(kxState.value.roomKey), msg.senderId)
    pushSystem('Secure channel established.')
  }
}

async function handleRoomHistory(messages: any[]) {
  if (!roomKey.value) {
    //No Room Key, ignoring history
    return
  }
  const rawRoomKey = toRaw(roomKey.value)
  
  chat.messages = chat.messages.filter(m => m.display.startsWith('[System]:'));

  for (const msg of messages) {
    try {
      const payload = JSON.parse(msg.encryptedPayload) as ChatPayload
      const text = await e2ee.decryptMessage(rawRoomKey, payload.encrypted)
      chat.pushMessage({
        id: msg.id,
        display: `${payload.senderDisplayName || msg.senderId}: ${text}`,
        time: msg.createdAt,
        roomId: msg.roomId
      })
    } catch (e) {
      //Error Catching for Room History
    }
  }
}

async function send() {
  if (!messageText.value.trim()) return
  
  // If we don't have a key yet, generate one (we are likely the first active user)
  if (!roomKey.value) {
     const newKey = await e2ee.generateRoomKey()
     await setRoomKey(newKey)
     pushSystem('New room key generated.')
     
     // Share Key with existing peers
     for (const [peerId, sharedKey] of kxState.value.sharedKeys.entries()) {
        const encryptedRoomKey = await keyExchange.buildEncryptedRoomKey(toRaw(kxState.value), sharedKey, toRaw(newKey))
        await signalR.sendDirectMessage(peerId, {
          type: 'identity',
          senderId: chat.myId,
          roomId: roomId.value,
          payload: encryptedRoomKey
        })
     }
  }

  const rawRoomKey = toRaw(roomKey.value!)
  const exported = await crypto.subtle.exportKey("raw", rawRoomKey);
  const hashArray = await crypto.subtle.digest("SHA-1", exported);
  const thumbprint = btoa(String.fromCharCode(...new Uint8Array(hashArray))).substring(0, 8);

  const encrypted = await e2ee.encryptMessage(rawRoomKey, messageText.value.trim())
  const payload: ChatPayload = {
    senderDisplayName: chat.displayName,
    encrypted
  }

  await signalR.sendMessage({
    type: 'chat',
    senderId: chat.myId,
    roomId: roomId.value,
    payload
  })

  messageText.value = ''
  resetTyping()
}

function resetTyping() {
  if (typingTimeout) clearTimeout(typingTimeout)
  typingTimeout = null
  signalR.sendMessage({
    type: 'typing',
    senderId: chat.myId,
    senderDisplayName: chat.displayName,
    roomId: roomId.value,
    payload: { isTyping: false }
  })
}

function onTyping() {
  if (typingTimeout) clearTimeout(typingTimeout)
  signalR.sendMessage({
    type: 'typing',
    senderId: chat.myId,
    senderDisplayName: chat.displayName,
    roomId: roomId.value,
    payload: { isTyping: true }
  })
  typingTimeout = setTimeout(() => {
    signalR.sendMessage({
      type: 'typing',
      senderId: chat.myId,
      senderDisplayName: chat.displayName,
      roomId: roomId.value,
      payload: { isTyping: false }
    })
  }, 2000)
}

function broadcastPresence(status: 'online' | 'offline') {
  signalR.sendMessage({
    type: 'presence',
    senderId: chat.myId,
    roomId: roomId.value,
    payload: { status, displayName: chat.displayName } as PresencePayload
  })
}

function getRoomDisplayName(rId: string) {
  if (rId.startsWith('dm:')) {
    const parts = rId.split(':')
    const otherUser = parts.find(p => p !== 'dm' && p !== chat.myId)
    if (!otherUser) return 'Direct Chat'
    return chat.roomPresence[otherUser]?.displayName || otherUser
  }
  return rId
}

function getSenderDisplayName(msg: any) {
  const parts = msg.display.split(':')
  const senderId = parts[0]
  if (senderId.startsWith('[System]')) return '[System]'
  
  if (senderId === chat.myId) return chat.displayName
  return chat.roomPresence[senderId]?.displayName || senderId
}

function getMessageContent(msg: any) {
  if (msg.display.startsWith('[System]:')) {
    return msg.display.substring(10)
  }
  const parts = msg.display.split(':')
  if (parts.length > 1) {
    return parts.slice(1).join(':').trim()
  }
  return msg.display
}

async function handleLogout() {
  await chat.clearIdentity()
  router.push('/login')
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(['de'], { hour: '2-digit', minute: '2-digit' })
}

function pushSystem(text: string) {
  chat.pushMessage({
    display: `[System]: ${text}`,
    time: new Date().toISOString(),
    roomId: roomId.value
  })
}
</script>
