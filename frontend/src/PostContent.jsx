import Icon from "./Icon";

export default function PostContent({ post, dateLabel, detail = false }) {
  const counts = [
    ["reply", "リプライ数", post.reply_count],
    ["retweet", "リツイート数", post.retweet_count],
    ["heart", "いいね数", post.like_count],
  ];
  return (
    <>
      <div className="avatar" aria-hidden="true">
        {Array.from(post.author)[0]}
      </div>
      <div className="post-content">
        <header className="post-meta">
          <h2>{post.author}</h2>
          {!detail && <span aria-hidden="true">·</span>}
          {!detail && (
            <time dateTime={post.posted_at} title={post.posted_at}>
              {dateLabel}
            </time>
          )}
        </header>
        <p className="post-body">{post.body}</p>
        {detail && (
          <time className="detail-time" dateTime={post.posted_at}>
            {dateLabel}
          </time>
        )}
        <div className="post-counts">
          {counts.map(([icon, label, count]) => (
            <span key={icon} aria-label={`${label} ${count}`}>
              <Icon name={icon} />
              <span>{count}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
