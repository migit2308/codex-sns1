import { useCallback, useEffect, useRef, useState } from "react";
import PostComposer from "./PostComposer";
import Icon from "./Icon";
import PostContent from "./PostContent";
import PostDetail from "./PostDetail";
import { isPost, mergePosts } from "./posts";
export { isPost } from "./posts";

const errorMessage = "投稿一覧を取得できませんでした。";
export function LeftSidebar({ onCompose, isHome = true }) {
  const menu = [
    ["search", "話題を検索"],
    ["bell", "通知"],
    ["mail", "メッセージ"],
    ["bookmark", "ブックマーク"],
    ["user", "プロフィール"],
    ["more", "もっと見る"],
  ];
  return (
    <aside className="left-sidebar">
      <a className="brand" href="/" aria-label="SNS ホーム">
        sns<span>.</span>
      </a>
      <nav aria-label="メインメニュー">
        <a
          className={`nav-item${isHome ? " selected" : ""}`}
          href="/"
          aria-current={isHome ? "page" : undefined}
        >
          <Icon name="home" />
          ホーム
        </a>
        {menu.map(([icon, label]) => (
          <button key={icon} className="nav-item" disabled>
            <Icon name={icon} />
            <span>
              {label}
              <small>準備中</small>
            </span>
          </button>
        ))}
      </nav>
      <button className="primary compose-button" onClick={onCompose}>
        投稿する
      </button>
      <p className="sidebar-note">日々のひとことを、ここに。</p>
    </aside>
  );
}

export function RightSidebar() {
  return (
    <aside className="right-sidebar" aria-label="検索とおすすめ">
      <label className="search-box">
        <Icon name="search" />
        <input
          aria-label="キーワード検索（準備中）"
          placeholder="キーワードを検索"
          disabled
        />
      </label>
      <p className="search-note">検索機能は準備中です</p>
      <section className="side-panel">
        <h2>いま話題のキーワード</h2>
        <p>準備中</p>
      </section>
      <section className="side-panel">
        <h2>おすすめユーザー</h2>
        <p>準備中</p>
        <button className="follow-button" disabled>
          フォロー（準備中）
        </button>
      </section>
      <p className="sidebar-footer">SNS · 小さなつながりを楽しもう</p>
    </aside>
  );
}

export function PostCard({ post }) {
  return (
    <article aria-label={`${post.author}の投稿`}>
      <a
        className="post post-link"
        href={`/posts/${post.post_id}`}
        aria-label={`${post.author}の投稿詳細`}
      >
        <PostContent post={post} dateLabel={post.displayed_at} />
      </a>
    </article>
  );
}

export function Timeline({ status, posts, retry, retrying = false }) {
  return (
    <section
      aria-label="投稿一覧"
      className="timeline"
      aria-busy={status === "loading"}
    >
      <div role="status" aria-live="polite">
        {status === "loading" && (
          <div className="state-panel">
            <span className="spinner" aria-hidden="true" />
            <p>投稿を読み込んでいます…</p>
          </div>
        )}
        {status === "success" && posts.length === 0 && (
          <div className="state-panel">
            <h2>まだ投稿がありません</h2>
            <p>新しい投稿がここに表示されます。</p>
          </div>
        )}
      </div>
      {status === "error" && (
        <div className="state-panel">
          <p className="error" role="alert">
            {errorMessage}
          </p>
          <p>時間をおいて、もう一度お試しください。</p>
        </div>
      )}
      {(status === "error" || retrying) && (
        <div className="retry">
          <button
            className="primary"
            disabled={status === "loading"}
            onClick={retry}
          >
            {status === "loading" ? "再試行中…" : "再試行"}
          </button>
        </div>
      )}
      {posts.map((post) => (
        <PostCard key={post.post_id} post={post} />
      ))}
    </section>
  );
}

export default function App() {
  const detailPath = window.location.pathname.match(/^\/posts\/([^/]+)\/?$/);
  const isDetail = Boolean(detailPath);
  let postId = detailPath?.[1];
  try {
    postId = postId && decodeURIComponent(postId);
  } catch {
    /* 不正なエスケープもAPIの入力検証で扱う。 */
  }
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: "loading", posts: [] });
  const [opener, setOpener] = useState(null);
  const [notification, setNotification] = useState("");
  const createdPosts = useRef(new Map());
  const openComposer = (event) => {
    setNotification("");
    setOpener(event.currentTarget);
  };
  const created = useCallback(
    (post) => {
      if (!isDetail) {
        const displayed = { ...post, displayed_at: "たった今" };
        createdPosts.current.set(post.post_id, displayed);
        setState((previous) => ({
          ...previous,
          posts: mergePosts(previous.posts, [displayed]),
        }));
        window.scrollTo({ top: 0 });
      }
      setNotification("投稿しました");
      setOpener(null);
    },
    [isDetail],
  );
  const retry = useCallback(() => {
    setState((previous) => ({ ...previous, status: "loading" }));
    setAttempt((value) => value + 1);
  }, []);
  useEffect(() => {
    document.title = `${isDetail ? "投稿詳細" : "ホーム"} | codex-sns1`;
  }, [isDetail]);
  useEffect(() => {
    const restored = (event) => {
      if (event.persisted && !isDetail) retry();
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, [isDetail, retry]);
  useEffect(() => {
    if (isDetail) return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(), 5000);
    setState((previous) => ({ ...previous, status: "loading" }));
    async function load() {
      try {
        const response = await fetch("/api/posts", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("HTTP error");
        const posts = await response.json();
        if (
          !Array.isArray(posts) ||
          !posts.every(isPost) ||
          new Set(posts.map((post) => post.post_id)).size !== posts.length
        )
          throw new Error("Invalid response");
        if (!cancelled && !controller.signal.aborted) {
          const merged = mergePosts([...createdPosts.current.values()], posts);
          for (const post of posts) createdPosts.current.delete(post.post_id);
          setState({ status: "success", posts: merged });
        }
      } catch {
        if (!cancelled)
          setState((previous) => ({ ...previous, status: "error" }));
      } finally {
        clearTimeout(timeout);
      }
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt, isDetail]);
  return (
    <>
      <div className="app-layout" inert={Boolean(opener)}>
        <LeftSidebar onCompose={openComposer} isHome={!isDetail} />
        <main id="main-content" className="main-column">
          <p className="post-notification" role="status" aria-live="polite">
            {notification}
          </p>
          {isDetail ? (
            <PostDetail key={postId} postId={postId} />
          ) : (
            <>
              <header className="home-header">
                <h1>ホーム</h1>
                <span>あなたのタイムライン</span>
              </header>
              <div className="tabs">
                <span className="active-tab">すべての投稿</span>
                <button disabled>
                  フォロー中<small>準備中</small>
                </button>
              </div>
              <section className="composer" aria-label="投稿を始める">
                <div className="avatar" aria-hidden="true">
                  自
                </div>
                <div>
                  <p className="compose-invitation">
                    ひとことを投稿してみましょう
                  </p>
                  <div className="composer-bottom">
                    <span>いまの気持ちを、280文字で。</span>
                    <button className="primary" onClick={openComposer}>
                      投稿する
                    </button>
                  </div>
                </div>
              </section>
              <Timeline
                {...state}
                retry={retry}
                retrying={attempt > 0 && state.status === "loading"}
              />
            </>
          )}
        </main>
        <RightSidebar />
      </div>
      {opener && (
        <PostComposer
          opener={opener}
          onClose={() => setOpener(null)}
          onCreated={created}
          onCheckTimeline={() => {
            setOpener(null);
            if (isDetail) window.location.assign("/");
            else retry();
          }}
        />
      )}
    </>
  );
}
