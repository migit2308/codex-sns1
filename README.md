# codex-sns1

Codexを利用してSNS風Webアプリを開発するプロジェクトです。
現在はViteとReactで「Hello World」を表示するフロントエンドと、FastAPIのサンプルAPIを用意しています。

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

[Issue #1](https://github.com/migit2308/codex-sns1/issues/1)のフロントエンドとバックエンドの初期構築に対応しています。
SQLiteのサンプルテーブルと、React画面からFastAPIを呼び出す接続確認も用意しています。

## React画面からのAPI接続確認

1. バックエンドの起動手順に従って、FastAPIを8000番ポートで起動します。
2. 別のターミナルでフロントエンドを `npm run dev` で起動します。
3. http://127.0.0.1:5173/ を開き、「APIからメッセージを取得」を押します。
4. 「APIの応答：Hello World」と表示されれば、ReactからFastAPIへの接続成功です。

取得中はボタンが無効になり、5秒以内に取得できない場合やAPIがエラーを返した場合は、エラーメッセージが表示されます。
バックエンドを停止してボタンを押すと失敗時の表示を確認できます。再起動後、同じボタンで再試行できます。

Reactは `fetch('/api/')` でViteへリクエストします。Viteのプロキシが `/api` を取り除き、FastAPIの `GET /` へ転送します。
プロキシはリクエストを別のサーバーへ中継する仕組みで、ブラウザからは画面と同じ接続先に見えるため、今回の開発環境ではCORS設定の追加は不要です。
接続先は `frontend/vite.config.js` の `server.proxy` で指定しています。
この設定は開発サーバー用です。ビルドしたファイルを配信する際のAPI転送設定は別途必要になります。

参考：[Viteのプロキシ設定](https://vite.dev/config/server-options.html#server-proxy)

## バックエンドの起動

前提ツールはuvです（動作確認：0.9.2）。未導入の場合は[uv公式のインストール手順](https://docs.astral.sh/uv/getting-started/installation/)を参照してください。
Pythonは3.12系を使用します（動作確認：3.12.12）。

リポジトリのルートから、フロントエンドとは別のターミナルで実行します。

```sh
cd backend
uv sync --locked
uv run --locked fastapi dev main.py --host 127.0.0.1 --port 8000
```

`uv sync --locked` は `uv.lock` に記録された依存関係を `backend/.venv/` に導入します。
対応するPythonが見つからなければ、uvが自動的に取得します。
`.python-version` と `pyproject.toml` により、このプロジェクトではPython 3.12系を使用します。
仮想環境の手動有効化は不要です。`uv run` がプロジェクトの環境でコマンドを実行します。

`fastapi dev main.py` は `main.py` のFastAPIアプリを検出して開発サーバーを起動します。ソースを変更すると自動で再起動します。
`backend/` 内では、`uv run fastapi dev` でも `main.py` が自動検出されます。
停止するには `Ctrl+C` を押します。8000番ポートが使用中の場合は既存のサーバーを停止するか、別のポートを指定してください。

### サンプルAPIと動作確認

| メソッド・パス | HTTPステータス | レスポンス | 用途 |
| --- | --- | --- | --- |
| `GET /` | 200 | `{"message":"Hello World"}` | 挨拶のサンプル |
| `GET /health` | 200 | `{"status":"ok"}` | APIプロセスの応答確認（DBの接続確認は含みません） |

ブラウザで http://127.0.0.1:8000/ を開くか、別のターミナルから実行します。

```sh
curl -i http://127.0.0.1:8000/
curl -i http://127.0.0.1:8000/health
```

両方ともHTTP 200と上表のJSONが返れば起動成功です。
存在しないパスは404、サンプルAPIへのPOSTは405になります。

- APIドキュメント：http://127.0.0.1:8000/docs （Swagger UIの表示には外部CDNへの接続が必要です）
- OpenAPI定義：http://127.0.0.1:8000/openapi.json （コードから自動生成されます）
- Pythonの確認：`backend/` 内で `uv run --locked python --version`

### バックエンドの構成

| ファイル | 役割 |
| --- | --- |
| `backend/main.py` | APIの処理、URL、返却データの型を定義します。 |
| `backend/.python-version` | uvで使用するPythonの系列を指定します。 |
| `backend/pyproject.toml` | Pythonの対応範囲と直接依存を定義します。 |
| `backend/uv.lock` | 間接依存も含めたバージョンを固定し、Gitで管理します。 |

FastAPI 0.153.0、Uvicorn 0.54.0の正式版を固定しています。
`fastapi[standard]` を指定し、`fastapi dev` に必要なCLIなどの標準依存も導入しています。
FastAPIがAPIの処理や仕様を定義し、UvicornがHTTPリクエストを受け付けるサーバーとして動きます。
`.venv/` とPythonのキャッシュはGit管理から除外しています。

## SQLiteのサンプルテーブル

SQLAlchemy 2.1.5を使用します。SQLAlchemyはPythonのクラスとDBのテーブルを対応づけるORMです。
SQLiteへの接続にはPython標準の `sqlite3` ドライバーを使用するため、別途DBサーバーの起動は不要です。

リポジトリのルートから、次を実行します。

```sh
cd backend
uv sync --locked
uv run --locked python -m db.init_db
```

`backend/data/sample.db` に `sample_messages` テーブルが作成され、
`id=1, body=Hello SQLite` のサンプル行と作成日時が表示されます。
このテーブルは環境の動作確認用で、SNSの正式な投稿テーブルではありません。

| カラム | SQLAlchemyの型 | 条件・意味 |
| --- | --- | --- |
| `id` | Integer | 主キー。未指定の場合はSQLiteが整数IDを採番します。サンプル行は1を使用します。 |
| `body` | Text | NOT NULL。サンプルの本文です。 |
| `created_at` | DateTime | NOT NULL。DBが挿入時にUTCの日時を設定します（秒精度、タイムゾーン情報は格納しません）。 |

初期化コマンドは再実行できます。既存テーブルを削除せず、IDが1の行が存在する場合は追加・上書きをしません。
SQLiteはファイルに保存するため、プロセスを終了してもデータは残ります。
DBの保存先はPythonファイルの場所から決めているため、作業ディレクトリによって変わりません。
DBファイルとジャーナルなどを含む `backend/data/` はGit管理対象外です。

| ファイル | 役割 |
| --- | --- |
| `backend/db/__init__.py` | DB関連コードをPythonパッケージとしてまとめます。 |
| `backend/db/database.py` | DB保存先、接続用のEngine、モデルの共通Baseを定義します。 |
| `backend/db/models.py` | Pythonのクラスでテーブルとカラムを定義します。 |
| `backend/db/init_db.py` | テーブル作成・サンプル行の追加・読み取りを行います。 |

DB関連コードは `backend/db/`、実データは `backend/data/` に分けています。
`python -m db.init_db` は、`db` パッケージ内の `init_db` を実行する指定です。`backend/` 内で実行してください。

テーブルは `Base.metadata.create_all()` で作成します。この処理は既存テーブルのカラム変更までは行いません。
今後、正式なテーブルの構造を変更するときは、マイグレーションの導入を別途検討します。
API経由のDB操作はまだ追加していません。

参考：[SQLAlchemy ORMの公式クイックスタート](https://docs.sqlalchemy.org/en/20/orm/quickstart.html)
