import { computed, reactive } from 'vue'
import * as db from '../lib/db'
import { clampBpm, uuid } from '../lib/util'
import type { BackupData, Log, Menu, Subdivision } from '../types'

const state = reactive({
  ready: false,
  menus: [] as Menu[],
  logs: [] as Log[],
})

const SAMPLE_MENUS: Array<Pick<Menu, 'name' | 'lastBpm' | 'targetBpm' | 'subdivision'>> = [
  { name: '16分クロマチック', lastBpm: 80, targetBpm: 120, subdivision: 'sixteenth' },
  { name: 'オルタネイトピッキング', lastBpm: 90, targetBpm: 140, subdivision: 'eighth' },
  { name: 'コードチェンジ C→G→Am→F', lastBpm: 70, targetBpm: 100, subdivision: 'quarter' },
]

let initPromise: Promise<void> | null = null

export function initStore() {
  if (!initPromise) {
    initPromise = (async () => {
      const { menus, logs, seeded } = await db.loadAll()
      if (!seeded && menus.length === 0) {
        const base = Date.now()
        for (const [i, s] of SAMPLE_MENUS.entries()) {
          const m: Menu = { id: uuid(), createdAt: new Date(base + i).toISOString(), ...s }
          await db.putMenu(m)
          menus.push(m)
        }
        await db.markSeeded()
      }
      state.menus = menus.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      state.logs = logs.sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
      state.ready = true
      // ストレージ自動削除を避けるため永続化をリクエスト（未対応ブラウザは無視）
      navigator.storage?.persist?.().catch(() => {})
    })()
  }
  return initPromise
}

async function addMenu(input: { name: string; targetBpm: number; lastBpm?: number; subdivision: Subdivision }) {
  const m: Menu = {
    id: uuid(),
    name: input.name.trim(),
    targetBpm: clampBpm(input.targetBpm),
    lastBpm: clampBpm(input.lastBpm ?? 80),
    subdivision: input.subdivision,
    createdAt: new Date().toISOString(),
  }
  await db.putMenu(m)
  state.menus.push(m)
  return m
}

async function updateMenu(id: string, patch: Partial<Omit<Menu, 'id' | 'createdAt'>>) {
  const m = state.menus.find((x) => x.id === id)
  if (!m) return
  Object.assign(m, patch)
  await db.putMenu(m)
}

async function deleteMenu(id: string) {
  await db.removeMenu(id)
  state.menus = state.menus.filter((m) => m.id !== id)
  state.logs = state.logs.filter((l) => l.menuId !== id)
}

async function addLog(input: Omit<Log, 'id' | 'practicedAt'> & { practicedAt?: string }) {
  const l: Log = { id: uuid(), practicedAt: input.practicedAt ?? new Date().toISOString(), ...input }
  await db.putLog(l)
  state.logs.push(l)
  return l
}

async function deleteLog(id: string) {
  await db.removeLog(id)
  state.logs = state.logs.filter((l) => l.id !== id)
}

function exportData(): BackupData {
  return {
    app: 'guitar-practice-pwa',
    version: 1,
    exportedAt: new Date().toISOString(),
    menus: JSON.parse(JSON.stringify(state.menus)),
    logs: JSON.parse(JSON.stringify(state.logs)),
  }
}

const SUBS: Subdivision[] = ['quarter', 'eighth', 'sixteenth']
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** JSON を検証して正規化。不正なら Error を投げる */
function parseBackup(raw: unknown): { menus: Menu[]; logs: Log[] } {
  if (!raw || typeof raw !== 'object') throw new Error('JSON の形式が正しくありません')
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.menus) || !Array.isArray(r.logs)) throw new Error('menus / logs が見つかりません')

  const menus: Menu[] = r.menus.map((x, i) => {
    const m = x as Record<string, unknown>
    if (!isStr(m.id) || !isStr(m.name)) throw new Error(`menus[${i}] の id / name が不正です`)
    return {
      id: m.id,
      name: m.name,
      lastBpm: clampBpm(isNum(m.lastBpm) ? m.lastBpm : 80),
      targetBpm: clampBpm(isNum(m.targetBpm) ? m.targetBpm : 120),
      subdivision: SUBS.includes(m.subdivision as Subdivision) ? (m.subdivision as Subdivision) : 'quarter',
      createdAt: isStr(m.createdAt) ? m.createdAt : new Date().toISOString(),
    }
  })
  const ids = new Set(menus.map((m) => m.id))
  const logs: Log[] = r.logs.map((x, i) => {
    const l = x as Record<string, unknown>
    if (!isStr(l.id) || !isStr(l.menuId) || !isNum(l.bpm) || !isNum(l.durationSeconds) || !isStr(l.practicedAt))
      throw new Error(`logs[${i}] の必須項目が不正です`)
    if (!ids.has(l.menuId)) throw new Error(`logs[${i}] が存在しないメニューを参照しています`)
    return {
      id: l.id,
      menuId: l.menuId,
      bpm: l.bpm,
      durationSeconds: l.durationSeconds,
      practicedAt: l.practicedAt,
      note: isStr(l.note) ? l.note : '',
    }
  })
  return { menus, logs }
}

async function importData(data: { menus: Menu[]; logs: Log[] }) {
  await db.replaceAll(data.menus, data.logs)
  state.menus = [...data.menus].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  state.logs = [...data.logs].sort((a, b) => a.practicedAt.localeCompare(b.practicedAt))
}

const menuById = computed(() => new Map(state.menus.map((m) => [m.id, m])))

export function useStore() {
  return {
    state,
    menuById,
    addMenu,
    updateMenu,
    deleteMenu,
    addLog,
    deleteLog,
    exportData,
    parseBackup,
    importData,
  }
}
