# arressess

A minimal Discord RSS bot. Server admins add RSS/Atom feeds with a slash
command; when a feed publishes a new entry, the bot posts the link and lets
Discord's own OpenGraph unfurling render the preview.

Each feed posts through a channel webhook with the feed's title as the
username and its favicon as the avatar, so every feed gets its own
pseudo-identity in the channel.

## Commands

All commands require the **Manage Server** permission.

- `/feed add url:<feed url> [channel]` — watch a feed (posts to the current channel by default)
- `/feed remove feed:<pick from list>` — stop watching a feed
- `/feed list` — list watched feeds

Adding a feed does not post its backlog; only entries published after that
point are posted.

## Running

```sh
npm install
cp .env.example .env   # fill in DISCORD_TOKEN
npm start
```

State lives in `data/arressess.db` (SQLite). The bot polls every
`POLL_INTERVAL_SECONDS` (default 300).

## Discord setup

1. In the [dev portal](https://discord.com/developers/applications), open the
   app → **Bot** → Reset Token, and put it in `.env`. No privileged intents
   are needed.
2. Invite it with scopes `bot applications.commands` and permissions
   **Manage Webhooks**, **Send Messages**, **Embed Links**:

   ```
   https://discord.com/oauth2/authorize?client_id=1524834504915681340&scope=bot+applications.commands&permissions=536889344
   ```
