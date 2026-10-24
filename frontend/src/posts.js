const postKeys = [
  "post_id",
  "author",
  "body",
  "posted_at",
  "reply_count",
  "retweet_count",
  "like_count",
];

export function isPost(post) {
  if (!post || typeof post !== "object") return false;
  return (
    Number.isSafeInteger(post.post_id) &&
    post.post_id > 0 &&
    ["author", "body", "posted_at", "displayed_at"].every(
      (key) => typeof post[key] === "string",
    ) &&
    ["reply_count", "retweet_count", "like_count"].every(
      (key) => Number.isSafeInteger(post[key]) && post[key] >= 0,
    ) &&
    Number.isFinite(Date.parse(post.posted_at))
  );
}

export function isCreatedPost(post) {
  return (
    post &&
    Object.keys(post).length === postKeys.length &&
    postKeys.every((key) => Object.hasOwn(post, key)) &&
    isPost({ ...post, displayed_at: "たった今" })
  );
}

export function isValidBody(body) {
  return Array.from(body).length <= 280 && /[^ \u3000\t\n\r\v\f]/u.test(body);
}

// Date.parseのミリ秒より細かい部分も比較し、APIの日時順を維持する。
function microseconds(post) {
  const fraction = post.posted_at.match(/\.(\d+)/)?.[1] ?? "";
  return Number(fraction.padEnd(6, "0").slice(3, 6));
}

export function mergePosts(...groups) {
  const byId = new Map(groups.flat().map((post) => [post.post_id, post]));
  return [...byId.values()].sort(
    (a, b) =>
      Date.parse(b.posted_at) - Date.parse(a.posted_at) ||
      microseconds(b) - microseconds(a) ||
      b.post_id - a.post_id,
  );
}
