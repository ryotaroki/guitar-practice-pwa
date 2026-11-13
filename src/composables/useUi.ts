import { reactive } from 'vue'

/** アプリ全体で 1 つの確認ダイアログとトーストを共有する */
export const ui = reactive({
  confirm: null as null | {
    title: string
    message: string
    okLabel: string
    danger: boolean
    resolve: (v: boolean) => void
  },
  toast: null as null | { text: string; id: number },
})

export function confirmDialog(opts: { title: string; message?: string; okLabel?: string; danger?: boolean }) {
  return new Promise<boolean>((resolve) => {
    ui.confirm?.resolve(false)
    ui.confirm = {
      title: opts.title,
      message: opts.message ?? '',
      okLabel: opts.okLabel ?? 'OK',
      danger: opts.danger ?? false,
      resolve,
    }
  })
}

export function answerConfirm(v: boolean) {
  ui.confirm?.resolve(v)
  ui.confirm = null
}

let toastTimer = 0
export function toast(text: string) {
  const id = Date.now()
  ui.toast = { text, id }
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    if (ui.toast?.id === id) ui.toast = null
  }, 2200)
}
