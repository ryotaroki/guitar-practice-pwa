<script setup lang="ts">
import { onMounted, ref } from 'vue'
import TabBar, { type Tab } from './components/TabBar.vue'
import OverlayHost from './components/OverlayHost.vue'
import PracticeView from './views/PracticeView.vue'
import StatsView from './views/StatsView.vue'
import ManageView from './views/ManageView.vue'
import { initStore, useStore } from './composables/useStore'
import { useMetronome } from './composables/useMetronome'

const { state } = useStore()
const { isPlaying } = useMetronome()
const tab = ref<Tab>('practice')
const error = ref('')
const views = { practice: PracticeView, stats: StatsView, manage: ManageView }

onMounted(() => {
  initStore().catch((e) => {
    console.error(e)
    error.value = 'データベースを開けませんでした。プライベートブラウズでは保存できない場合があります。'
  })
})
</script>

<template>
  <div class="flex h-full flex-col bg-zinc-950 text-zinc-200">
    <main class="min-h-0 flex-1 overflow-y-auto pt-safe">
      <div class="mx-auto h-full max-w-lg">
        <p v-if="error" class="m-6 rounded-xl bg-rose-950 p-4 text-sm text-rose-200">{{ error }}</p>
        <div v-else-if="!state.ready" class="flex h-full items-center justify-center text-zinc-500">読み込み中…</div>
        <KeepAlive v-else>
          <component :is="views[tab]" @navigate="(t: Tab) => (tab = t)" />
        </KeepAlive>
      </div>
    </main>
    <TabBar v-model="tab" :playing="isPlaying" />
    <OverlayHost />
  </div>
</template>
