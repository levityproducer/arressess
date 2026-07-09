import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} from "discord.js";
import * as db from "./db.js";
import { resolveFeed, feedDisplayName, feedAvatar } from "./feeds.js";
import { primeFeed, postItems } from "./poller.js";

export const commandData = new SlashCommandBuilder()
  .setName("feed")
  .setDescription("Manage RSS feeds for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Watch an RSS/Atom feed and post new entries")
      .addStringOption((opt) =>
        opt.setName("url").setDescription("Feed URL").setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel to post in (default: this one)")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Stop watching a feed")
      .addIntegerOption((opt) =>
        opt
          .setName("feed")
          .setDescription("Which feed")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List watched feeds")
  )
  .toJSON();

export async function handleAutocomplete(interaction) {
  const feeds = db.listFeedsForGuild.all(interaction.guildId);
  const query = interaction.options.getFocused().toLowerCase();
  const choices = feeds
    .map((f) => ({
      name: `${f.title || f.url} (#${f.id})`.slice(0, 100),
      value: f.id,
    }))
    .filter((c) => c.name.toLowerCase().includes(query))
    .slice(0, 25);
  await interaction.respond(choices);
}

export async function handleCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "add") return handleAdd(interaction);
  if (sub === "remove") return handleRemove(interaction);
  if (sub === "list") return handleList(interaction);
}

async function handleAdd(interaction) {
  const inputUrl = interaction.options.getString("url", true);
  const channel = interaction.options.getChannel("channel") ?? interaction.channel;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let url, parsed;
  try {
    ({ url, parsed } = await resolveFeed(inputUrl));
  } catch (err) {
    return interaction.editReply(
      `Couldn't find a feed at that URL: ${err.message}`
    );
  }

  let feedId;
  try {
    const result = db.addFeed.run(
      interaction.guildId,
      channel.id,
      url,
      feedDisplayName({ url }, parsed),
      feedAvatar({ url }, parsed),
      interaction.user.id
    );
    feedId = result.lastInsertRowid;
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return interaction.editReply(`That feed is already being watched in <#${channel.id}>.`);
    }
    throw err;
  }

  // Don't dump the backlog — only entries published from now on get posted.
  await primeFeed(feedId, parsed);

  // Post the most recent entry right away, as a sample and a live check
  // that the bot can actually post in the channel.
  const latest = (parsed.items || []).find((item) => item.link);
  const feed = db.getFeed.get(feedId);
  const posted = latest ? await postItems(interaction.client, feed, parsed, [latest]) : false;

  if (latest && !posted) {
    return interaction.editReply(
      `Watching **${parsed.title || url}**, but I couldn't post in <#${channel.id}> — ` +
        `make sure I have the **Manage Webhooks** permission there.`
    );
  }
  return interaction.editReply(
    `Watching **${parsed.title || url}** — new entries will be posted in <#${channel.id}>.` +
      (posted ? " Here's the most recent one as a sample. ☝️" : "")
  );
}

async function handleRemove(interaction) {
  const feedId = interaction.options.getInteger("feed", true);
  const feed = db.getFeed.get(feedId);
  if (!feed || feed.guild_id !== interaction.guildId) {
    return interaction.reply({
      content: "No such feed on this server.",
      flags: MessageFlags.Ephemeral,
    });
  }
  db.removeFeed.run(feedId, interaction.guildId);
  return interaction.reply({
    content: `Stopped watching **${feed.title || feed.url}**.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleList(interaction) {
  const feeds = db.listFeedsForGuild.all(interaction.guildId);
  if (feeds.length === 0) {
    return interaction.reply({
      content: "No feeds yet. Add one with `/feed add`.",
      flags: MessageFlags.Ephemeral,
    });
  }
  const lines = feeds.map(
    (f) => `\`#${f.id}\` **${f.title || f.url}** → <#${f.channel_id}>\n<${f.url}>`
  );
  return interaction.reply({
    content: lines.join("\n").slice(0, 2000),
    flags: MessageFlags.Ephemeral,
  });
}
