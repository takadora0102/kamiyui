// index.js
import 'dotenv/config';
import fetch from 'node-fetch';
import AbortController from 'abort-controller';
import express from 'express';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events
} from 'discord.js';

// --- Discord Client Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel]
});

// 国旗リアクション → 言語コードマッピング
const FLAG_TO_LANG = {
  '🇯🇵': 'ja',
  '🇺🇸': 'en',
  '🇬🇧': 'en'
};

// --- Translation Helper ---
async function translate(text, target) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

  try {
    const res = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'auto',
        target,
        format: 'text'
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Translation API error: ${res.status}`);
    }
    const { translatedText } = await res.json();
    return translatedText;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Reaction Event Handler ---
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  try {
    // Partial objects handling
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const lang = FLAG_TO_LANG[reaction.emoji.name];
    if (!lang) return;

    const original = reaction.message.content;
    if (!original) return;

    const translated = await translate(original, lang);
    await reaction.message.reply({
      content: `> ${original}\n\n**${translated}**`
    });
  } catch (err) {
    console.error('❌ 翻訳中にエラーが発生しました:', err);

    if (err.name === 'AbortError') {
      await reaction.message.reply(
        '⚠️ 翻訳処理がタイムアウトしました。時間を置いて再度リアクションしてください。'
      );
      return;
    }

    await reaction.message.reply(
      '❌ 翻訳中にエラーが発生しました。後ほど再度お試しください。'
    );
  }
});

// --- Ready Event ---
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// --- Start Discord Client ---
client.login(process.env.DISCORD_TOKEN);

// --- Express HTTP Server (for Render Web Service) ---
const app = express();
app.get('/', (_req, res) => res.send('OK'));
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌐 HTTP server listening on port ${port}`);
});
