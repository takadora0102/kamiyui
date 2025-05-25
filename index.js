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

// --- List of public LibreTranslate endpoints ---
const ENDPOINTS = [
  'https://translate.argosopentech.com/translate',
  'https://libretranslate.de/translate',
  'https://translate.flossboxin.org.in/translate'
];

// --- Translation Helper with multi-endpoint retry ---
async function translate(text, target) {
  const body = JSON.stringify({ q: text, source: 'auto', target, format: 'text' });

  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const url of ENDPOINTS) {
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
        console.warn(`⚠️ [${url}] attempt ${attempt} failed:`, err.message);
        // タイムアウトや DNS エラーなら次のエンドポイントへ
        if ((err.name === 'AbortError' || err.code === 'ENOTFOUND') && url !== ENDPOINTS.at(-1)) {
          continue;
        }
        // 最終エンドポイントか他のエラーなら再試行 or throw
      }
    }
    // 少し待ってから次の全エンドポイント試行
    await new Promise(r => setTimeout(r, 1000 * attempt));
  }

  throw new Error('All translation endpoints failed.');
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
    await reaction.message.reply(
      err.message.includes('timeout') || err.code === 'ENOTFOUND'
        ? '⚠️ 翻訳サーバーが応答しませんでした。時間を置いて再度リアクションしてください。'
        : '❌ 翻訳中にエラーが発生しました。後ほど再度お試しください。'
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
