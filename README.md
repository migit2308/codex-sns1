# codex-sns1

Codexを利用してSNS風Webアプリを開発するプロジェクトです。
現在はViteとReactで「Hello World」を表示するフロントエンドを用意しています。

## 前提環境

- Node.js 22.12以降の22系、または24系（動作確認：22.20.0）
- npm（動作確認：10.9.3。Node.jsと一緒にインストールされます）

## フロントエンドの起動

リポジトリのルートから実行します。

```sh
cd frontend
npm ci
npm run dev
```

ブラウザで http://127.0.0.1:5173 を開くと「Hello World」が表示されます。
サーバーはこのPCからだけアクセスできる設定です。
停止するには、起動したターミナルで `Ctrl+C` を押します。
5173番ポートが使用中の場合は、既存のサーバーを停止してから再実行してください。

- `npm ci`：`package-lock.json` に記録されたバージョンで依存ライブラリを導入します。初回や依存関係が変わったときに実行します。
- `npm run dev`：開発用サーバーを起動します。ソースを保存すると画面に変更が反映されます。
- `npm run build`：配布用のHTML・JavaScript・CSSを `frontend/dist/` に生成します。
- `npm run preview`：ビルド済みの画面をローカルで確認します。先に `npm run build` を実行し、ターミナルに表示されたURLを開きます。本番運用用のサーバーではありません。

## 構成と編集箇所

| ファイル | 役割 |
| --- | --- |
| `frontend/index.html` | ブラウザが最初に読み込むHTML。Reactを表示する場所を用意します。 |
| `frontend/src/main.jsx` | Reactを起動し、画面をHTMLに組み込みます。 |
| `frontend/src/App.jsx` | 画面の内容。「Hello World」の文字を変えるときはここを編集します。 |
| `frontend/src/style.css` | 文字の色や余白など、見た目を指定します。 |
| `frontend/vite.config.js` | Reactの変換や開発サーバーの設定です。 |
| `frontend/package.json` | コマンドと直接利用するライブラリを定義します。 |
| `frontend/package-lock.json` | 間接的な依存関係も含め、インストールするバージョンを記録します。 |

今回はJavaScriptを使用しています。`.jsx` は、JavaScriptの中にHTMLに似た画面の記述（JSX）を書けるファイルです。

## バージョン方針

Vite 8.3.4、React / React DOM 19.3.1、React用Viteプラグイン6.1.2を採用しています。
正式リリースを使用し、beta・RC・canaryや実験的機能は採用しません。
直接依存は固定し、ロックファイルもGit管理して環境を再現します。更新時にはビルドとブラウザ表示を確認します。

- [Viteのリリース・サポート方針](https://vite.dev/releases)
- [Reactのバージョン情報](https://react.dev/versions)

## 作業範囲

[Issue #1](https://github.com/migit2308/codex-sns1/issues/1)のフロントエンド初期構築に対応しています。
FastAPI・uv・SQLiteの環境構築とAPI連携は今後の作業です。
