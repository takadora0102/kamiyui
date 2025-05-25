// index.js
import 'dotenv/config';
import fetch from 'node-fetch';
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

// --- Translation Helper with retry & longer timeout ---
async function translate(text, target) {
  const url = 'https://translate.argosopentech.com/translate';
  const body = JSON.stringify({ q: text, source: 'auto', target, format: 'text' });

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`Translation API error: ${res.status}`);
      }

      const { translatedText } = await res.json();
      clearTimeout(timeoutId);
      return translatedText;

    } catch (err) {
      clearTimeout(timeoutId);

      // タイムアウト時のリトライ
      if (err.name === 'AbortError' && attempt < 3) {
        console.warn(`⏳ translate timeout, retrying... (${attempt}/3)`);
        // バックオフ
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }

      // それ以外、または最終試行でも失敗なら投げ直し
      throw err;
    }
  }
}

// --- Reaction Event Handler ---
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  try {
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
        '⚠️ 翻訳処理がタイムアウトしました。しばらく置いてからもう一度リアクションしてください。'
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
