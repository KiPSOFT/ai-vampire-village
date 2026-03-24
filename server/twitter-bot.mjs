import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// .env dosyasını yükle (ES modules'da import'lar önce çalıştığı için burada da yüklemeliyiz)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const KICK_URL = 'kick.com/aivampirevillage';

/**
 * Twitter API v2 client for posting tweets
 */
class TwitterBot {
  constructor() {
    this.apiKey = process.env.TWITTER_API_KEY || '';
    this.apiSecret = process.env.TWITTER_API_SECRET || '';
    this.accessToken = process.env.TWITTER_ACCESS_TOKEN || '';
    this.accessSecret = process.env.TWITTER_ACCESS_SECRET || '';
    this.enabled = !!(this.apiKey && this.apiSecret && this.accessToken && this.accessSecret);
    
    if (this.enabled) {
      this.oauth = new OAuth({
        consumer: { key: this.apiKey, secret: this.apiSecret },
        signature_method: 'HMAC-SHA1',
        hash_function: (baseString, key) => crypto.createHmac('sha1', key).update(baseString).digest('base64')
      });
      this.token = { key: this.accessToken, secret: this.accessSecret };
      console.log('✅ Twitter Bot hazır! Tweet atma aktif.');
      console.log('[TWITTER DEBUG] API Key:', this.apiKey.substring(0, 8) + '...');
      console.log('[TWITTER DEBUG] Access Token:', this.accessToken.substring(0, 15) + '...');
    } else {
      console.log('🔄 Twitter Bot pasif (API anahtarları eksik).');
      console.log('[TWITTER DEBUG] API Key var mı:', !!this.apiKey);
      console.log('[TWITTER DEBUG] API Secret var mı:', !!this.apiSecret);
      console.log('[TWITTER DEBUG] Access Token var mı:', !!this.accessToken);
      console.log('[TWITTER DEBUG] Access Secret var mı:', !!this.accessSecret);
    }
  }

  async postTweet(text) {
    if (!this.enabled) {
      console.log('[TWITTER] Pasif - tweet atılmadı:', text.substring(0, 50) + '...');
      return false;
    }

    // Tweet max 280 karakter, URL eklenecek
    const maxLength = 280 - KICK_URL.length - 1; // -1 for space
    let finalText = text;
    if (text.length > maxLength) {
      finalText = text.substring(0, maxLength - 3) + '...';
    }
    finalText += `\n${KICK_URL}`;

    const requestData = {
      url: 'https://api.twitter.com/2/tweets',
      method: 'POST',
      data: { text: finalText }
    };

    const authHeader = this.oauth.toHeader(this.oauth.authorize(requestData, this.token));
    
    console.log('[TWITTER DEBUG] Request URL:', requestData.url);
    console.log('[TWITTER DEBUG] Auth Header:', authHeader.Authorization.substring(0, 50) + '...');
    console.log('[TWITTER DEBUG] Tweet text length:', finalText.length);

    try {
      const response = await fetch(requestData.url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader.Authorization,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: finalText })
      });

      const result = await response.json();
      
      console.log('[TWITTER DEBUG] Response status:', response.status);
      console.log('[TWITTER DEBUG] Response:', JSON.stringify(result).substring(0, 200));
      
      if (response.ok) {
        console.log(`🐦 Tweet atıldı: "${finalText.substring(0, 50)}..."`);
        return true;
      } else {
        console.error('❌ Twitter API hatası:', result);
        return false;
      }
    } catch (err) {
      console.error('❌ Tweet atılamadı:', err.message);
      return false;
    }
  }

  /**
   * Yeni oyun turu başlangıcı tweet'i
   */
  async tweetGameStart(dayCount) {
    const text = `🧛 A new AI Vampire Village game has started!\n\n🌙 Night ${dayCount} - The vampire is secretly among them...\n\nWho will survive?`;
    return this.postTweet(text);
  }

  /**
   * Agent isimleri ve modeller tweet'i
   */
  async tweetAgents(agents) {
    const agentList = agents.map(a => `${a.name} (${a.model.split('/').pop()})`).join(', ');
    const text = `🤖 Today's AI agents in the village:\n\n${agentList}\n\nEach one thinks with a different LLM!`;
    return this.postTweet(text);
  }

  /**
   * Gün sonu oylama ile elenen kişi
   */
  async tweetExiled(name, wasVampire) {
    const emoji = wasVampire ? '🧛' : '😢';
    const text = wasVampire 
      ? `${emoji} VILLAGERS WIN!\n\n${name} was exiled by vote and THEY WERE A VAMPIRE!\n\nThe vampire has been caught - the village is safe!`
      : `${emoji} ${name} was exiled by the day vote.\n\nSadly, they were an innocent villager. The vampire still lurks among them...`;
    return this.postTweet(text);
  }

  /**
   * Gece vampir tarafından öldürülen kişi
   */
  async tweetMurdered(name) {
    const text = `💀 A gruesome night!\n\n${name} was found dead in the village square this morning.\n\nThe vampire has chosen their prey...`;
    return this.postTweet(text);
  }

  /**
   * Oyun sonu kazanan ve genel skor
   */
  async tweetGameEnd(winner, villagerScore, vampireScore) {
    const isVillagersWin = winner === 'villagers';
    const emoji = isVillagersWin ? '🎉🧑‍🌾' : '🧛‍♂️🌙';
    const text = isVillagersWin
      ? `${emoji} GAME OVER!\n\nVILLAGERS WIN! The vampire has been caught!\n\n📊 OVERALL SCORE:\n🧑‍🌾 Villagers: ${villagerScore}\n🧛 Vampire: ${vampireScore}`
      : `${emoji} GAME OVER!\n\nVAMPIRE WINS! The village is drenched in blood...\n\n📊 OVERALL SCORE:\n🧑‍🌾 Villagers: ${villagerScore}\n🧛 Vampire: ${vampireScore}`;
    return this.postTweet(text);
  }
}

export const twitterBot = new TwitterBot();
