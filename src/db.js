import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";

mkdirSync("data", { recursive: true });
const db = new Database("data/arressess.db");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    avatar_url TEXT,
    added_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE (channel_id, url)
  );

  CREATE TABLE IF NOT EXISTS seen_items (
    feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    guid TEXT NOT NULL,
    PRIMARY KEY (feed_id, guid)
  );

  CREATE TABLE IF NOT EXISTS webhooks (
    channel_id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    webhook_token TEXT NOT NULL
  );
`);

export const addFeed = db.prepare(
  `INSERT INTO feeds (guild_id, channel_id, url, title, avatar_url, added_by)
   VALUES (?, ?, ?, ?, ?, ?)`
);
export const removeFeed = db.prepare(
  `DELETE FROM feeds WHERE id = ? AND guild_id = ?`
);
export const listFeedsForGuild = db.prepare(
  `SELECT * FROM feeds WHERE guild_id = ? ORDER BY id`
);
export const allFeeds = db.prepare(`SELECT * FROM feeds ORDER BY id`);
export const getFeed = db.prepare(`SELECT * FROM feeds WHERE id = ?`);
export const updateFeedMeta = db.prepare(
  `UPDATE feeds SET title = ?, avatar_url = ? WHERE id = ?`
);

export const hasSeen = db.prepare(
  `SELECT 1 FROM seen_items WHERE feed_id = ? AND guid = ?`
);
export const markSeen = db.prepare(
  `INSERT OR IGNORE INTO seen_items (feed_id, guid) VALUES (?, ?)`
);

export const getWebhook = db.prepare(
  `SELECT * FROM webhooks WHERE channel_id = ?`
);
export const saveWebhook = db.prepare(
  `INSERT OR REPLACE INTO webhooks (channel_id, webhook_id, webhook_token) VALUES (?, ?, ?)`
);
export const deleteWebhook = db.prepare(
  `DELETE FROM webhooks WHERE channel_id = ?`
);

export default db;
