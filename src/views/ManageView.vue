<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import BottomSheet from '../components/BottomSheet.vue'
import { useStore } from '../composables/useStore'
import { useMetronome } from '../composables/useMetronome'
import { confirmDialog, toast } from '../composables/useUi'
import { clampBpm, formatDuration } from '../lib/util'
import { BPM_MAX, BPM_MIN, SUBDIVISION_LABEL, type Menu, type Subdivision } from '../types'

const store = useStore()
const { state } = store
const { isPlaying } = useMetronome()

const stats = computed(() => {
  const map = new Map<string, { count: number; sec: number; best: number }>()
  for (const l of state.logs) {
    const s = map.get(l.menuId) ?? { count: 0, sec: 0, best: 0 }
    s.count++
    s.sec += l.durationSeconds
    s.best = Math.max(s.best, l.bpm)
    map.set(l.menuId, s)
  }
  return map
})

// ---- 追加・編集シート ----
const sheetOpen = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({ name: '', targetBpm: 120, lastBpm: 80, subdivision: 'quarter' as Subdivision })
const subs: Subdivision[] = ['quarter', 'eighth', 'sixteenth']

function openNew() {
  editingId.value = null
  Object.assign(form, { name: '', targetBpm: 120, lastBpm: 80, subdivision: 'quarter' })
  sheetOpen.value = true
}
function openEdit(m: Menu) {
  editingId.value = m.id
  Object.assign(form, { name: m.name, targetBpm: m.targetBpm, lastBpm: m.lastBpm, subdivision: m.subdivision })
  sheetOpen.value = true
}

const canSave = computed(() => form.name.trim().length > 0)

async function saveMenu() {
  if (!canSave.value) return
  const data = {
    name: form.name.trim(),
    targetBpm: clampBpm(form.targetBpm),
    lastBpm: clampBpm(form.lastBpm),
    subdivision: form.subdivision,
  }
  if (editingId.value) {
    await store.updateMenu(editingId.value, data)
    toast('メニューを更新しました')
  } else {
    await store.addMenu(data)
    toast('メニューを追加しました')
  }
  sheetOpen.value = false
}

async function removeMenu() {
  const id = editingId.value
  if (!id) return
  const n = stats.value.get(id)?.count ?? 0
  const ok = await confirmDialog({
    title: `「${form.name}」を削除しますか？`,
    message: n ? `このメニューの練習ログ ${n} 件も一緒に削除されます。\nこの操作は取り消せません。` : 'この操作は取り消せません。',
    okLabel: '削除',
    danger: true,
  })
  if (!ok) return
  await store.deleteMenu(id)
  sheetOpen.value = false
  toast('削除しました')
}

// ---- バックアップ ----
function pad(n: number) {
  return String(n).padStart(2, '0')
}

function exportJson() {
  const data = store.exportData()
  const d = new Date()
  const name = `guitar-practice-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast('エクスポートしました')
}

const fileInput = ref<HTMLInputElement | null>(null)
async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (isPlaying.value) {
    toast('練習中はインポートできません')
    return
  }
  let parsed: ReturnType<typeof store.parseBackup>
  try {
    parsed = store.parseBackup(JSON.parse(await file.text()))
  } catch (err) {
    await confirmDialog({ title: '読み込めませんでした', message: err instanceof Error ? err.message : String(err), okLabel: '閉じる' })
    return
  }
  const ok = await confirmDialog({
    title: 'データを上書きしますか？',
    message:
      `読み込むデータ：メニュー ${parsed.menus.length} 件・ログ ${parsed.logs.length} 件\n` +
      `現在のデータ（メニュー ${state.menus.length} 件・ログ ${state.logs.length} 件）はすべて置き換えられます。`,
    okLabel: '上書きする',
    danger: true,
  })
  if (!ok) return
  await store.importData(parsed)
  toast('インポートしました')
}
</script>

<template>
  <div class="space-y-6 px-4 pt-4 pb-8">
    <h1 class="text-xl font-black text-zinc-100">メニュー管理・設定</h1>

    <!-- メニュー一覧 -->
    <section>
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-bold text-zinc-300">練習メニュー</h2>
        <span class="text-xs text-zinc-600">タップで編集</span>
      </div>
      <ul class="space-y-2">
        <li v-for="m in state.menus" :key="m.id">
          <button class="flex w-full items-center gap-3 rounded-2xl bg-zinc-900 px-4 py-3 text-left active:bg-zinc-800" @click="openEdit(m)">
            <div class="min-w-0 flex-1">
              <div class="truncate font-bold text-zinc-100">{{ m.name }}</div>
              <div class="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                <span>前回 <b class="text-zinc-300">{{ m.lastBpm }}</b></span>
                <span>目標 <b class="text-amber-400">{{ m.targetBpm }}</b></span>
                <span>{{ SUBDIVISION_LABEL[m.subdivision] }}</span>
                <span v-if="stats.get(m.id)">{{ stats.get(m.id)!.count }}回 / {{ formatDuration(stats.get(m.id)!.sec) }}</span>
              </div>
            </div>
            <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0 text-zinc-600" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        </li>
      </ul>
      <button class="mt-3 h-14 w-full rounded-2xl border border-dashed border-emerald-500/40 font-bold text-emerald-400 active:bg-emerald-500/10" @click="openNew">
        ＋ 新しいメニュー
      </button>
    </section>

    <!-- バックアップ -->
    <section class="rounded-2xl bg-zinc-900 p-4">
      <h2 class="text-sm font-bold text-zinc-300">データバックアップ</h2>
      <p class="mt-1 text-xs leading-relaxed text-zinc-500">
        データはこの端末のブラウザ内だけに保存されています。キャッシュ削除や機種変更に備えて、定期的にエクスポートしてください。
      </p>
      <div class="mt-2 text-xs text-zinc-500">現在：メニュー {{ state.menus.length }} 件・ログ {{ state.logs.length }} 件</div>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <button class="h-14 rounded-xl bg-emerald-500 font-bold text-zinc-950 active:opacity-80" @click="exportJson">エクスポート</button>
        <button class="h-14 rounded-xl border border-zinc-700 font-bold text-zinc-200 active:bg-zinc-800" @click="fileInput?.click()">インポート</button>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="onImportFile" />
    </section>

    <p class="text-center text-xs text-zinc-700">ギター練習ログ v1.0 · オフライン対応</p>

    <!-- 追加・編集シート -->
    <BottomSheet :open="sheetOpen" :title="editingId ? 'メニューを編集' : '新しいメニュー'" @close="sheetOpen = false">
      <form class="space-y-4" @submit.prevent="saveMenu">
        <label class="block">
          <span class="mb-1 block text-xs text-zinc-500">メニュー名</span>
          <input
            v-model="form.name"
            type="text"
            maxlength="40"
            placeholder="例：16分クロマチック"
            class="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
          />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1 block text-xs text-zinc-500">目標BPM</span>
            <input
              v-model.number="form.targetBpm"
              type="number"
              inputmode="numeric"
              :min="BPM_MIN"
              :max="BPM_MAX"
              class="tabular h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 outline-none focus:border-amber-500"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-zinc-500">開始BPM（前回）</span>
            <input
              v-model.number="form.lastBpm"
              type="number"
              inputmode="numeric"
              :min="BPM_MIN"
              :max="BPM_MAX"
              class="tabular h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>
        </div>
        <div>
          <span class="mb-1 block text-xs text-zinc-500">デフォルトの拍分割</span>
          <div class="grid grid-cols-3 rounded-xl bg-zinc-950 p-1">
            <button
              v-for="s in subs"
              :key="s"
              type="button"
              class="h-10 rounded-lg text-sm font-bold"
              :class="form.subdivision === s ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-500'"
              @click="form.subdivision = s"
            >
              {{ SUBDIVISION_LABEL[s] }}
            </button>
          </div>
        </div>
        <button type="submit" class="h-14 w-full rounded-2xl bg-emerald-500 text-lg font-black text-zinc-950 active:opacity-80 disabled:opacity-40" :disabled="!canSave">
          {{ editingId ? '更新する' : '追加する' }}
        </button>
        <button
          v-if="editingId"
          type="button"
          class="h-12 w-full rounded-2xl text-sm font-bold text-rose-400 active:bg-rose-950/50 disabled:opacity-40"
          :disabled="isPlaying"
          @click="removeMenu"
        >
          このメニューを削除
        </button>
      </form>
    </BottomSheet>
  </div>
</template>
