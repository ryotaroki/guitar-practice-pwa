import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Log, Menu } from '../types'

interface PracticeDB extends DBSchema {
  menus: { key: string; value: Menu }
  logs: { key: string; value: Log; indexes: { byMenu: string } }
  meta: { key: string; value: unknown }
}

let dbp: Promise<IDBPDatabase<PracticeDB>> | null = null

export function getDB() {
  if (!dbp) {
    dbp = openDB<PracticeDB>('guitar-practice', 1, {
      upgrade(db) {
        db.createObjectStore('menus', { keyPath: 'id' })
        const logs = db.createObjectStore('logs', { keyPath: 'id' })
        logs.createIndex('byMenu', 'menuId')
        db.createObjectStore('meta')
      },
    })
  }
  return dbp
}

/** Vue の Proxy は structured clone できないので素のオブジェクトにする */
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v))

export async function loadAll() {
  const db = await getDB()
  const [menus, logs, seeded] = await Promise.all([
    db.getAll('menus'),
    db.getAll('logs'),
    db.get('meta', 'seeded'),
  ])
  return { menus, logs, seeded: seeded === true }
}

export async function markSeeded() {
  const db = await getDB()
  await db.put('meta', true, 'seeded')
}

export async function putMenu(m: Menu) {
  await (await getDB()).put('menus', plain(m))
}

export async function putLog(l: Log) {
  await (await getDB()).put('logs', plain(l))
}

export async function removeLog(id: string) {
  await (await getDB()).delete('logs', id)
}

/** メニューと、そのメニューのログをまとめて削除 */
export async function removeMenu(id: string) {
  const db = await getDB()
  const tx = db.transaction(['menus', 'logs'], 'readwrite')
  const logStore = tx.objectStore('logs')
  const keys = await logStore.index('byMenu').getAllKeys(id)
  await Promise.all([tx.objectStore('menus').delete(id), ...keys.map((k) => logStore.delete(k))])
  await tx.done
}

/** 全データを置き換え（インポート用） */
export async function replaceAll(menus: Menu[], logs: Log[]) {
  const db = await getDB()
  const tx = db.transaction(['menus', 'logs', 'meta'], 'readwrite')
  const ms = tx.objectStore('menus')
  const ls = tx.objectStore('logs')
  await Promise.all([ms.clear(), ls.clear()])
  await Promise.all([
    ...plain(menus).map((m) => ms.put(m)),
    ...plain(logs).map((l) => ls.put(l)),
    tx.objectStore('meta').put(true, 'seeded'),
  ])
  await tx.done
}
