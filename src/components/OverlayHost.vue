<script setup lang="ts">
import { answerConfirm, ui } from '../composables/useUi'
</script>

<template>
  <Teleport to="body">
    <!-- 確認ダイアログ -->
    <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0 scale-95" leave-active-class="transition duration-100" leave-to-class="opacity-0">
      <div v-if="ui.confirm" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6" @click.self="answerConfirm(false)">
        <div class="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl" role="alertdialog">
          <h3 class="text-base font-bold text-zinc-100">{{ ui.confirm.title }}</h3>
          <p v-if="ui.confirm.message" class="mt-2 text-sm leading-relaxed whitespace-pre-line text-zinc-400">{{ ui.confirm.message }}</p>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <button class="h-12 rounded-xl bg-zinc-800 font-semibold text-zinc-200 active:bg-zinc-700" @click="answerConfirm(false)">キャンセル</button>
            <button
              class="h-12 rounded-xl font-bold active:opacity-80"
              :class="ui.confirm.danger ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-zinc-950'"
              @click="answerConfirm(true)"
            >
              {{ ui.confirm.okLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- トースト -->
    <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0 -translate-y-2" leave-active-class="transition duration-200" leave-to-class="opacity-0">
      <div
        v-if="ui.toast"
        :key="ui.toast.id"
        class="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center pt-safe"
      >
        <div class="mt-3 rounded-full border border-emerald-500/30 bg-zinc-900/95 px-5 py-2.5 text-sm font-semibold text-emerald-300 shadow-lg">
          {{ ui.toast.text }}
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
