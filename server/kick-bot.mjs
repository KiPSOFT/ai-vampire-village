import { createClient } from '@retconned/kick-js';
import readline from 'readline';

/**
 * Start the Kick chat bot.
 * Receives dependencies from the main server (index.mjs).
 */
export async function startKickBot({ engine, setSendToKick, broadcastState, getEngine }) {
  const KICK_CHANNEL = process.env.KICK_CHANNEL || 'your_channel_name';
  const KICK_BEARER  = process.env.KICK_BEARER || '';
  const KICK_XSRF    = process.env.KICK_XSRF || '';
  const KICK_COOKIES  = process.env.KICK_COOKIES || '';

  let kickClient = null;

  async function sendToKick(agentName, targetAgent, message) {
    if (!kickClient) return;
    try {
      // Eğer login başarılı olmamışsa veya kanal hazır değilse bekleyelim
      if (!kickClient.channelId) {
        console.warn('[KICK-DEBUG] Uyarı: Kanal ID henüz hazır değil, mesaj bekletiliyor.');
        return;
      }
      
      const targetLabel = targetAgent ? ` -> ${targetAgent}` : '';
      const sanitized = String(message).replace(/[\n\r]+/g, ' '); 
      const textToSend = `[${agentName}${targetLabel}]: ${sanitized}`;
      const truncated = textToSend.length > 400 ? textToSend.substring(0, 397) + '...' : textToSend;
      
      console.log(`[KICK-DEBUG] Mesaj gönderiliyor... (Kanal: ${KICK_CHANNEL})`);
      await kickClient.sendMessage(truncated);
      console.log(`[KICK-DEBUG] Mesaj başarıyla Kick chat'e iletildi!`);
    } catch (e) {
      console.error('[KICK-DEBUG] HATA: Kick\'e mesaj gönderilemedi:', e.message);
    }
  }

  if (!KICK_BEARER || !KICK_XSRF || !KICK_COOKIES) {
    // ... (mevcut kodun devamı aynı kalabilir)
    console.log('');
    console.log('🔄 Bot Kick bağlantısız çalışıyor (Token eksik). Konsoldan !vote [isim] kullanarak test edebilirsiniz.');
    
    // Add STDIN reader for local testing
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on('line', (line) => {
      const text = line.trim();
      if (text.toLowerCase().startsWith('!vote ')) {
        const args = text.split(/\s+/).slice(1);
        const targetName = args.join(' ');
        
        if (!targetName) return;

        const currentEngine = getEngine ? getEngine() : engine;
        if (!currentEngine) return;

        const uid = 'console_user';
        const registered = currentEngine.registerVote(targetName, `chat:${uid}`, String(uid));
        if (registered) {
          console.log(`📥 VOTE REGISTERED (Console): Voted for ${targetName}`);
          if (typeof broadcastState === 'function') broadcastState();
        } else {
          console.log(`❌ VOTE FAILED (Console): Voted for ${targetName} (Not in Voting Phase or Name Not Found)`);
        }
      }
    });

    setSendToKick(sendToKick);
    return;
  }

  kickClient = createClient(KICK_CHANNEL, { logger: true, readOnly: false });
  setSendToKick(sendToKick);

  kickClient.on("ready", async () => {
    console.log(`✅ Kick Bot hazır! Kanal: ${KICK_CHANNEL}`);
    try {
      await kickClient.sendMessage(`🤖 AI Village is playing! Type '!vote AgentName' during voting phase. | Vampire Villager oynanıyor! Oylama fazında '!vote Ajanİsmi' yazarak vampiri seçin.`);
    } catch (e) {}
  });

  kickClient.on("ChatMessage", async (message) => {
    const text = message.content.trim();
    if (text.toLowerCase().startsWith('!vote ')) {
      const args = text.split(/\s+/).slice(1);
      const targetName = args.join(' ');
      
      if (!targetName) return;

      const currentEngine = getEngine ? getEngine() : engine;
      if (!currentEngine) return;

      const uid = message.sender?.username ?? message.sender?.id ?? 'anon';
      const registered = currentEngine.registerVote(targetName, `chat:${uid}`, String(uid));
      if (registered) {
        console.log(`📥 VOTE REGISTERED: ${message.sender.username} voted for ${targetName}`);
        if (typeof broadcastState === 'function') broadcastState();
      } else {
        console.log(`❌ VOTE FAILED: ${message.sender.username} voted for ${targetName} (Not in Voting Phase or Name Not Found)`);
      }
    }
  });

  try {
    await kickClient.login({
      type: "tokens",
      credentials: {
        bearerToken: KICK_BEARER.trim(),
        xsrfToken: KICK_XSRF.trim(),
        cookies: KICK_COOKIES.trim(),
      },
    });
    console.log('✅ Kick\'e token ile başarıyla bağlanıldı!');
  } catch (err) {
    console.error('❌ Kick token girişi başarısız:', err.message);
  }
}
