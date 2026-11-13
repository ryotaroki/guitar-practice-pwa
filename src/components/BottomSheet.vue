<script setup lang="ts">
defineProps<{ open: boolean; title?: string; persistent?: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]" @click="!persistent && emit('close')" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-250 ease-out"
      leave-active-class="transition-transform duration-200 ease-in"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-3xl border-t border-zinc-800 bg-zinc-900 px-5 pt-3 pb-safe shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-700" />
        <h2 v-if="title" class="mb-4 text-lg font-bold text-zinc-100">{{ title }}</h2>
        <slot />
        <div class="h-5" />
      </div>
    </Transition>
  </Teleport>
</template>
