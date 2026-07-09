import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15000,
  headers: { "user-agent": "arressess/0.1 (+https://github.com/levityproducer/arressess)" },
});

export async function fetchFeed(url) {
  return parser.parseURL(url);
}

// A stable identifier for a feed item, best-effort.
export function itemGuid(item) {
  return item.guid || item.id || item.link || `${item.title}|${item.pubDate}`;
}

// Display name for the feed's pseudo-identity. Discord caps webhook
// usernames at 80 chars and disallows the word "discord" in some spots;
// keep it simple and truncate.
export function feedDisplayName(feed, parsed) {
  const name = (parsed?.title || feed.title || hostnameOf(feed.url)).trim();
  return name.slice(0, 80) || "RSS";
}

export function feedAvatar(feed, parsed) {
  if (parsed?.image?.url) return parsed.image.url;
  const host = hostnameOf(feed.url);
  return host
    ? `https://www.google.com/s2/favicons?domain=${host}&sz=128`
    : null;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
