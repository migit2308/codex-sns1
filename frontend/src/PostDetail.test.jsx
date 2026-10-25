import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App, { PostCard } from "./App";
import PostDetail from "./PostDetail";
import { formatPostedAt, isPostDetail } from "./posts";

const post = {
  post_id: 1,
  author: "ユーザーA",
  body: "本文\n次の行 <script>bad()</script>",
  posted_at: "2026-10-24T18:30:59.999Z",
  reply_count: 0,
  retweet_count: 1,
  like_count: 2,
};
const response = (status, data) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => data,
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function restored() {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: true });
  fireEvent(window, event);
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, post)));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("投稿詳細の表示", () => {
  it("単件APIから取得し、改行・件数0・日本時間の日時を表示する", async () => {
    const { container } = render(<PostDetail postId="1" />);
    expect(screen.getByRole("region", { name: "投稿詳細" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "投稿を読み込んでいます…",
    );
    await screen.findByText("2026/10/25 03:30");
    expect(fetch).toHaveBeenCalledWith(
      "/api/posts/1",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(container.querySelector(".post-body").textContent).toBe(post.body);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      post.posted_at,
    );
    for (const label of ["リプライ数 0", "リツイート数 1", "いいね数 2"])
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(container.querySelector("article")).not.toHaveTextContent("post_id");
    expect(
      screen.getByRole("link", { name: /投稿一覧へ戻る/ }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.queryByRole("button", { name: "再試行" }),
    ).not.toBeInTheDocument();
  });
  it.each([
    [404, "投稿が見つかりません"],
    [422, "投稿URLが正しくありません"],
  ])("%sは再試行を表示せず一覧へのリンクを残す", async (status, message) => {
    fetch.mockResolvedValue(response(status, {}));
    render(<PostDetail postId="abc" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /投稿一覧へ戻る/ }),
    ).toHaveAttribute("href", "/");
  });
  it.each([500, 503, 201])(
    "想定外を含む%s応答を取得失敗として扱う",
    async (status) => {
      fetch.mockResolvedValue(response(status, {}));
      render(<PostDetail postId="1" />);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "投稿詳細を取得できませんでした。",
      );
      expect(screen.getByRole("button", { name: "再試行" })).toBeEnabled();
    },
  );
  it.each([
    {},
    { ...post, post_id: 2 },
    { ...post, displayed_at: "たった今" },
    { ...post, posted_at: "2026-10-24T18:30:59" },
    { ...post, like_count: -1 },
    { ...post, reply_count: 0.5 },
    { ...post, author: null },
    { ...post, body: [] },
  ])("不正な応答やID不一致を表示しない", async (value) => {
    fetch.mockResolvedValue(response(200, value));
    render(<PostDetail postId="1" />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
  it("通信失敗から手動で再試行でき、取得中の連打を防ぐ", async () => {
    const pending = deferred();
    fetch
      .mockRejectedValueOnce(new Error("network"))
      .mockReturnValueOnce(pending.promise);
    render(<PostDetail postId="1" />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    const retry = screen.getByRole("button", { name: "再試行中…" });
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => pending.resolve(response(200, post)));
    expect(screen.getByText("2026/10/25 03:30")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("JSONの読み取り失敗も取得失敗にする", async () => {
    fetch.mockResolvedValue({
      status: 200,
      json: async () => {
        throw new Error("invalid json");
      },
    });
    render(<PostDetail postId="1" />);
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "再試行" })).toBeEnabled();
  });
  it("応答のない要求を5秒で中断し、遅延応答を破棄する", async () => {
    vi.useFakeTimers();
    const pending = deferred();
    fetch.mockReturnValue(pending.promise);
    render(<PostDetail postId="1" />);
    const signal = fetch.mock.calls[0][1].signal;
    await act(async () => vi.advanceTimersByTimeAsync(4999));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "投稿詳細を取得できませんでした。",
    );
    await act(async () => pending.resolve(response(200, post)));
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("JSON読取中のタイムアウトでも遅れたデータを表示しない", async () => {
    vi.useFakeTimers();
    const pending = deferred();
    fetch.mockResolvedValue({ status: 200, json: () => pending.promise });
    render(<PostDetail postId="1" />);
    await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    await act(async () => pending.resolve(post));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
  it("ID変更時に旧要求を中断し、その応答で新しい投稿を上書きしない", async () => {
    const first = deferred();
    const second = deferred();
    fetch
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const view = render(<PostDetail postId="1" />);
    const signal = fetch.mock.calls[0][1].signal;
    view.rerender(<PostDetail postId="2" />);
    expect(signal.aborted).toBe(true);
    await act(async () =>
      second.resolve(
        response(200, { ...post, post_id: 2, author: "ユーザーB" }),
      ),
    );
    await act(async () => first.resolve(response(200, post)));
    expect(
      screen.getByRole("heading", { name: "ユーザーB" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("ユーザーA")).not.toBeInTheDocument();
  });
  it("ID変更直後に以前の取得済み投稿を残さない", async () => {
    const view = render(<PostDetail postId="1" />);
    await screen.findByRole("article");
    fetch.mockReturnValue(new Promise(() => {}));
    view.rerender(<PostDetail postId="2" />);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
  it("離脱で要求を中断する", async () => {
    const pending = deferred();
    fetch.mockReturnValue(pending.promise);
    const view = render(<PostDetail postId="1" />);
    const signal = fetch.mock.calls[0][1].signal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(response(200, post)));
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});

describe("URLと投稿モーダルとの連携", () => {
  it("詳細URLで一覧を取得せず、共有サイドバーと詳細画面を表示する", async () => {
    window.history.replaceState(null, "", "/posts/1");
    render(<App />);
    await screen.findByRole("article");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/posts/1");
    expect(
      screen.getByRole("link", { name: "ホーム", exact: true }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByLabelText("検索とおすすめ")).toBeInTheDocument();
  });
  it("一覧のカードはキーボードで選択できる詳細へのリンクになる", () => {
    render(<PostCard post={{ ...post, displayed_at: "1日" }} />);
    const link = screen.getByRole("link", { name: "ユーザーAの投稿詳細" });
    expect(link).toHaveAttribute("href", "/posts/1");
    link.focus();
    expect(link).toHaveFocus();
    expect(link).toHaveTextContent("本文");
  });
  it("詳細から投稿成功後も同じ詳細を保ち、通知・フォーカスを戻す", async () => {
    const created = { ...post, post_id: 2, body: "新しい投稿", author: "自分" };
    fetch.mockImplementation((_url, options) =>
      Promise.resolve(
        response(
          options?.method === "POST" ? 201 : 200,
          options?.method === "POST" ? created : post,
        ),
      ),
    );
    window.history.replaceState(null, "", "/posts/1");
    render(<App />);
    await screen.findByRole("article");
    const opener = screen.getByRole("button", {
      name: "投稿する",
      exact: true,
    });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(screen.getByRole("textbox", { name: "投稿本文" }), {
      target: { value: created.body },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "投稿する", exact: true }),
    );
    await screen.findByText("投稿しました");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "ユーザーA" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(created.body)).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/posts/1");
    expect(opener).toHaveFocus();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
  it("詳細での破棄確認を取り消して入力を続け、破棄で詳細に戻れる", async () => {
    window.history.replaceState(null, "", "/posts/1");
    render(<App />);
    await screen.findByRole("article");
    const opener = screen.getByRole("button", {
      name: "投稿する",
      exact: true,
    });
    fireEvent.click(opener);
    fireEvent.change(screen.getByRole("textbox", { name: "投稿本文" }), {
      target: { value: "下書き" },
    });
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    fireEvent.click(screen.getByRole("button", { name: "入力を続ける" }));
    expect(screen.getByRole("textbox", { name: "投稿本文" })).toHaveValue(
      "下書き",
    );
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    fireEvent.click(screen.getByRole("button", { name: "破棄する" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/posts/1");
    expect(opener).toHaveFocus();
  });
  it.each(["/", "/posts/1"])(
    "ブラウザのキャッシュ復元で%sを再取得する",
    async (path) => {
      window.history.replaceState(null, "", path);
      fetch.mockResolvedValue(
        response(200, path === "/" ? [{ ...post, displayed_at: "1日" }] : post),
      );
      render(<App />);
      await screen.findByRole("article");
      const initial = fetch.mock.calls.length;
      restored();
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(initial + 1));
    },
  );
});

describe("詳細データの検証と日時整形", () => {
  it.each([
    ["2026-10-24T18:30:59Z", "2026/10/25 03:30"],
    ["2026-10-24T15:00:00Z", "2026/10/25 00:00"],
    ["2026-10-24T14:59:59Z", "2026/10/24 23:59"],
    ["2026-10-25T03:30:00+09:00", "2026/10/25 03:30"],
  ])("%sを日本時間で表示する", (input, expected) =>
    expect(formatPostedAt(input)).toBe(expected),
  );
  it("7項目の正常データと要求IDを検証する", () => {
    expect(isPostDetail(post, "1")).toBe(true);
    expect(isPostDetail(post, "2")).toBe(false);
  });
});
