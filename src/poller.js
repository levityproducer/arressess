import { WebhookClient } from "discord.js";
import * as db from "./db.js";
import { fetchFeed, itemGuid, feedDisplayName, feedAvatar } from "./feeds.js";

const MAX_POSTS_PER_POLL = 5; // per feed, oldest first; the rest are just marked seen

export function startPolling(client, intervalMs) {
  const tick = () => pollAll(client).catch((err) => console.error("poll error:", err));
  tick();
  setInterval(tick, intervalMs);
}

async function pollAll(client) {
  for (const feed of db.allFeeds.all()) {
    try {
      await pollFeed(client, feed);
    } catch (err) {
      console.error(`feed ${feed.id} (${feed.url}) failed:`, err.message);
    }
  }
}

async function pollFeed(client, feed) {
  const parsed = await fetchFeed(feed.url);

  const title = feedDisplayName(feed, parsed);
  const avatar = feedAvatar(feed, parsed);
  if (title !== feed.title || avatar !== feed.avatar_url) {
    db.updateFeedMeta.run(title, avatar, feed.id);
  }

  const fresh = (parsed.items || []).filter(
    (item) => !db.hasSeen.get(feed.id, itemGuid(item))
  );
  if (fresh.length === 0) return;

  // Oldest first so the channel reads chronologically.
  fresh.reverse();
  const toPost = fresh.slice(-MAX_POSTS_PER_POLL);

  for (const item of fresh) db.markSeen.run(feed.id, itemGuid(item));

  let webhook = await getChannelWebhook(client, feed);
  if (!webhook) return;

  for (const item of toPost) {
    if (!item.link) continue;
    const message = {
      // Post the bare link — Discord unfurls it with the site's OpenGraph data.
      content: item.link,
      username: title,
      avatarURL: avatar ?? undefined,
      allowedMentions: { parse: [] },
    };
    try {
      await webhook.send(message);
    } catch (err) {
      if (err.code !== 10015) throw err; // 10015 = Unknown Webhook (deleted by hand)
      db.deleteWebhook.run(feed.channel_id);
      webhook = await getChannelWebhook(client, feed);
      if (!webhook) return;
      await webhook.send(message);
    }
  }
}

// Marks every current item as seen without posting, so a newly added feed
// doesn't flood the channel with its backlog.
export async function primeFeed(feedId, parsed) {
  for (const item of parsed.items || []) {
    db.markSeen.run(feedId, itemGuid(item));
  }
}

async function getChannelWebhook(client, feed) {
  const cached = db.getWebhook.get(feed.channel_id);
  if (cached) {
    return new WebhookClient({ id: cached.webhook_id, token: cached.webhook_token });
  }

  const channel = await client.channels.fetch(feed.channel_id).catch(() => null);
  if (!channel || !channel.createWebhook) {
    console.error(`channel ${feed.channel_id} unavailable for feed ${feed.id}`);
    return null;
  }

  try {
    const hook = await channel.createWebhook({
      name: "arressess",
      reason: "RSS feed posts",
    });
    db.saveWebhook.run(feed.channel_id, hook.id, hook.token);
    return new WebhookClient({ id: hook.id, token: hook.token });
  } catch (err) {
    console.error(`cannot create webhook in ${feed.channel_id}:`, err.message);
    return null;
  }
}
