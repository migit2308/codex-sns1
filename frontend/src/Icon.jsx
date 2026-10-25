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

export default function Icon({ name }) {
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
