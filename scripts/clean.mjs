// dist を削除する。
// Node 24 の fs.rmSync({ recursive }) は Windows で日本語を含むパスだとクラッシュするため、
// ビルド前に1ファイルずつ消しておき、Vite の emptyOutDir が何もしなくて済むようにする。
import { existsSync, readdirSync, rmdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

function remove(p) {
  if (statSync(p).isDirectory()) {
    for (const f of readdirSync(p)) remove(join(p, f))
    rmdirSync(p)
  } else {
    unlinkSync(p)
  }
}

if (existsSync('dist')) remove('dist')
