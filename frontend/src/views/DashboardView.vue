<template>
  <AppLayout
    title="Dashboard"
    :user-rooms="formattedRooms"
    :display-name="chat.displayName"
    @logout="handleLogout"
  >
    <div class="mx-auto max-w-4xl w-full">
      <div class="grid grid-cols-2 md:grid-cols-2 gap-8">
          <section class="p-6 bg-gray-800/50 border border-white/10 rounded-xl">
            <h3 class="text-lg font-semibold text-white mb-4">Raum beitreten/erstellen</h3>
            <div class="flex flex-col gap-4">
              <input
                v-model="roomInput"
                placeholder="Enter Room ID"
                @keyup.enter="goToRoom"
                class="w-full bg-gray-900 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
              <button @click="goToRoom" :disabled="!roomInput" class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                Raum beitreten
              </button>
              <p class="text-sm text-gray-400">Wenn der Raum (noch nicht) existiert, wird ein neuer Raum erstellt.</p>
            </div>
          </section>

          <section class="p-6 bg-gray-800/50 border border-white/10 rounded-xl">
            <h3 class="text-lg font-semibold text-white mb-4">Direct Chat</h3>
            <div class="flex flex-col gap-4">
              <input
                v-model="directChatInput"
                placeholder="Enter User ID"
                @keyup.enter="startDirectChat"
                class="w-full bg-gray-900 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
              <button @click="startDirectChat" :disabled="!directChatInput" class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                Start Chat
              </button>
              <p class="text-sm text-gray-400">Enter the other user's ID to start a private chat.</p>
            </div>
          </section>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat'
import { startConnection, getUserRooms, onUserRooms } from '../services/signalr'
import AppLayout from '../components/AppLayout.vue'

const roomInput = ref('')
const directChatInput = ref('')
const router = useRouter()
const chat = useChatStore()

const formattedRooms = computed(() => {
  return chat.userRooms.map(room => ({
    id: room.id,
    name: getRoomDisplayName(room.id),
    initial: getRoomDisplayName(room.id).charAt(0).toUpperCase(),
    current: false
  }))
})

onMounted(async () => {
  if (!chat.isConnected) {
    await startConnection(chat.myId)
    chat.isConnected = true
  }

  onUserRooms((rooms) => {
    chat.saveUserRooms(rooms)
  })

  await getUserRooms()
})

function goToRoom() {
  if (roomInput.value) {
    router.push(`/chat/${roomInput.value}`)
  }
}

function startDirectChat() {
  if (directChatInput.value && chat.myId) {
    const ids = [chat.myId, directChatInput.value].sort()
    const roomId = `dm:${ids[0]}:${ids[1]}`
    router.push(`/chat/${roomId}`)
  }
}

function getRoomDisplayName(rId: string) {
  if (rId.startsWith('dm:')) {
    const parts = rId.split(':')
    const otherUser = parts.find(p => p !== 'dm' && p !== chat.myId)
    return otherUser ? `Direct Chat with ${otherUser}` : 'Direct Chat'
  }
  return rId
}

async function handleLogout() {
  await chat.clearIdentity()
  router.push('/login')
}
</script>
