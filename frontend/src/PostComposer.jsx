import { useEffect, useRef, useState } from "react";
import { isCreatedPost, isValidBody } from "./posts";

const validationMessage =
  "投稿本文は空白のみを除く1〜280文字で入力してください。";
const uncertainMessage =
  "保存済みの可能性があるため、一覧を確認してから再投稿してください";

export default function PostComposer({
  opener,
  onClose,
  onCreated,
  onCheckTimeline,
}) {
  const dialogRef = useRef(null);
  const bodyRef = useRef(null);
  const continueRef = useRef(null);
  const requestRef = useRef(null);
  const composing = useRef(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const length = Array.from(body).length;
  const valid = isValidBody(body);

  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    bodyRef.current.focus();
    document.body.style.overflow = "hidden";
    return () => {
      const request = requestRef.current;
      if (request) {
        request.active = false;
        clearTimeout(request.timeout);
        request.controller.abort();
      }
      dialog.close();
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [opener]);

  useEffect(() => {
    if (sending) dialogRef.current.focus();
    else if (confirmation) continueRef.current?.focus();
    else bodyRef.current?.focus();
  }, [sending, confirmation]);

  function close(action = "close") {
    if (requestRef.current?.active) return;
    if (body.length) setConfirmation(action);
    else finishClose(action);
  }

  function finishClose(action) {
    if (action === "check") onCheckTimeline();
    else onClose();
  }

  async function submit(event) {
    event.preventDefault();
    if (!valid || composing.current || requestRef.current?.active) return;
    const request = { active: true, controller: new AbortController() };
    requestRef.current = request;
    setSending(true);
    setError(null);
    request.timeout = setTimeout(() => {
      request.active = false;
      request.controller.abort();
      setSending(false);
      setError({ message: uncertainMessage, uncertain: true });
    }, 5000);
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ body }),
        signal: request.controller.signal,
        cache: "no-store",
      });
      if (!request.active) return;
      if (response.status === 422 || response.status === 500) {
        setError({
          message:
            response.status === 422
              ? validationMessage
              : "投稿を保存できませんでした。",
        });
        return;
      }
      if (response.status !== 201) throw new Error("Unexpected status");
      const post = await response.json();
      if (!request.active) return;
      if (!isCreatedPost(post)) throw new Error("Invalid response");
      request.active = false;
      clearTimeout(request.timeout);
      onCreated(post);
    } catch {
      if (request.active)
        setError({ message: uncertainMessage, uncertain: true });
    } finally {
      if (request.active) {
        request.active = false;
        clearTimeout(request.timeout);
        setSending(false);
      }
    }
  }

  function trapFocus(event) {
    // ネイティブの連続Escによる強制終了より先に、確認画面の取消を扱う。
    if (event.key === "Escape") {
      event.preventDefault();
      if (composing.current || event.nativeEvent.isComposing) return;
      if (confirmation) setConfirmation(null);
      else close();
      return;
    }
    if (event.key !== "Tab") return;
    const elements = [
      ...dialogRef.current.querySelectorAll(
        ":is(button, textarea):not(:disabled)",
      ),
    ];
    const first = elements[0];
    const last = elements.at(-1);
    if (!first) {
      event.preventDefault();
      return;
    }
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === dialogRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        document.activeElement === dialogRef.current)
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="post-dialog"
      aria-labelledby="compose-title"
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={trapFocus}
      onCancel={(event) => {
        event.preventDefault();
        if (composing.current) return;
        if (confirmation) setConfirmation(null);
        else close();
      }}
    >
      <h2 id="compose-title">投稿を作成</h2>
      {confirmation ? (
        <div className="discard-confirmation">
          <p>入力内容を破棄しますか？</p>
          <div className="dialog-actions">
            <button
              ref={continueRef}
              className="secondary"
              onClick={() => setConfirmation(null)}
            >
              入力を続ける
            </button>
            <button
              className="primary"
              onClick={() => finishClose(confirmation)}
            >
              破棄する
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} aria-busy={sending}>
          <button
            type="button"
            className="close-dialog"
            aria-label="閉じる"
            disabled={sending}
            onClick={() => close()}
          >
            ×
          </button>
          <div className="compose-author">
            <div className="avatar" aria-hidden="true">
              自
            </div>
            <strong>自分</strong>
          </div>
          <label className="sr-only" htmlFor="post-body">
            投稿本文
          </label>
          <textarea
            id="post-body"
            ref={bodyRef}
            value={body}
            placeholder="いまどうしてる？"
            rows={6}
            disabled={sending}
            aria-describedby="body-count body-validation"
            aria-invalid={body.length > 0 && !valid}
            onChange={(event) => {
              setBody(event.target.value);
              setError(null);
            }}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
          />
          <p
            id="body-validation"
            className="error"
            role={body.length > 0 && !valid ? "alert" : undefined}
          >
            {body.length > 0 && !valid ? validationMessage : ""}
          </p>
          {error && (
            <p className="error" role="alert">
              {error.message}
            </p>
          )}
          {error?.uncertain && (
            <button
              type="button"
              className="secondary"
              disabled={sending}
              onClick={() => close("check")}
            >
              一覧を確認する
            </button>
          )}
          <div className="dialog-actions">
            <span id="body-count" className={length > 280 ? "error" : ""}>
              {length} / 280
            </span>
            <button
              className="primary"
              type="submit"
              disabled={!valid || sending}
            >
              {sending ? "送信中…" : "投稿する"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
