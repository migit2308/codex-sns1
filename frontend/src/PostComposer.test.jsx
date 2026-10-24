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
import App from "./App";
import { isCreatedPost, isValidBody, mergePosts } from "./posts";

const created = {
  post_id: 4,
  author: "自分",
  body: "投稿本文",
  posted_at: "2026-10-24T03:00:00Z",
  reply_count: 0,
  retweet_count: 0,
  like_count: 0,
};
const oldPost = {
  ...created,
  post_id: 1,
  author: "ユーザーA",
  body: "以前の投稿",
  posted_at: "2026-10-20T12:00:00Z",
  displayed_at: "4日",
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

// jsdomにはネイティブdialogのトップレイヤーがない。実際の操作制限は実ブラウザでも確認する。
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mount(
  get = Promise.resolve(response(200, [oldPost])),
  post = Promise.resolve(response(201, created)),
) {
  const fetch = vi.fn((url, options) =>
    options?.method === "POST" ? post : get,
  );
  vi.stubGlobal("fetch", fetch);
  const view = render(<App />);
  fetch.unmount = view.unmount;
  await act(async () => {});
  return fetch;
}
function open(index = 0) {
  const opener = screen.getAllByRole("button", {
    name: "投稿する",
    exact: true,
  })[index];
  fireEvent.click(opener);
  return { dialog: screen.getByRole("dialog"), opener };
}
function type(text = created.body) {
  fireEvent.change(screen.getByRole("textbox", { name: "投稿本文" }), {
    target: { value: text },
  });
}
function send(dialog) {
  fireEvent.click(
    within(dialog).getByRole("button", { name: "投稿する", exact: true }),
  );
}
function escape(dialog) {
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
}

describe("本文・応答・一覧のデータ処理", () => {
  it.each(["", " \u3000\t\n\r\v\f", "a".repeat(281), "😀".repeat(281)])(
    "不正本文を拒否する",
    (body) => expect(isValidBody(body)).toBe(false),
  );
  it.each(["あ", "😀".repeat(280), " 本文\n次の行 "])(
    "有効な本文を認める",
    (body) => expect(isValidBody(body)).toBe(true),
  );
  it("作成応答は7項目として検証する", () => {
    expect(isCreatedPost(created)).toBe(true);
    expect(isCreatedPost({ ...created, displayed_at: "たった今" })).toBe(false);
    expect(isCreatedPost({ ...created, post_id: true })).toBe(false);
  });
  it("IDで統合し、同じIDは後のデータを優先する", () => {
    expect(
      mergePosts(
        [{ ...created, displayed_at: "たった今" }],
        [{ ...created, displayed_at: "1分" }, oldPost],
      ),
    ).toEqual([{ ...created, displayed_at: "1分" }, oldPost]);
  });
  it("日時のマイクロ秒と同日時のIDで並べる", () => {
    const a = {
      ...created,
      post_id: 10,
      posted_at: "2026-10-24T03:00:00.000001Z",
    };
    const b = {
      ...created,
      post_id: 2,
      posted_at: "2026-10-24T03:00:00.000002Z",
    };
    expect(
      mergePosts([a, b, { ...b, post_id: 3 }]).map((p) => p.post_id),
    ).toEqual([3, 2, 10]);
  });
});

describe("投稿モーダル", () => {
  it.each([0, 1])(
    "入口%iから開き、空なら閉じてフォーカスを戻す",
    async (index) => {
      await mount();
      const { dialog, opener } = open(index);
      expect(screen.getByRole("textbox", { name: "投稿本文" })).toHaveFocus();
      expect(document.querySelector(".app-layout")).toHaveAttribute("inert");
      expect(document.body.style.overflow).toBe("hidden");
      fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
      expect(document.body.style.overflow).toBe("");
    },
  );
  it("文字数と空白を検証し、改行は本文として保持する", async () => {
    await mount();
    const { dialog } = open();
    const button = within(dialog).getByRole("button", { name: "投稿する" });
    expect(button).toBeDisabled();
    type(" \u3000\n");
    expect(button).toBeDisabled();
    type("😀".repeat(280));
    expect(button).toBeEnabled();
    expect(screen.getByText("280 / 280")).toBeInTheDocument();
    type("😀".repeat(281));
    expect(button).toBeDisabled();
    expect(screen.getByText("281 / 280")).toBeInTheDocument();
    type(" 本文\n次の行 ");
    expect(screen.getByRole("textbox", { name: "投稿本文" }).value).toBe(
      " 本文\n次の行 ",
    );
  });
  it("背景では閉じず、Escと破棄確認を操作できる", async () => {
    await mount();
    const { dialog } = open();
    type("途中の本文");
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    escape(dialog);
    expect(screen.getByText("入力内容を破棄しますか？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "入力を続ける" })).toHaveFocus();
    escape(dialog);
    expect(screen.getByRole("textbox", { name: "投稿本文" }).value).toBe(
      "途中の本文",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));
    fireEvent.click(screen.getByRole("button", { name: "入力を続ける" }));
    expect(screen.getByRole("textbox", { name: "投稿本文" })).toHaveFocus();
    escape(dialog);
    fireEvent.click(screen.getByRole("button", { name: "破棄する" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open();
    expect(screen.getByRole("textbox", { name: "投稿本文" }).value).toBe("");
  });
  it("連続Escでモーダルを閉じず、破棄確認だけを取り消す", async () => {
    await mount();
    const { dialog } = open();
    type("途中の本文");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByText("入力内容を破棄しますか？")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "投稿本文" }).value).toBe(
      "途中の本文",
    );
  });
  it("Tab/Shift+Tabをモーダル内で循環させる", async () => {
    await mount();
    const { dialog } = open();
    type();
    const first = within(dialog).getByRole("button", { name: "閉じる" });
    const last = within(dialog).getByRole("button", { name: "投稿する" });
    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
  });
  it("送信中は編集・終了・連打を抑止し、成功時だけ一覧へ反映する", async () => {
    const post = deferred();
    const fetch = await mount(undefined, post.promise);
    const { dialog, opener } = open();
    type(" 本文\n次の行 ");
    send(dialog);
    fireEvent.submit(dialog.querySelector("form"));
    expect(
      fetch.mock.calls.filter(([, o]) => o.method === "POST"),
    ).toHaveLength(1);
    const options = fetch.mock.calls.find(([, o]) => o.method === "POST")[1];
    expect(JSON.parse(options.body)).toEqual({ body: " 本文\n次の行 " });
    expect(screen.getByRole("textbox", { name: "投稿本文" })).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "閉じる" }),
    ).toBeDisabled();
    escape(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () =>
      post.resolve(response(201, { ...created, body: " 本文\n次の行 " })),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(screen.getByText("投稿しました")).toBeInTheDocument();
    expect(screen.getAllByRole("article")[0]).toHaveAttribute(
      "aria-label",
      "自分の投稿",
    );
    expect(screen.getByText("たった今")).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
  });
  it.each([422, 500])("HTTP %iで本文を残し手動再試行できる", async (status) => {
    const fetch = await mount(undefined, Promise.resolve(response(status, {})));
    const { dialog } = open();
    type();
    send(dialog);
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox", { name: "投稿本文" }).value).toBe(
      created.body,
    );
    expect(
      within(dialog).getByRole("button", { name: "投稿する" }),
    ).toBeEnabled();
    fetch.mockImplementation((url, options) =>
      Promise.resolve(
        options?.method === "POST"
          ? response(201, created)
          : response(200, [oldPost]),
      ),
    );
    send(dialog);
    await screen.findByText("投稿しました");
  });
  it("日本語変換中は送信しない", async () => {
    const fetch = await mount();
    const { dialog } = open();
    type();
    const input = screen.getByRole("textbox", { name: "投稿本文" });
    fireEvent.compositionStart(input);
    fireEvent.submit(dialog.querySelector("form"));
    expect(
      fetch.mock.calls.filter(([, o]) => o.method === "POST"),
    ).toHaveLength(0);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.compositionEnd(input);
    send(dialog);
    await screen.findByText("投稿しました");
  });
  it("5秒で本文保持の失敗となり、期限後の応答を無視する", async () => {
    const post = deferred();
    await mount(undefined, post.promise);
    vi.useFakeTimers();
    const { dialog } = open();
    type();
    send(dialog);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("alert")).toHaveTextContent("保存済みの可能性");
    expect(screen.getByRole("textbox", { name: "投稿本文" }).value).toBe(
      created.body,
    );
    expect(
      within(dialog).getByRole("button", { name: "投稿する" }),
    ).toBeEnabled();
    await act(async () => post.resolve(response(201, created)));
    expect(screen.queryByText("投稿しました")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it.each(["network", "invalid", "unexpected"])(
    "結果不明（%s）は一覧確認へ進める",
    async (kind) => {
      const post = deferred();
      const fetch = await mount(undefined, post.promise);
      const { dialog } = open();
      type();
      send(dialog);
      await act(async () => {
        if (kind === "network") post.reject(new TypeError("offline"));
        else
          post.resolve(
            kind === "invalid" ? response(201, {}) : response(502, {}),
          );
      });
      expect(screen.getByRole("alert")).toHaveTextContent("保存済みの可能性");
      fireEvent.click(screen.getByRole("button", { name: "一覧を確認する" }));
      fireEvent.click(screen.getByRole("button", { name: "入力を続ける" }));
      expect(screen.getByRole("textbox", { name: "投稿本文" }).value).toBe(
        created.body,
      );
      fireEvent.click(screen.getByRole("button", { name: "一覧を確認する" }));
      fireEvent.click(screen.getByRole("button", { name: "破棄する" }));
      await waitFor(() =>
        expect(
          fetch.mock.calls.filter(([, o]) => o.method !== "POST"),
        ).toHaveLength(2),
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
});

describe("画面の離脱", () => {
  it("未完了の投稿を中断して遅延応答を無視する", async () => {
    const post = deferred();
    const fetch = await mount(undefined, post.promise);
    const { dialog } = open();
    type();
    send(dialog);
    const signal = fetch.mock.calls.find(
      ([, options]) => options.method === "POST",
    )[1].signal;
    fetch.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => post.resolve(response(201, created)));
    expect(screen.queryByText("投稿しました")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("投稿成功と一覧取得の競合", () => {
  it.each([200, 500])("遅れて届くGET（%i）で投稿を消さない", async (status) => {
    const get = deferred();
    await mount(get.promise);
    const { dialog } = open();
    type();
    send(dialog);
    await screen.findByText("投稿しました");
    await act(async () =>
      get.resolve(response(status, status === 200 ? [oldPost] : {})),
    );
    expect(
      screen.getByRole("article", { name: "自分の投稿" }),
    ).toBeInTheDocument();
    if (status === 500) {
      expect(
        screen.getByRole("button", { name: "再試行" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "投稿一覧を取得できませんでした。",
      );
    }
  });
  it("再取得した同じIDは重複させずGETの表示日時へ更新する", async () => {
    const get = deferred();
    const fetch = await mount(get.promise);
    const { dialog } = open();
    type();
    send(dialog);
    await screen.findByText("投稿しました");
    await act(async () => get.resolve(response(500, {})));
    fetch.mockResolvedValue(
      response(200, [{ ...created, displayed_at: "1分" }, oldPost]),
    );
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    await screen.findByText("1分");
    expect(screen.getAllByRole("article", { name: "自分の投稿" })).toHaveLength(
      1,
    );
    expect(screen.queryByText("たった今")).not.toBeInTheDocument();
  });
});
