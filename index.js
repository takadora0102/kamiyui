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

// --- 国旗リアクション → ISO 639-1 言語コードマッピング ---
const FLAG_TO_LANG = {
  '🇯🇵': 'ja', // Japanese
  '🇬🇧': 'en', // English (UK)
  '🇺🇸': 'en', // English (US)
  '🇨🇳': 'zh', // Mandarin Chinese
  '🇮🇳': 'hi', // Hindi
  '🇪🇸': 'es', // Spanish
  '🇸🇦': 'ar', // Arabic
  '🇫🇷': 'fr', // French
  '🇧🇩': 'bn', // Bengali
  '🇵🇹': 'pt', // Portuguese
  '🇷🇺': 'ru', // Russian
  '🇮🇩': 'id'  // Indonesian
};

// --- Translation Helper via Google public endpoint ---
async function translate(text, target) {
  const url =
    'https://translate.googleapis.com/translate_a/single' +
    '?client=gtx' +
    '&sl=auto' +
    `&tl=${target}` +
    '&dt=t' +
    `&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Translation API error: ${res.status}`);
  }
  const data = await res.json();
  // data[0] is array of [ [translatedSegment, originalSegment, ...], ... ]
  return data[0].map(item => item[0]).join('');
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
    const msg =
      err.message.includes('Translation API error') || err.code === 'ENOTFOUND'
        ? '⚠️ 翻訳サーバーが応答しませんでした。時間を置いて再度リアクションしてください。'
        : '❌ 翻訳中にエラーが発生しました。後ほど再度お試しください。';
    await reaction.message.reply(msg);
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
