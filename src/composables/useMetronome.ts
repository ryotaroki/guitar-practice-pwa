import { ref, watch } from 'vue'
import { clampBpm } from '../lib/util'
import { SUBDIVISION_STEPS, type Subdivision } from '../types'

/**
 * Web Audio API の先読みスケジューリング方式メトロノーム（"A Tale of Two Clocks" 方式）。
 * - タイマー: Web Worker の setInterval(25ms)。メインスレッドの描画や操作で遅れても、
 *   AudioContext の時計で 120ms 先まで音を予約しているのでリズムはヨレない。
 * - 音: OscillatorNode の短いエンベロープで生成（音声ファイル不要）。
 * - 表示: 予約した拍のタイムスタンプをキューに積み、rAF で currentTime と照合して点灯。
 * モジュールスコープのシングルトンなので、タブを切り替えても再生・計測が継続する。
 */

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12
const BEATS_PER_BAR = 4

const bpm = ref(80)
const subdivision = ref<Subdivision>('quarter')
const accent = ref(loadBool('gp-accent', true))
const volume = ref(loadNum('gp-volume', 0.8))
const isPlaying = ref(false)
const currentBeat = ref(-1)
const elapsedSec = ref(0)

watch(accent, (v) => save('gp-accent', v))
watch(volume, (v) => {
  save('gp-volume', v)
  if (master && ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.01)
})

let ctx: AudioContext | null = null
let master: GainNode | null = null
let worker: Worker | null = null
let raf = 0
let nextBeatTime = 0
let beatIndex = 0
let startedAt = 0
let queue: Array<{ time: number; beat: number }> = []
let wakeLock: { release(): Promise<void> } | null = null

function loadBool(k: string, d: boolean) {
  try {
    const v = localStorage.getItem(k)
    return v === null ? d : v === '1'
  } catch {
    return d
  }
}
function loadNum(k: string, d: number) {
  try {
    const v = Number(localStorage.getItem(k))
    return localStorage.getItem(k) === null || !Number.isFinite(v) ? d : v
  } catch {
    return d
  }
}
function save(k: string, v: boolean | number) {
  try {
    localStorage.setItem(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v))
  } catch {
    /* ignore */
  }
}

function getWorker() {
  if (!worker) {
    const src = `let id=null;onmessage=e=>{if(e.data==='start'){clearInterval(id);id=setInterval(()=>postMessage(0),${LOOKAHEAD_MS})}else{clearInterval(id);id=null}}`
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })))
    worker.onmessage = tick
  }
  return worker
}

type ClickKind = 'accent' | 'beat' | 'sub'
const VOICE: Record<ClickKind, { freq: number; gain: number; decay: number }> = {
  accent: { freq: 1760, gain: 1.0, decay: 0.06 },
  beat: { freq: 1175, gain: 0.75, decay: 0.05 },
  sub: { freq: 880, gain: 0.32, decay: 0.035 },
}

function click(time: number, kind: ClickKind) {
  if (!ctx || !master) return
  const v = VOICE[kind]
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(v.freq, time)
  g.gain.setValueAtTime(0.0001, time)
  g.gain.exponentialRampToValueAtTime(v.gain, time + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, time + v.decay)
  osc.connect(g).connect(master)
  osc.start(time)
  osc.stop(time + v.decay + 0.01)
}

/** 1 拍ずつ予約。拍内の細分音もこのとき一緒に予約するので、設定変更は次の拍から反映される */
function scheduler() {
  if (!ctx) return
  while (nextBeatTime < ctx.currentTime + SCHEDULE_AHEAD) {
    const spb = 60 / bpm.value
    const steps = SUBDIVISION_STEPS[subdivision.value]
    for (let i = 0; i < steps; i++) {
      const kind: ClickKind = i > 0 ? 'sub' : beatIndex === 0 && accent.value ? 'accent' : 'beat'
      click(nextBeatTime + (i * spb) / steps, kind)
    }
    queue.push({ time: nextBeatTime, beat: beatIndex })
    nextBeatTime += spb
    beatIndex = (beatIndex + 1) % BEATS_PER_BAR
  }
}

function updateElapsed() {
  const s = Math.floor((Date.now() - startedAt) / 1000)
  if (s !== elapsedSec.value) elapsedSec.value = s
}

function tick() {
  if (!isPlaying.value) return
  scheduler()
  updateElapsed()
}

function draw() {
  if (!ctx || !isPlaying.value) return
  const now = ctx.currentTime
  while (queue.length && queue[0].time <= now) {
    currentBeat.value = queue.shift()!.beat
  }
  raf = requestAnimationFrame(draw)
}

async function requestWakeLock() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }
    if (nav.wakeLock && document.visibilityState === 'visible') wakeLock = await nav.wakeLock.request('screen')
  } catch {
    wakeLock = null
  }
}

async function start() {
  if (isPlaying.value) return
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC({ latencyHint: 'interactive' })
  }
  // ユーザー操作のハンドラ内で resume（iOS / Chrome の自動再生制限対策）
  if (ctx.state !== 'running') await ctx.resume()
  master = ctx.createGain()
  master.gain.value = volume.value
  master.connect(ctx.destination)

  queue = []
  beatIndex = 0
  nextBeatTime = ctx.currentTime + 0.08
  startedAt = Date.now()
  elapsedSec.value = 0
  isPlaying.value = true
  scheduler()
  getWorker().postMessage('start')
  raf = requestAnimationFrame(draw)
  requestWakeLock()
}

/** 停止して計測秒数を返す */
function stop(): number {
  if (!isPlaying.value) return 0
  updateElapsed()
  isPlaying.value = false
  worker?.postMessage('stop')
  cancelAnimationFrame(raf)
  // 予約済みの音を即ミュートして切り離す
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(0, ctx.currentTime)
    const m = master
    setTimeout(() => m.disconnect(), 100)
    master = null
  }
  queue = []
  currentBeat.value = -1
  wakeLock?.release().catch(() => {})
  wakeLock = null
  return Math.floor((Date.now() - startedAt) / 1000)
}

function setBpm(v: number) {
  bpm.value = clampBpm(v)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isPlaying.value) {
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {})
      requestWakeLock()
      updateElapsed()
    }
  })
}

export function useMetronome() {
  return { bpm, subdivision, accent, volume, isPlaying, currentBeat, elapsedSec, start, stop, setBpm }
}
