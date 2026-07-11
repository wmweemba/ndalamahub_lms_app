async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[telegram] disabled (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID unset) — skipped:', text.slice(0, 80));
    return { skipped: true };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    if (!res.ok) console.error('[telegram] send failed:', res.status, await res.text());
    return { skipped: false, ok: res.ok };
  } catch (error) {
    console.error('[telegram] send failed:', error.message);
    return { skipped: false, ok: false };
  }
}

module.exports = { sendTelegramMessage };
