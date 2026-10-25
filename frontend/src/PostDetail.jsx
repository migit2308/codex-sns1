import { useEffect, useState } from "react";
import PostContent from "./PostContent";
import { formatPostedAt, isPostDetail } from "./posts";

const messages = {
  "not-found": "投稿が見つかりません",
  "invalid-url": "投稿URLが正しくありません",
  error: "投稿詳細を取得できませんでした。",
};

export default function PostDetail({ postId }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: "loading" });
  // ID変更直後の描画でも、以前の投稿を別のURLの詳細として表示しない。
  const current =
    state.postId === postId && state.attempt === attempt
      ? state
      : { status: "loading" };

  useEffect(() => {
    const restored = (event) => {
      if (event.persisted) setAttempt((value) => value + 1);
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const update = (next) => setState({ postId, attempt, ...next });
    update({ status: "loading" });
    const timeout = setTimeout(() => {
      active = false;
      controller.abort();
      update({ status: "error" });
    }, 5000);

    async function load() {
      try {
        const response = await fetch(
          `/api/posts/${encodeURIComponent(postId)}`,
          {
            signal: controller.signal,
            cache: "no-store",
            headers: { Accept: "application/json" },
          },
        );
        if (!active) return;
        if (response.status === 404 || response.status === 422) {
          update({
            status: response.status === 404 ? "not-found" : "invalid-url",
          });
          return;
        }
        if (response.status !== 200) throw new Error("Unexpected status");
        const post = await response.json();
        if (!active) return;
        if (!isPostDetail(post, postId)) throw new Error("Invalid response");
        update({ status: "success", post });
      } catch {
        if (active) update({ status: "error" });
      } finally {
        clearTimeout(timeout);
        active = false;
      }
    }
    load();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [postId, attempt]);

  const loading = current.status === "loading";
  return (
    <>
      <header className="detail-header">
        <a className="back-link" href="/">
          ← 投稿一覧へ戻る
        </a>
        <h1>投稿詳細</h1>
      </header>
      <section aria-label="投稿詳細" aria-busy={loading}>
        <div role="status" aria-live="polite">
          {loading && (
            <div className="state-panel">
              <span className="spinner" aria-hidden="true" />
              <p>投稿を読み込んでいます…</p>
            </div>
          )}
        </div>
        {messages[current.status] && (
          <div className="state-panel">
            <p className="error" role="alert">
              {messages[current.status]}
            </p>
          </div>
        )}
        {(current.status === "error" || (loading && attempt > 0)) && (
          <div className="retry">
            <button
              className="primary"
              disabled={loading}
              onClick={() => setAttempt((value) => value + 1)}
            >
              {loading ? "再試行中…" : "再試行"}
            </button>
          </div>
        )}
        {current.status === "success" && (
          <article
            className="post post-detail-content"
            aria-label={`${current.post.author}の投稿`}
          >
            <PostContent
              post={current.post}
              dateLabel={formatPostedAt(current.post.posted_at)}
              detail
            />
          </article>
        )}
      </section>
    </>
  );
}
