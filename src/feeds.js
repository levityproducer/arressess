import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15000,
  headers: { "user-agent": "arressess/0.1 (+https://github.com/levityproducer/arressess)" },
});

export async function fetchFeed(url) {
  return parser.parseURL(url);
}

// Accepts either a feed URL or a regular page URL. If the URL isn't a feed,
// falls back to HTML autodiscovery (<link rel="alternate" type="application/rss+xml">).
// Returns { url, parsed } with the resolved feed URL.
export async function resolveFeed(url) {
  try {
    return { url, parsed: await fetchFeed(url) };
  } catch (feedErr) {
    const discovered = await discoverFeedUrl(url);
    if (!discovered) throw feedErr;
    return { url: discovered, parsed: await fetchFeed(discovered) };
  }
}

async function discoverFeedUrl(pageUrl) {
  let html;
  try {
    const res = await fetch(pageUrl, {
      headers: { "user-agent": "arressess/0.1" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    html = (await res.text()).slice(0, 512 * 1024);
  } catch {
    return null;
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (!/rel=["']?alternate["']?/i.test(tag)) continue;
    if (!/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      return new URL(href, pageUrl).toString();
    } catch {
      continue;
    }
  }
  return null;
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
