<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BottomSheet from '../components/BottomSheet.vue'
import { useMetronome } from '../composables/useMetronome'
import { useStore } from '../composables/useStore'
import { toast } from '../composables/useUi'
import { clampBpm, formatClock } from '../lib/util'
import { BPM_MAX, BPM_MIN, SUBDIVISION_LABEL, type Subdivision } from '../types'

const emit = defineEmits<{ navigate: ['manage'] }>()
const { state, addLog, updateMenu } = useStore()
const m = useMetronome()

const SEL_KEY = 'gp-selected-menu'
const selectedId = ref<string | null>(safeGet(SEL_KEY))
const selected = computed(() => state.menus.find((x) => x.id === selectedId.value) ?? null)

function safeGet(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

// 選択中メニューが無効（削除・初回）なら先頭を選ぶ
watch(
  () => state.menus.map((x) => x.id).join(),
  () => {
    if (!selected.value && state.menus.length) selectedId.value = state.menus[0].id
  },
  { immediate: true },
)

// メニュー切り替え時（または管理画面での編集時）に lastBpm / subdivision をセット
watch(
  () => [selectedId.value, selected.value?.lastBpm, selected.value?.subdivision] as const,
  ([id]) => {
    try {
      if (id) localStorage.setItem(SEL_KEY, id)
    } catch {
      /* ignore */
    }
    if (selected.value && !m.isPlaying.value) {
      m.setBpm(selected.value.lastBpm)
      m.subdivision.value = selected.value.subdivision
    }
  },
  { immediate: true },
)

const subs: Subdivision[] = ['quarter', 'eighth', 'sixteenth']
const progress = computed(() => {
  if (!selected.value) return 0
  return Math.min(100, Math.round((m.bpm.value / selected.value.targetBpm) * 100))
})

// ---- 保存シート ----
const sheetOpen = ref(false)
const pending = ref<{ menuId: string; menuName: string; bpm: number; durationSeconds: number } | null>(null)
const note = ref('')
const saving = ref(false)

async function toggle() {
  if (m.isPlaying.value) {
    const sec = m.stop()
    if (sec >= 5 && selected.value) {
      pending.value = {
        menuId: selected.value.id,
        menuName: selected.value.name,
        bpm: m.bpm.value,
        durationSeconds: sec,
      }
      note.value = ''
      sheetOpen.value = true
    } else if (sec < 5) {
      toast('5秒未満のため記録しませんでした')
    }
  } else {
    await m.start()
  }
}

async function saveLog() {
  if (!pending.value || saving.value) return
  saving.value = true
  try {
    const p = pending.value
    const bpm = clampBpm(p.bpm)
    await addLog({ menuId: p.menuId, bpm, durationSeconds: p.durationSeconds, note: note.value.trim() })
    await updateMenu(p.menuId, { lastBpm: bpm })
    sheetOpen.value = false
    pending.value = null
    toast('記録を保存しました')
  } finally {
    saving.value = false
  }
}

async function discard() {
  sheetOpen.value = false
  pending.value = null
}

function onBpmInput(e: Event) {
  m.setBpm(Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="flex min-h-full flex-col px-4 pt-4 pb-4">
    <!-- メニュー選択 -->
    <section>
      <div class="mb-2 flex items-center justify-between">
        <h1 class="text-sm font-bold tracking-wider text-zinc-500">練習メニュー</h1>
        <span v-if="m.isPlaying.value" class="text-xs text-amber-400">練習中は変更できません</span>
      </div>
      <div v-if="state.menus.length" class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" :class="{ 'pointer-events-none opacity-50': m.isPlaying.value }">
        <button
          v-for="menu in state.menus"
          :key="menu.id"
          class="h-11 shrink-0 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors"
          :class="
            menu.id === selectedId
              ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
              : 'border-zinc-800 bg-zinc-900 text-zinc-400 active:bg-zinc-800'
          "
          @click="selectedId = menu.id"
        >
          {{ menu.name }}
        </button>
      </div>
      <button v-else class="h-11 w-full rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400" @click="emit('navigate', 'manage')">
        ＋ メニューを作成する
      </button>
    </section>

    <!-- BPM 表示 -->
    <section class="flex flex-1 flex-col items-center justify-center py-4">
      <!-- ビートインジケーター -->
      <div class="mb-6 flex gap-4">
        <span
          v-for="i in 4"
          :key="i"
          class="h-5 w-5 rounded-full transition-[background-color,box-shadow,transform] duration-75"
          :class="
            m.currentBeat.value === i - 1
              ? i === 1 && m.accent.value
                ? 'scale-125 bg-amber-400 shadow-[0_0_18px_4px_rgba(251,191,36,0.55)]'
                : 'scale-125 bg-emerald-400 shadow-[0_0_18px_4px_rgba(52,211,153,0.5)]'
              : 'bg-zinc-800'
          "
        />
      </div>

      <div class="flex items-baseline gap-2">
        <span class="tabular text-8xl leading-none font-black tracking-tight text-zinc-50">{{ m.bpm.value }}</span>
        <span class="text-lg font-bold text-zinc-500">BPM</span>
      </div>

      <div v-if="selected" class="mt-3 w-full max-w-xs">
        <div class="mb-1 flex justify-between text-xs text-zinc-500">
          <span>前回 {{ selected.lastBpm }}</span>
          <span>目標 <b class="text-amber-400">{{ selected.targetBpm }}</b></span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div class="h-full rounded-full transition-all" :class="progress >= 100 ? 'bg-amber-400' : 'bg-emerald-500'" :style="{ width: progress + '%' }" />
        </div>
      </div>

      <input type="range" :min="BPM_MIN" :max="BPM_MAX" :value="m.bpm.value" class="mt-5 w-full max-w-xs" aria-label="BPM" @input="onBpmInput" />

      <!-- 音設定 -->
      <div class="mt-5 flex w-full items-center gap-2">
        <div class="grid flex-1 grid-cols-3 rounded-xl bg-zinc-900 p-1">
          <button
            v-for="s in subs"
            :key="s"
            class="h-10 rounded-lg text-sm font-bold transition-colors"
            :class="m.subdivision.value === s ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-500'"
            @click="m.subdivision.value = s"
          >
            {{ SUBDIVISION_LABEL[s] }}
          </button>
        </div>
        <button
          class="h-12 shrink-0 rounded-xl border px-3 text-sm font-bold transition-colors"
          :class="m.accent.value ? 'border-amber-500/50 bg-amber-500/15 text-amber-300' : 'border-zinc-800 bg-zinc-900 text-zinc-500'"
          :aria-pressed="m.accent.value"
          @click="m.accent.value = !m.accent.value"
        >
          アクセント{{ m.accent.value ? 'ON' : 'OFF' }}
        </button>
      </div>
      <label class="mt-3 flex w-full items-center gap-3 text-xs text-zinc-500">
        音量
        <input v-model.number="m.volume.value" type="range" min="0" max="1" step="0.05" class="flex-1" />
      </label>
    </section>

    <!-- 親指ゾーン -->
    <section class="space-y-3">
      <div class="text-center">
        <span class="tabular font-mono text-4xl font-bold" :class="m.isPlaying.value ? 'text-amber-400' : 'text-zinc-600'">
          {{ formatClock(m.elapsedSec.value) }}
        </span>
      </div>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="d in [-5, -1, 1, 5]"
          :key="d"
          class="h-14 rounded-2xl bg-zinc-900 text-xl font-bold text-zinc-200 active:scale-95 active:bg-zinc-800"
          @click="m.setBpm(m.bpm.value + d)"
        >
          {{ d > 0 ? '+' + d : d }}
        </button>
      </div>
      <button
        class="h-20 w-full rounded-3xl text-2xl font-black tracking-widest transition-all active:scale-[0.98]"
        :class="
          m.isPlaying.value
            ? 'bg-rose-500 text-white shadow-[0_0_30px_rgba(244,63,94,0.35)]'
            : 'bg-emerald-500 text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
        "
        @click="toggle"
      >
        {{ m.isPlaying.value ? 'STOP' : 'START' }}
      </button>
    </section>

    <!-- 保存シート -->
    <BottomSheet :open="sheetOpen" title="練習を記録" persistent @close="discard">
      <div v-if="pending" class="space-y-4">
        <dl class="grid grid-cols-3 gap-2 text-center">
          <div class="col-span-3 rounded-xl bg-zinc-800/60 p-3 text-left">
            <dt class="text-xs text-zinc-500">メニュー</dt>
            <dd class="font-bold text-zinc-100">{{ pending.menuName }}</dd>
          </div>
          <div class="rounded-xl bg-zinc-800/60 p-3">
            <dt class="text-xs text-zinc-500">BPM</dt>
            <dd>
              <input
                v-model.number="pending.bpm"
                type="number"
                inputmode="numeric"
                :min="BPM_MIN"
                :max="BPM_MAX"
                class="tabular w-full bg-transparent text-center text-2xl font-black text-emerald-400 outline-none"
              />
            </dd>
          </div>
          <div class="col-span-2 rounded-xl bg-zinc-800/60 p-3">
            <dt class="text-xs text-zinc-500">練習時間</dt>
            <dd class="tabular text-2xl font-black text-amber-400">{{ formatClock(pending.durationSeconds) }}</dd>
          </div>
        </dl>
        <label class="block">
          <span class="mb-1 block text-xs text-zinc-500">1行メモ（任意）</span>
          <input
            v-model="note"
            type="text"
            maxlength="100"
            placeholder="例：小指のバタつきを意識"
            enterkeyhint="done"
            class="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
            @keydown.enter="saveLog"
          />
        </label>
        <div class="grid grid-cols-3 gap-3">
          <button class="h-14 rounded-2xl bg-zinc-800 font-semibold text-zinc-400 active:bg-zinc-700" @click="discard">破棄</button>
          <button class="col-span-2 h-14 rounded-2xl bg-emerald-500 text-lg font-black text-zinc-950 active:opacity-80 disabled:opacity-50" :disabled="saving" @click="saveLog">
            記録を保存
          </button>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>
