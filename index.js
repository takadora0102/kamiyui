import express from 'express';
import 'dotenv/config';
import fetch from 'node-fetch';
import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel]
});

const FLAG_TO_LANG = {
  '🇯🇵': 'ja',
  '🇺🇸': 'en',
  '🇬🇧': 'en'
};

async function translate(text, target) {
  const res = await fetch('https://libretranslate.de/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: 'auto', target, format: 'text' })
  });
  if (!res.ok) throw new Error(`Translation API error: ${res.status}`);
  return (await res.json()).translatedText;
}

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  const lang = FLAG_TO_LANG[reaction.emoji.name];
  if (!lang) return;
  const text = reaction.message.content;
  if (!text) return;

  const translated = await translate(text, lang);
  await reaction.message.reply({ content: `> ${text}\n\n**${translated}**` });
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.login(process.env.DISCORD_TOKEN);

const app = express();
app.get('/', (req, res) => res.send('OK'));      // ヘルスチェック用
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🌐 HTTP server listening on ${port}`));