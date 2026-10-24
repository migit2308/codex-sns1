import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { isPost, LeftSidebar, PostCard, RightSidebar, Timeline } from "./App";

const post = {
  post_id: 1,
  author: "ユーザーA",
  body: "本文\n次の行\n<script>alert(1)</script>",
  posted_at: "2026-10-20T12:00:00Z",
  displayed_at: "2日",
  reply_count: 2,
  retweet_count: 1,
  like_count: 5,
};

describe("投稿一覧", () => {
  it("読み込み中を通知する", () => {
    render(<Timeline status="loading" posts={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "投稿を読み込んでいます…",
    );
    expect(screen.getByRole("region", { name: "投稿一覧" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
  it("成功0件は空の状態を表示する", () => {
    render(<Timeline status="success" posts={[]} />);
    expect(screen.getByText("まだ投稿がありません")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("失敗時の再試行から処理を開始できる", () => {
    const retry = vi.fn();
    render(<Timeline status="error" posts={[]} retry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "投稿一覧を取得できませんでした。",
    );
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("再試行中の二重操作を防ぐ", () => {
    const retry = vi.fn();
    render(<Timeline status="loading" posts={[]} retry={retry} retrying />);
    fireEvent.click(screen.getByRole("button", { name: "再試行中…" }));
    expect(retry).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeDisabled();
  });
  it("APIから受け取った順序を維持する", () => {
    render(
      <Timeline
        status="success"
        posts={[{ ...post, post_id: 3, author: "ユーザーC" }, post]}
      />,
    );
    expect(
      screen
        .getAllByRole("article")
        .map((node) => node.getAttribute("aria-label")),
    ).toEqual(["ユーザーCの投稿", "ユーザーAの投稿"]);
  });
  it("改行と本文をテキストとして保持し、件数と表示日時を表示する", () => {
    const { container } = render(<PostCard post={post} />);
    expect(container.querySelector(".post-body").textContent).toBe(post.body);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("2日")).toHaveAttribute("dateTime", post.posted_at);
    for (const label of ["リプライ数 2", "リツイート数 1", "いいね数 5"])
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("未実装のサイドバー機能は操作できない", () => {
    render(
      <>
        <LeftSidebar />
        <RightSidebar />
      </>,
    );
    expect(
      screen.getByRole("link", { name: "ホーム", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    screen.getAllByRole("button").forEach((button) => {
      if (button.textContent === "投稿する") expect(button).toBeEnabled();
      else expect(button).toBeDisabled();
    });
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getAllByText("準備中").length).toBeGreaterThan(1);
  });
});

describe("応答項目の検証", () => {
  it("Postの8項目がある正常データを受け付ける", () => {
    expect(isPost(post)).toBe(true);
  });
  it.each([
    null,
    {},
    { ...post, author: null },
    { ...post, like_count: -1 },
    { ...post, reply_count: 1.5 },
    { ...post, posted_at: "不正な日時" },
  ])("不正な投稿データを受け付けない", (value) => {
    expect(isPost(value)).toBe(false);
  });
});
