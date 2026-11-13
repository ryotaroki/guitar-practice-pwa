# ギター練習ログ（PWA）

Vue 3 + Vite + TypeScript + Tailwind CSS v4 + Chart.js + IndexedDB。サーバー不要。

## コマンド

```bash
npm install
npm run dev       # 開発サーバー（--host 付きなので同一LANのスマホからもアクセス可）
npm run build     # 型チェック + 本番ビルド（dist/）
npm run preview   # ビルド結果の確認（Service Worker 込み）
npm run icons     # public/ のアイコン PNG を再生成
```

## 構成

| パス | 役割 |
| --- | --- |
| `src/composables/useMetronome.ts` | Web Audio 先読みスケジューラ（Worker タイマー + 120ms 先読み）、計測タイマー、Wake Lock |
| `src/composables/useStore.ts` | メニュー/ログの状態管理、サンプル投入、インポート検証 |
| `src/lib/db.ts` | IndexedDB（`idb`）アクセス |
| `src/views/PracticeView.vue` | 練習画面（メトロノーム・タイマー・保存シート） |
| `src/views/StatsView.vue` | 分析・履歴（複合グラフ・14日ボリューム・タイムライン） |
| `src/views/ManageView.vue` | メニュー CRUD・JSON エクスポート/インポート |

## 公開（GitHub Pages）

`main` ブランチに push すると `.github/workflows/deploy.yml` が自動でビルドし、GitHub Pages に反映します。
初回のみ、リポジトリの Settings → Pages → Source を「GitHub Actions」にしてください。
スマホで開いているアプリは、次に起動したときに自動で新しい版へ更新されます。

## スマホで使うときの注意

- **Service Worker（オフライン起動・インストール）は HTTPS か localhost でしか動きません。**
  `http://192.168.x.x:5173` で開いた場合、アプリ自体は動きますが「ホーム画面に追加」してもオフラインでは起動しません。
  恒久的に使うなら `dist/` を HTTPS の静的ホスティング（URL を知っている人しか見られない場所）に置くのが手軽です。
- データは「開いた URL（オリジン）」ごとに別々に保存されます。URL を変えたらエクスポート → インポートで移行してください。
- iPhone はマナーモード（消音スイッチ）だと Web Audio の音が鳴らないことがあります。
