<script setup lang="ts">
export type Tab = 'practice' | 'stats' | 'manage'
defineProps<{ playing: boolean }>()
const tab = defineModel<Tab>({ required: true })

const items: Array<{ id: Tab; label: string; icon: string }> = [
  // 簡易アイコン（SVG path）
  { id: 'practice', label: '練習', icon: 'M12 3 6 21h12L12 3Zm0 0v11m-3-5 6-2' },
  { id: 'stats', label: '分析', icon: 'M4 20V10m6 10V4m6 16v-7m4 7H2' },
  { id: 'manage', label: '管理', icon: 'M4 6h16M4 12h16M4 18h10' },
]
</script>

<template>
  <nav class="border-t border-zinc-800/80 bg-zinc-950/95 pb-safe backdrop-blur">
    <ul class="mx-auto grid max-w-lg grid-cols-3">
      <li v-for="it in items" :key="it.id">
        <button
          class="relative flex h-16 w-full flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors"
          :class="tab === it.id ? 'text-emerald-400' : 'text-zinc-500 active:text-zinc-300'"
          @click="tab = it.id"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path :d="it.icon" />
          </svg>
          {{ it.label }}
          <span
            v-if="it.id === 'practice' && playing && tab !== 'practice'"
            class="absolute top-2.5 right-[calc(50%-18px)] h-2 w-2 animate-pulse rounded-full bg-amber-400"
          />
        </button>
      </li>
    </ul>
  </nav>
</template>
