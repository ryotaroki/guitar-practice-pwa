<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bar, Chart as VChart } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import { COLORS } from '../lib/chart'
import { useStore } from '../composables/useStore'
import { confirmDialog, toast } from '../composables/useUi'
import { dateKey, formatDateTime, formatDuration, lastNDays, shortDate } from '../lib/util'

const { state, menuById, deleteLog } = useStore()

const menuId = ref<string | null>(null)
watch(
  () => state.menus.map((m) => m.id).join(),
  () => {
    if (!state.menus.find((m) => m.id === menuId.value)) menuId.value = state.menus[0]?.id ?? null
  },
  { immediate: true },
)
const menu = computed(() => (menuId.value ? menuById.value.get(menuId.value) : undefined))
const menuLogs = computed(() => state.logs.filter((l) => l.menuId === menuId.value))

// ---- サマリー ----
const summary = computed(() => {
  const ls = menuLogs.value
  if (!ls.length) return null
  const best = Math.max(...ls.map((l) => l.bpm))
  const first = ls[0].bpm // state.logs は practicedAt 昇順
  const total = ls.reduce((s, l) => s + l.durationSeconds, 0)
  return { best, growth: best - first, total, sessions: ls.length }
})

// ---- 複合グラフ ----
const range = ref<'30' | 'all'>('30')
const daily = computed(() => {
  const map = new Map<string, { maxBpm: number; sec: number }>()
  for (const l of menuLogs.value) {
    const k = dateKey(l.practicedAt)
    const d = map.get(k)
    if (d) {
      d.maxBpm = Math.max(d.maxBpm, l.bpm)
      d.sec += l.durationSeconds
    } else map.set(k, { maxBpm: l.bpm, sec: l.durationSeconds })
  }
  return map
})

const comboData = computed(() => {
  const keys = range.value === '30' ? lastNDays(30) : [...daily.value.keys()].sort()
  const target = menu.value?.targetBpm ?? 0
  return {
    labels: keys.map(shortDate),
    datasets: [
      {
        type: 'line' as const,
        label: '最高BPM',
        data: keys.map((k) => daily.value.get(k)?.maxBpm ?? null),
        borderColor: COLORS.emerald,
        backgroundColor: COLORS.emerald,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.3,
        spanGaps: true,
        yAxisID: 'y',
        order: 1,
      },
      {
        type: 'line' as const,
        label: `目標 ${target}`,
        data: keys.map(() => target),
        borderColor: COLORS.rose,
        borderDash: [6, 5],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        yAxisID: 'y',
        order: 0,
      },
      {
        type: 'bar' as const,
        label: '練習時間(分)',
        data: keys.map((k) => {
          const s = daily.value.get(k)?.sec
          return s ? Math.round((s / 60) * 10) / 10 : null
        }),
        backgroundColor: COLORS.amberFill,
        borderRadius: 4,
        maxBarThickness: 18,
        yAxisID: 'y1',
        order: 2,
      },
    ],
  } as unknown as ChartData<'bar'>
})

const comboOptions: ChartOptions<'bar'> = {
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { position: 'bottom' } },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
    y: { position: 'left', title: { display: true, text: 'BPM' }, grace: '10%' },
    y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: '分' } },
  },
}

// ---- 全体ボリューム（14日） ----
const volumeData = computed<ChartData<'bar'>>(() => {
  const keys = lastNDays(14)
  const sum = new Map<string, number>()
  for (const l of state.logs) {
    const k = dateKey(l.practicedAt)
    sum.set(k, (sum.get(k) ?? 0) + l.durationSeconds)
  }
  return {
    labels: keys.map(shortDate),
    datasets: [
      {
        label: '総練習時間(分)',
        data: keys.map((k) => Math.round(((sum.get(k) ?? 0) / 60) * 10) / 10),
        backgroundColor: COLORS.emeraldFill,
        borderRadius: 4,
        maxBarThickness: 22,
      },
    ],
  }
})
const volumeTotal = computed(() => {
  const keys = new Set(lastNDays(14))
  return state.logs.filter((l) => keys.has(dateKey(l.practicedAt))).reduce((s, l) => s + l.durationSeconds, 0)
})
const volumeOptions: ChartOptions<'bar'> = {
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 8 } },
    y: { beginAtZero: true, title: { display: true, text: '分' } },
  },
}

// ---- 履歴 ----
const onlySelected = ref(false)
const limit = ref(30)
const history = computed(() => {
  const src = onlySelected.value ? menuLogs.value : state.logs
  return [...src].reverse()
})
const visibleHistory = computed(() => history.value.slice(0, limit.value))

async function removeLog(id: string) {
  const l = state.logs.find((x) => x.id === id)
  if (!l) return
  const ok = await confirmDialog({
    title: 'この記録を削除しますか？',
    message: `${formatDateTime(l.practicedAt)}\n${menuById.value.get(l.menuId)?.name ?? ''} / ${l.bpm} BPM / ${formatDuration(l.durationSeconds)}`,
    okLabel: '削除',
    danger: true,
  })
  if (!ok) return
  await deleteLog(id)
  toast('削除しました')
}
</script>

<template>
  <div class="space-y-5 px-4 pt-4 pb-8">
    <h1 class="text-xl font-black text-zinc-100">分析・履歴</h1>

    <div v-if="!state.menus.length" class="rounded-2xl bg-zinc-900 p-6 text-center text-sm text-zinc-500">メニューがありません</div>

    <template v-else>
      <!-- メニュー選択 -->
      <div class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button
          v-for="mm in state.menus"
          :key="mm.id"
          class="h-10 shrink-0 rounded-full border px-4 text-sm font-semibold whitespace-nowrap"
          :class="mm.id === menuId ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400'"
          @click="menuId = mm.id"
        >
          {{ mm.name }}
        </button>
      </div>

      <!-- サマリー -->
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-2xl bg-zinc-900 p-3">
          <div class="text-[11px] text-zinc-500">自己ベスト</div>
          <div class="tabular mt-1 text-2xl font-black text-emerald-400">{{ summary?.best ?? '—' }}</div>
          <div class="text-[11px] text-zinc-600">目標 {{ menu?.targetBpm }}</div>
        </div>
        <div class="rounded-2xl bg-zinc-900 p-3">
          <div class="text-[11px] text-zinc-500">初回からの伸び</div>
          <div class="tabular mt-1 text-2xl font-black" :class="(summary?.growth ?? 0) > 0 ? 'text-amber-400' : 'text-zinc-300'">
            {{ summary ? (summary.growth >= 0 ? '+' : '') + summary.growth : '—' }}
          </div>
          <div class="text-[11px] text-zinc-600">BPM</div>
        </div>
        <div class="rounded-2xl bg-zinc-900 p-3">
          <div class="text-[11px] text-zinc-500">累計練習</div>
          <div class="tabular mt-1 text-xl leading-8 font-black text-zinc-100">{{ summary ? formatDuration(summary.total) : '—' }}</div>
          <div class="text-[11px] text-zinc-600">{{ summary?.sessions ?? 0 }} 回</div>
        </div>
      </div>

      <!-- 複合グラフ -->
      <section class="rounded-2xl bg-zinc-900 p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-bold text-zinc-300">BPM と練習時間</h2>
          <div class="flex rounded-lg bg-zinc-950 p-0.5 text-xs font-bold">
            <button class="rounded-md px-3 py-1.5" :class="range === '30' ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-500'" @click="range = '30'">30日</button>
            <button class="rounded-md px-3 py-1.5" :class="range === 'all' ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-500'" @click="range = 'all'">全期間</button>
          </div>
        </div>
        <div v-if="menuLogs.length" class="h-64">
          <VChart type="bar" :data="comboData" :options="comboOptions" />
        </div>
        <p v-else class="py-12 text-center text-sm text-zinc-600">まだ記録がありません。練習タブで START してみましょう</p>
      </section>

      <!-- 全体ボリューム -->
      <section class="rounded-2xl bg-zinc-900 p-4">
        <div class="mb-3 flex items-baseline justify-between">
          <h2 class="text-sm font-bold text-zinc-300">全体の練習量（14日間）</h2>
          <span class="text-xs text-zinc-500">合計 {{ formatDuration(volumeTotal) }}</span>
        </div>
        <div class="h-44">
          <Bar :data="volumeData" :options="volumeOptions" />
        </div>
      </section>
    </template>

    <!-- 履歴 -->
    <section>
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-bold text-zinc-300">練習履歴</h2>
        <label class="flex items-center gap-2 text-xs text-zinc-500">
          <input v-model="onlySelected" type="checkbox" class="h-4 w-4 accent-emerald-500" />
          選択中のメニューのみ
        </label>
      </div>
      <p v-if="!history.length" class="rounded-2xl bg-zinc-900 p-6 text-center text-sm text-zinc-600">記録はまだありません</p>
      <ul v-else class="space-y-2">
        <li v-for="l in visibleHistory" :key="l.id" class="flex items-center gap-3 rounded-2xl bg-zinc-900 py-3 pr-2 pl-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 text-xs text-zinc-500">
              <span class="tabular">{{ formatDateTime(l.practicedAt) }}</span>
              <span class="truncate text-zinc-400">{{ menuById.get(l.menuId)?.name ?? '（削除済み）' }}</span>
            </div>
            <div class="mt-0.5 flex items-baseline gap-3">
              <span class="tabular text-lg font-black text-emerald-400">{{ l.bpm }}<span class="ml-0.5 text-xs font-bold text-zinc-500">BPM</span></span>
              <span class="tabular text-sm font-semibold text-amber-300">{{ formatDuration(l.durationSeconds) }}</span>
            </div>
            <p v-if="l.note" class="mt-0.5 truncate text-sm text-zinc-400">📝 {{ l.note }}</p>
          </div>
          <button class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 active:bg-rose-950 active:text-rose-400" aria-label="削除" @click="removeLog(l.id)">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
          </button>
        </li>
      </ul>
      <button v-if="history.length > limit" class="mt-3 h-11 w-full rounded-xl bg-zinc-900 text-sm text-zinc-400" @click="limit += 30">
        さらに表示（残り {{ history.length - limit }} 件）
      </button>
    </section>
  </div>
</template>
