import { Client, GatewayIntentBits, Routes, REST, ActivityType } from "discord.js";
import { commandData, handleCommand, handleAutocomplete } from "./commands.js";
import { startPolling } from "./poller.js";

const { DISCORD_TOKEN, APP_ID, POLL_INTERVAL_SECONDS = "300" } = process.env;
if (!DISCORD_TOKEN || !APP_ID) {
  console.error("Set DISCORD_TOKEN and APP_ID (see .env.example).");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST().setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(APP_ID), { body: [commandData] });
  console.log("Slash commands registered.");

  client.user.setPresence({
    activities: [{ type: ActivityType.Custom, name: "status", state: "serving RSS 📡" }],
    status: "online",
  });

  await client.application.edit({
    description:
      "I am a simple RSS bot! 📰 I represent iggy and Fable's desire to assist you! ✨\n" +
      "https://github.com/levityproducer/arressess",
  });
  console.log("Presence and bio set.");

  startPolling(client, Number(POLL_INTERVAL_SECONDS) * 1000);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isAutocomplete()) return await handleAutocomplete(interaction);
    if (interaction.isChatInputCommand() && interaction.commandName === "feed") {
      return await handleCommand(interaction);
    }
  } catch (err) {
    console.error("interaction error:", err);
    const reply = { content: "Something went wrong.", ephemeral: true };
    if (interaction.isRepliable()) {
      (interaction.deferred || interaction.replied
        ? interaction.editReply(reply)
        : interaction.reply(reply)
      ).catch(() => {});
    }
  }
});

client.login(DISCORD_TOKEN);
