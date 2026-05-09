<template>
  <div class="flex grow flex-col gap-y-5 overflow-y-auto bg-gray-900 px-6 pb-2 ring-1 ring-white/10 before:pointer-events-none before:absolute before:inset-0 before:bg-black/10 lg:border-r lg:border-white/10 lg:bg-black/10">
    <nav class="flex flex-1 flex-col mt-16">
      <ul role="list" class="flex flex-1 flex-col gap-y-7">
        <li>
          <ul role="list" class="-mx-2 space-y-1">
            <li v-for="item in navigation" :key="item.name">
              <router-link
                :to="item.href"
                :class="[item.current ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white','group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold']">
                <component :is="item.icon" class="size-6 shrink-0" aria-hidden="true" />
                {{ item.name }}
              </router-link>
            </li>
          </ul>
        </li>
        <li>
          <div class="text-xs/6 font-semibold text-gray-400">Deine Räume</div>
          <ul role="list" class="-mx-2 mt-2 space-y-1">
            <li v-for="room in userRooms" :key="room.id">
              <router-link
                :to="'/chat/' + room.id"
                :class="[room.current ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white','group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold']">
                <span class="flex size-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gray-800 text-[0.625rem] font-medium text-gray-400 group-hover:border-white/20 group-hover:text-white">
                  {{ room.initial }}
                </span>
                <span class="truncate">{{ room.name }}</span>
              </router-link>
            </li>
          </ul>
        </li>
        <li class="-mx-6 mt-auto">
          <div class="flex items-center justify-between gap-x-4 px-6 py-3 text-sm/6 font-semibold text-white">
            <div class="flex items-center gap-x-4">
              <UserIcon class="text-white h-5"></UserIcon>
              <span class="sr-only">Dein Profil</span>
              <div class="flex flex-col">
                <span aria-hidden="true">{{ displayName }}</span>
              </div>
            </div>
            <button @click="$emit('logout')" type="button" class="rounded-md bg-red-500 px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
              <ArrowRightEndOnRectangleIcon class="h-5" />
            </button>
          </div>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script setup>
import { HomeIcon, ChatBubbleLeftRightIcon, ArrowRightEndOnRectangleIcon, UserIcon } from '@heroicons/vue/24/outline'

defineProps({
  navigation: {
    type: Array,
    default: () => [
      { name: 'Dashboard', href: '/', icon: HomeIcon, current: true },
    ]
  },
  userRooms: {
    type: Array,
    default: () => []
  },
  displayName: String
})

defineEmits(['logout'])
</script>
