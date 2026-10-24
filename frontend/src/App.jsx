import { useCallback, useEffect, useRef, useState } from "react";
import PostComposer from "./PostComposer";
import { isPost, mergePosts } from "./posts";
export { isPost } from "./posts";

const errorMessage = "投稿一覧を取得できませんでした。";
const paths = {
  home: "M3 11 12 3l9 8v10h-6v-7H9v7H3Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  mail: "M3 5h18v14H3ZM3 5l9 8 9-8",
  bookmark: "M6 3h12v18l-6-4-6 4Z",
  user: "M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  reply: "M21 11a9 9 0 0 1-9 9H4l1-5a9 9 0 1 1 16-4Z",
  retweet: "m4 9 4-4 4 4M8 5v12h12m0-2-4 4-4-4m4 4V7H4",
  heart: "M12 21 3 12C-3 4 7-1 12 6c5-7 15-2 9 6Z",
};

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function LeftSidebar({ onCompose }) {
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
        <a className="nav-item selected" href="/" aria-current="page">
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
  const counts = [
    ["reply", "リプライ数", post.reply_count],
    ["retweet", "リツイート数", post.retweet_count],
    ["heart", "いいね数", post.like_count],
  ];
  return (
    <article className="post" aria-label={`${post.author}の投稿`}>
      <div className="avatar" aria-hidden="true">
        {Array.from(post.author)[0]}
      </div>
      <div className="post-content">
        <header className="post-meta">
          <h2>{post.author}</h2>
          <span aria-hidden="true">·</span>
          <time dateTime={post.posted_at} title={post.posted_at}>
            {post.displayed_at}
          </time>
        </header>
        <p className="post-body">{post.body}</p>
        <div className="post-counts">
          {counts.map(([icon, label, count]) => (
            <span key={icon} aria-label={`${label} ${count}`}>
              <Icon name={icon} />
              <span>{count}</span>
            </span>
          ))}
        </div>
      </div>
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
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: "loading", posts: [] });
  const [opener, setOpener] = useState(null);
  const [notification, setNotification] = useState("");
  const createdPosts = useRef(new Map());
  const openComposer = (event) => {
    setNotification("");
    setOpener(event.currentTarget);
  };
  const created = useCallback((post) => {
    const displayed = { ...post, displayed_at: "たった今" };
    createdPosts.current.set(post.post_id, displayed);
    setState((previous) => ({
      ...previous,
      posts: mergePosts(previous.posts, [displayed]),
    }));
    setNotification("投稿しました");
    setOpener(null);
    window.scrollTo({ top: 0 });
  }, []);
  const retry = useCallback(() => {
    setState((previous) => ({ ...previous, status: "loading" }));
    setAttempt((value) => value + 1);
  }, []);
  useEffect(() => {
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
  }, [attempt]);
  return (
    <>
      <div className="app-layout" inert={Boolean(opener)}>
        <LeftSidebar onCompose={openComposer} />
        <main id="main-content" className="main-column">
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
              <p className="compose-invitation">ひとことを投稿してみましょう</p>
              <div className="composer-bottom">
                <span>いまの気持ちを、280文字で。</span>
                <button className="primary" onClick={openComposer}>
                  投稿する
                </button>
              </div>
            </div>
          </section>
          <p className="post-notification" role="status" aria-live="polite">
            {notification}
          </p>
          <Timeline
            {...state}
            retry={retry}
            retrying={attempt > 0 && state.status === "loading"}
          />
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
            retry();
          }}
        />
      )}
    </>
  );
}
