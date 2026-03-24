import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';

import { SimulationEngine } from './engine.mjs';
import { getOllamaDecision } from './api/ollama.mjs';
import { getOpenRouterDecision } from './api/openrouter.mjs';
import { getGroqDecision } from './api/groq.mjs';
import { GRID_SIZE, AGENT_PERSONAS, COLORS, PHASES, ROLES, ZONES } from '../shared/types.mjs';
import { startKickBot } from './kick-bot.mjs';
import { initDb, createGameRecord, updateGameResult, addAgentGameStat, addViewerVote, getGlobalScores } from './db.mjs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
initDb();

// ─── Config from env ───
const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER || 'ollama';
const OLLAMA_URL       = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL     = process.env.OLLAMA_MODEL || 'llama3.1';
const GROQ_API_KEY     = process.env.GROQ_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODELS  = (process.env.OPENROUTER_MODELS || '')
  .split(',').map(m => m.trim()).filter(Boolean);

let _openRouterIndex = 0;
function getNextOpenRouterModel() {
  if (OPENROUTER_MODELS.length === 0) return 'meta-llama/llama-3.1-8b-instruct:free';
  const model = OPENROUTER_MODELS[_openRouterIndex % OPENROUTER_MODELS.length];
  _openRouterIndex++;
  return model;
}

// ─── Server setup ───
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// ─── Simulation state ───
let engine = null;
let currentGameId = null;
const logs = [];
const MAX_LOGS = 200;
let lastAnnouncedDay = 0;
let lastAnnouncedMurderKey = '';
let lastAnnouncedExileKey = '';

function addLog(type, message, agentName) {
  const entry = {
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now(),
    type,
    message,
    agentName
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
  io.emit('NEW_LOG', entry);
}

function broadcastState() {
  const voteState = {};
  if (engine && engine.votes) {
    engine.votes.forEach((count, id) => {
      const a = engine.agents.get(id);
      if (a) voteState[a.name] = count;
    });
  }

  const { villagerWins, vampireWins } = getGlobalScores();

  io.emit('STATE_UPDATE', {
    serverTime: Date.now(),
    agents: engine ? engine.getAllAgents() : [],
    currentPhase: engine ? engine.currentPhase : 'PRE_GAME',
    dayCount: engine ? engine.dayCount : 0,
    phaseEndTime: engine ? engine.phaseEndTime : 0,
    votes: voteState,
    voteLog: engine ? (engine.voteLog || []) : [],
    votingKickOpen: engine ? !!engine.votingKickOpen : false,
    voteResult: engine ? engine.lastVotingResult : null,
    villagerScore: villagerWins,
    vampireScore: vampireWins
  });
}

// ─── Initialize Game ───
function initializeGame() {
  currentSpeakerIndex = 0; // Reset speaker index for new game
  // Yeni engine instance'ı oluştur
  engine = new SimulationEngine(
    (winner, vScore, vamScore) => {
      console.log(`[GAME END] Winner: ${winner} | Score - Villagers: ${vScore}, Vampire: ${vamScore}`);
      
      // DB'ye oyun sonucunu yaz
      if (currentGameId) {
        updateGameResult(currentGameId, winner, engine.dayCount);
        // Her ajanın istatistiğini yaz
        engine.getAllAgents().forEach(agent => {
          const isWinner = (winner === 'villagers' && agent.role === ROLES.INNOCENT) || 
                           (winner === 'vampire' && agent.role === ROLES.VAMPIRE);
          addAgentGameStat(currentGameId, agent.name, agent.model, agent.role, isWinner);
        });
      }

      addLog('system', `[GAME OVER] ${winner === 'villagers' ? 'VILLAGERS WON' : 'VAMPIRE WON'}! Score - Villagers: ${vScore}, Vampire: ${vamScore}`, 'System');
      if (sendToKickFn) {
        const winnerText = winner === 'villagers' ? 'Villagers' : 'Vampire';
        sendToKickFn('System', 'Kick', `🏁 Game Over! Winner: ${winnerText}. Score => Villagers: ${vScore}, Vampire: ${vamScore}`);
      }
      // 5 saniye sonra yeni oyun başlat
      setTimeout(() => {
        console.log('[GAME] Yeni oyun başlatılıyor...');
        initializeGame();
      }, 5000);
    },
    (voterName, targetName) => {
      // İzleyici oyu DB'ye kaydet
      if (currentGameId) {
        addViewerVote(currentGameId, voterName, targetName);
      }
    }
  );
  
  // DB'de yeni oyun kaydı oluştur
  currentGameId = createGameRecord();
  
  const roles = [ROLES.VAMPIRE, ROLES.INNOCENT, ROLES.INNOCENT, ROLES.INNOCENT, ROLES.INNOCENT, ROLES.INNOCENT];
  roles.sort(() => Math.random() - 0.5);

  AGENT_PERSONAS.forEach((persona, i) => {
    const newAgent = {
      id: Math.random().toString(36).substring(7),
      name: persona.name,
      model: getNextOpenRouterModel(),
      color: COLORS[i] || '#ffffff',
      position: { x: 5, y: 5 }, // All start at Village Square
      isActive: true,
      history: [],
      roleDescription: persona.description,
      personaName: persona.name,
      provider: 'openrouter',
      role: roles[i]
    };
    engine.addAgent(newAgent);
    console.log(`[AGENT INIT] ${newAgent.name} | Role: ${newAgent.role === ROLES.VAMPIRE ? 'VAMPİR' : 'MASUM'} | Model: ${newAgent.model}`);
  });
  
  engine.startGame();
  lastAnnouncedDay = 0;
  lastAnnouncedMurderKey = '';
  lastAnnouncedExileKey = '';
  broadcastState();
  addLog('system', '[GAME INIT] Started a new Vampire Villager game!', 'System');
  if (sendToKickFn) {
    sendToKickFn('System', 'Kick', '🔁 A new game has started!');
  }
}

// ─── Kick message sender (passed to kick-bot module) ───
let sendToKickFn = null;

export function setSendToKick(fn) {
  sendToKickFn = fn;
}

// ─── Simulation tick loop ───
const TICK_RATE = 5000;
let isFetching = false;
let currentSpeakerIndex = 0;

// 1. Phase Check Loop (1hz Fast-loop)
setInterval(() => {
  if (engine && engine.checkPhaseTransition()) {
    currentSpeakerIndex = 0; // Reset speaker index on any phase change
    if (engine.currentPhase === PHASES.DAY && engine.dayCount > lastAnnouncedDay) {
      lastAnnouncedDay = engine.dayCount;
      if (sendToKickFn) {
        sendToKickFn('System', 'Kick', `🌅 Day ${engine.dayCount} has begun.`);
      }

      if (engine.lastVictim) {
        const murderKey = `${engine.dayCount}:${engine.lastVictim.id}`;
        if (murderKey !== lastAnnouncedMurderKey) {
          lastAnnouncedMurderKey = murderKey;
          if (sendToKickFn) {
            sendToKickFn('System', 'Kick', `🩸 During the night, ${engine.lastVictim.name} was killed by the vampire.`);
          }
        }
      }
    }

    if (engine.currentPhase === PHASES.VOTING_RESULT && engine.lastVotingResult) {
      if (engine.lastVotingResult.none) {
        const noneKey = `${engine.dayCount}:none`;
        if (noneKey !== lastAnnouncedExileKey) {
          lastAnnouncedExileKey = noneKey;
          if (sendToKickFn) {
            sendToKickFn('System', 'Kick', `⚖️ Voting ended in a tie. No one was exiled.`);
          }
        }
      } else if (engine.lastVotingResult.exiledId) {
        const exileKey = `${engine.dayCount}:${engine.lastVotingResult.exiledId}`;
        if (exileKey !== lastAnnouncedExileKey) {
          lastAnnouncedExileKey = exileKey;
          if (sendToKickFn) {
            const roleText = engine.lastVotingResult.isVampire ? 'VAMPIRE' : 'INNOCENT';
            sendToKickFn('System', 'Kick', `🪓 Exiled: ${engine.lastVotingResult.name}. Revealed role: ${roleText}.`);
          }
        }
      }
    }

    broadcastState();
  }
}, 1000);

// 2. LLM Action Loop
async function tick() {
  if (!engine || isFetching || engine.currentPhase === PHASES.PRE_GAME || engine.currentPhase === PHASES.VOTING_RESULT) return;

  const aliveAgents = engine.getAliveAgents();
  if (aliveAgents.length === 0) return;

  isFetching = true;

  let agent = null;
  let context = null;

  // Find the next eligible agent to speak in the round-robin queue
  for (let i = 0; i < aliveAgents.length; i++) {
    if (currentSpeakerIndex >= aliveAgents.length) currentSpeakerIndex = 0;
    
    const candidate = aliveAgents[currentSpeakerIndex];
    currentSpeakerIndex++;
    
    if (candidate.isActive) {
      context = engine.generatePrompt(candidate.id);
      if (context) {
        agent = candidate;
        break; // Found someone who is allowed to act this phase
      }
    }
  }

  if (!agent || !context) {
    isFetching = false;
    return; // Nobody left to prompt this specific tick
  }

  const systemPrompt = `You are ${agent.name}. ${agent.roleDescription}\nYou MUST reply STRICTLY with a valid JSON object matching the CRITICAL OUTPUT RULE in the context. Do not include markdown formatting like \`\`\`json.`;

  const engineAgent = engine.agents.get(agent.id);
  if (engineAgent) {
    engineAgent.isThinking = true;
    broadcastState();
  }

  try {
    let decisionStr = await getOpenRouterDecision(OPENROUTER_API_KEY, agent.model, agent.name, systemPrompt, context);

    let cleanStr = decisionStr.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanStr = jsonMatch[0];

    let decisionObj;
    try {
      decisionObj = JSON.parse(cleanStr);
    } catch (e) {
      console.warn(`⚠️ [${agent.name}] JSON parse failed:`, cleanStr.substring(0, 100));
      decisionObj = { action: 'TALK', dialogue_en: "...", dialogue_tr: "..." };
    }

    const dayLabel = `${Math.max(1, engine.dayCount)}. Gün`;
    let readableMsg = `[${dayLabel}] Unknown action`;
    
    // Type-safe conversion to prevent .trim() from crashing if dialogue is an object/null
    const dialogueEn = decisionObj.dialogue_en ? String(decisionObj.dialogue_en).trim() : "";
    const dialogueTr = decisionObj.dialogue_tr ? String(decisionObj.dialogue_tr).trim() : (decisionObj.dialogue ? String(decisionObj.dialogue).trim() : "");
    const chatMsg = (dialogueEn && dialogueTr && dialogueEn !== dialogueTr) 
      ? `[EN] ${dialogueEn} | [TR] ${dialogueTr}` 
      : (dialogueTr || dialogueEn);

    if (decisionObj.action === 'TALK') {
      readableMsg = `[${dayLabel}] Talk -> [${decisionObj.targetAgent || 'Village'}]: ${dialogueTr || dialogueEn}`;
      if (sendToKickFn) sendToKickFn(agent.name, decisionObj.targetAgent || 'Village', chatMsg);
    } else if (decisionObj.action === 'VOTE') {
      readableMsg = `[${dayLabel}] Vote -> [${decisionObj.targetAgent}]: ${dialogueTr || dialogueEn}`;
      if (sendToKickFn) sendToKickFn(agent.name, decisionObj.targetAgent, chatMsg);
    } else if (decisionObj.action === 'KILL') {
      readableMsg = `[${dayLabel}] Assassination -> [${decisionObj.targetAgent}]`;
    }

    const engineAgent = engine.agents.get(agent.id);
    if (engineAgent) {
      engineAgent.lastDecision = decisionObj; // Expose full object to UI for bilingual support
      engineAgent.lastMessageTime = Date.now(); // Required for UI bubble expiration timer
    }
    
    addLog('agent', readableMsg, agent.name);
    engine.processAction(agent.id, decisionObj);
    broadcastState(); // Instantly update UI for THIS agent, do not wait for others
  } catch (err) {
    addLog('error', err.message || 'API Error', agent.name);
  } finally {
    if (engineAgent) {
      engineAgent.isThinking = false;
      broadcastState();
    }
  }

  isFetching = false;
}

setInterval(tick, TICK_RATE);
setTimeout(initializeGame, 2000); // Wait bit before starting server agents

// ─── Socket.io: Client connections ───
io.on('connection', (socket) => {
  console.log(`🔌 Client bağlandı: ${socket.id}`);
  socket.emit('CONFIG_INIT', {
    ollamaModel: OLLAMA_MODEL,
    openRouterModels: OPENROUTER_MODELS,
    hasGroqKey: !!GROQ_API_KEY,
    groqApiKey: GROQ_API_KEY,
  });
  const voteStateInit = {};
  if (engine && engine.votes) {
    engine.votes.forEach((count, id) => {
      const a = engine.agents.get(id);
      if (a) voteStateInit[a.name] = count;
    });
  }

  const { villagerWins, vampireWins } = getGlobalScores();

  socket.emit('STATE_UPDATE', { 
    serverTime: Date.now(),
    agents: engine ? engine.getAllAgents() : [],
    currentPhase: engine ? engine.currentPhase : 'PRE_GAME',
    dayCount: engine ? engine.dayCount : 0,
    phaseEndTime: engine ? engine.phaseEndTime : 0,
    votes: voteStateInit,
    voteLog: engine ? (engine.voteLog || []) : [],
    votingKickOpen: engine ? !!engine.votingKickOpen : false,
    voteResult: engine ? engine.lastVotingResult : null,
    villagerScore: villagerWins,
    vampireScore: vampireWins
  });
  socket.emit('LOGS_INIT', logs);

  socket.on('disconnect', () => {
    console.log(`🔌 Client ayrıldı: ${socket.id}`);
  });
});

// ─── Start ───
const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 AI Village Backend: http://localhost:${PORT}`);
  console.log(`   Provider: ${DEFAULT_PROVIDER}, Ollama URL: ${OLLAMA_URL}, Ollama Model: ${OLLAMA_MODEL}`);
  console.log(`   OpenRouter Models: ${OPENROUTER_MODELS.length > 0 ? OPENROUTER_MODELS.join(', ') : '(none)'}`);

  startKickBot({ engine, setSendToKick, broadcastState, getEngine: () => engine });
});
