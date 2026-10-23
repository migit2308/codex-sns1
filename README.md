# codex-sns1

旧Twitter風SNSをCodexで開発するプロジェクトです。
トップページから、SQLiteに事前投入した投稿を取得して表示します（Issue #2）。

PC向けの3カラム構成です。投稿本文・投稿者・表示日時・各件数を表示し、投稿一覧以外の機能は「準備中」で操作できません。
対応画面幅は1024px以上です。スマートフォン専用レイアウトはなく、それ未満では横スクロールします。

## 前提環境

- Node.js 22.12以降の22系、または24系
- npm（Node.jsに同梱）
- uvとPython 3.12系（uvが対応するPythonを用意できます）

依存の直接バージョンとロックファイルをGitで管理しています。

## 最初の起動

リポジトリのルートから、バックエンドを準備します。

```sh
cd backend
uv sync --locked
uv run --locked alembic upgrade head
uv run --locked python -m sns.seed
uv run --locked uvicorn sns.main:app --reload --host 127.0.0.1 --port 8000
```

- `uv sync --locked`：依存を導入し、`src/sns` を開発用パッケージとしてインストールします。
- `alembic upgrade head`：`backend/data/sns.db` に投稿テーブルと適用履歴を作成します。適用済みなら変更しません。
- `python -m sns.seed`：3件の確認用投稿を投入します。同じIDはスキップし、既存値を上書きしません。
- `uvicorn`：APIサーバーを起動します。起動するだけではDBの作成や初期データ投入を行いません。

別のターミナルでフロントエンドを起動します。

```sh
cd frontend
npm ci
npm run dev
```

[トップページ](http://127.0.0.1:5173/)を開くと、投稿が新しい順（同じ投稿日時なら投稿IDの大きい順）に表示されます。
停止するには、それぞれのターミナルで `Ctrl+C` を押します。ポートが使用中なら既存サーバーを確認してください。

## APIとデータ

| 接続先                                        | 用途                       |
| --------------------------------------------- | -------------------------- |
| ブラウザの `GET /api/posts`                   | Viteを経由した投稿一覧取得 |
| バックエンドの `GET /posts`                   | 認証なしの投稿一覧取得     |
| [APIドキュメント](http://127.0.0.1:8000/docs) | FastAPIが生成するAPI仕様   |

正常時はPostの8項目を持つJSON配列を返します。0件は200と `[]`、取得失敗は500と `POST_LIST_FETCH_FAILED` です。未来の投稿日時が1件でもあれば一覧全体を失敗として扱います。
200・500応答はキャッシュしません。投稿を閲覧しても件数や本文は変更されません。

日時はUTCで保存し、表示用の文字列をAPIで計算します。1週間未満は「○分」「○時間」「○日」、1週間以上は日本時間の日付です。
表示日時は再取得時に更新され、画面を開いたままの自動更新は行いません。

既存のVite設定で `/api/posts` をバックエンドの `/posts` に転送します。開発時のブラウザには同一オリジンの接続に見えます。
この転送は開発サーバー用です。本番の配信・転送構成は別途必要です。

接続確認用の `GET /`・`GET /health` と旧DB初期化コードは廃止しました。既存の `sample.db` ファイルは削除・移行しません。

## フロントエンドの読み方

- `frontend/src/App.jsx`：ホーム画面と表示部品を定義します。`LeftSidebar`、`Timeline`、`PostCard`、`RightSidebar` がそれぞれ画面の一部分を担当します。
- `useState` は読み込み状態と投稿データを保持します。`useEffect` は初回表示・再試行に合わせてAPIを呼びます。状態が変わるとReactが必要な部分を描き直します。
- `frontend/src/style.css`：3カラムの配置、青い強調色、余白、投稿の区切り線を設定します。
- JSXの `{post.body}` は本文を文字列として扱うため、投稿内のHTMLを実行しません。CSSの `white-space: pre-wrap` で改行を保持します。

取得中・0件・失敗を別の状態として扱い、失敗時には再試行できます。5秒でタイムアウトし、再試行中の重複操作や画面離脱後の応答反映を防ぎます。

## バックエンドの構成

| 配置                          | 役割                                   |
| ----------------------------- | -------------------------------------- |
| `backend/src/sns/main.py`     | FastAPIの起点、HTTP応答とエラー変換    |
| `backend/src/sns/database.py` | 接続先・読み取り専用接続・モデルのBase |
| `backend/src/sns/models.py`   | 保存用のPostRecordとDB制約             |
| `backend/src/sns/schemas.py`  | 応答用のPost・ErrorResponse            |
| `backend/src/sns/posts.py`    | 一覧取得・UTC復元・表示日時の算出      |
| `backend/src/sns/seed.py`     | シード検証・投入・重複スキップ         |
| `backend/migrations/`         | Alembicの移行処理と適用履歴            |
| `backend/tests/`              | 一時DBを使用する自動テスト             |

`src` はソースの置き場所で、Pythonでimportするパッケージ名は `sns` です。
SQLiteの日時保存値はTEXTで、SQLAlchemyがPythonのdatetimeへ変換します。保存時はUTCに統一し、取得時にUTCとして復元します。

## コマンドと確認

```sh
# backend/ 内
uv run --locked pytest -q
uv run --locked ruff check src migrations tests
uv run --locked ruff format --check src migrations tests
uv run --locked alembic current
uv run --locked alembic check

# frontend/ 内
npm test
npm run build
```

バックエンドのテストは専用の一時DBを使います。開発中の `sns.db` や `sample.db` は変更しません。
別のDBを手動確認する場合は、各バックエンドコマンドに環境変数 `SNS_DATABASE_PATH` で絶対パスを指定します。API・Alembic・シードは同じ設定を使います。

DBファイル・ジャーナルは `backend/data/` に保存され、Git管理対象外です。準備処理はAPIを停止して単独で実行してください。
初回移行のdowngradeは投稿テーブルを削除するため、通常の再実行や復旧には使用しません。

## 表示されないとき

- 「投稿一覧を取得できませんでした。」：APIが起動しているか、マイグレーションが完了しているか確認してください。DBがない場合も、空一覧を返さず失敗します。
- 「まだ投稿がありません」：取得は成功しています。初期データが必要ならAPI停止後にシードを投入してください。
- バックエンドを停止すると失敗表示になり、再起動後に「再試行」で復旧できます。

## 設計書

`docs/detail_design/` に入出力・ロジック・API・データベース設計書を保存しています。
投稿作成、編集、削除、返信、リツイート、いいね操作、検索・フォローは今回の実装対象外です。
