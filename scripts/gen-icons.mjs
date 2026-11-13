// 依存なしで PWA アイコン PNG を生成する（ピック形のロゴ + ビート点）
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [9, 9, 11]
const PICK = [16, 185, 129]
const DOT = [251, 191, 36]

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, rgb) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// 三角形の符号付き距離（Inigo Quilez）
const dot = (a, b) => a[0] * b[0] + a[1] * b[1]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
function sdTri(p, p0, p1, p2) {
  const e = [sub(p1, p0), sub(p2, p1), sub(p0, p2)]
  const v = [sub(p, p0), sub(p, p1), sub(p, p2)]
  const s = Math.sign(e[0][0] * e[2][1] - e[0][1] * e[2][0])
  let dmin = Infinity
  let smin = Infinity
  for (let i = 0; i < 3; i++) {
    const t = clamp(dot(v[i], e[i]) / dot(e[i], e[i]), 0, 1)
    const pq = [v[i][0] - e[i][0] * t, v[i][1] - e[i][1] * t]
    dmin = Math.min(dmin, dot(pq, pq))
    smin = Math.min(smin, s * (v[i][0] * e[i][1] - v[i][1] * e[i][0]))
  }
  return -Math.sqrt(dmin) * Math.sign(smin)
}

/** scale: ロゴの大きさ（maskable は安全領域内に収めるため小さめ） */
function render(size, scale) {
  const rgb = Buffer.alloc(size * size * 3)
  const SS = 4
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // -1..1 座標 → ロゴ座標
          const u = (((x + (sx + 0.5) / SS) / size) * 2 - 1) / scale
          const v = (((y + (sy + 0.5) / SS) / size) * 2 - 1) / scale
          let c = BG
          const pick = sdTri([u, v], [-0.52, -0.45], [0.52, -0.45], [0, 0.62]) - 0.3
          if (pick < 0) c = PICK
          const dd = Math.hypot(u, v + 0.12) - 0.17
          if (dd < 0) c = DOT
          acc[0] += c[0]
          acc[1] += c[1]
          acc[2] += c[2]
        }
      }
      const i = (y * size + x) * 3
      rgb[i] = acc[0] / (SS * SS)
      rgb[i + 1] = acc[1] / (SS * SS)
      rgb[i + 2] = acc[2] / (SS * SS)
    }
  }
  return png(size, rgb)
}

mkdirSync('public', { recursive: true })
writeFileSync('public/pwa-192.png', render(192, 0.82))
writeFileSync('public/pwa-512.png', render(512, 0.82))
writeFileSync('public/apple-touch-icon.png', render(180, 0.72))
writeFileSync('public/maskable-512.png', render(512, 0.6))
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#09090b"/><path d="M32 8c13 0 22 2 22 11 0 8-12 25-17 32-3 4-7 4-10 0C22 44 10 27 10 19 10 10 19 8 32 8Z" fill="#10b981"/><circle cx="32" cy="26" r="6" fill="#fbbf24"/></svg>\n`,
)
console.log('icons generated')
