export type Subdivision = 'quarter' | 'eighth' | 'sixteenth'

export interface Menu {
  id: string
  name: string
  lastBpm: number
  targetBpm: number
  subdivision: Subdivision
  createdAt: string
}

export interface Log {
  id: string
  menuId: string
  bpm: number
  durationSeconds: number
  practicedAt: string
  note: string
}

export interface BackupData {
  app: 'guitar-practice-pwa'
  version: 1
  exportedAt: string
  menus: Menu[]
  logs: Log[]
}

export const SUBDIVISION_LABEL: Record<Subdivision, string> = {
  quarter: '4分',
  eighth: '8分',
  sixteenth: '16分',
}

export const SUBDIVISION_STEPS: Record<Subdivision, number> = {
  quarter: 1,
  eighth: 2,
  sixteenth: 4,
}

export const BPM_MIN = 20
export const BPM_MAX = 300
