<template>
  <div class="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <h2 class="mt-10 text-center text-2xl/9 font-bold tracking-tight text-white">Chat Messenger</h2>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <div class="space-y-6">
          <label for="email" class="block text-sm/6 font-medium text-gray-100">Anzeigename</label>
          <div class="mt-2">
            <input v-model="displayName" @keyup.enter="handleConnect" type="text" name="displayName" id="displayName" autocomplete="" required class="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6" />
          </div>
        </div>

        <div class="mt-6">
          <button @click="handleConnect" :disabled="!displayName" class="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-1.5 text-sm/6 font-semibold text-white hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">Sign in</button>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat'

const displayName = ref('')
const router = useRouter()
const chat = useChatStore()

async function handleConnect() {
  if (displayName.value) {
    const randomId = 'user_' + Math.random().toString(36).substring(2, 9) + Math.floor(Math.random() * 1000);
    chat.saveIdentity(randomId, displayName.value)
    router.push('/')
  }
}
</script>
