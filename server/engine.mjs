import { GRID_SIZE, PHASES, ROLES, ZONES } from '../shared/types.mjs';

/** Ajanların oy vermesi için üst süre; sonra izleyici penceresi açılır */
const AGENT_VOTE_MAX_MS = 5 * 60 * 1000;
/** Tüm ajanlar oy verdikten (veya üst süre dolunca) sonra Kick izleyici oyları */
const KICK_VOTE_MS = 90 * 1000;

export class SimulationEngine {
  constructor(onGameEndCallback, onViewerVote) {
    /** @type {Function|null} */
    this.onGameEndCallback = onGameEndCallback || null;
    /** @type {Function|null} */
    this.onViewerVote = onViewerVote || null;
    /** @type {Map<string, object>} */
    this.agents = new Map();
    this.currentPhase = PHASES.PRE_GAME;
    this.phaseEndTime = 0;
    this.deadAgents = new Set();
    this.lastVictim = null;
    this.lastVotingResult = null;
    this.votes = new Map(); // agentId -> count
    /** Kimin oy kullandığı (aynı kişi iki kez oy veremez) */
    this.voteVoters = new Set();
    /** @type {Array<{ voter: string, target: string, source?: string }>} */
    this.voteLog = [];
    this.messages = []; // Global conversation log
    this.dayCount = 0;
    this.votingKickOpen = false;
    this.agentVoteDeadline = 0;
    /** Oylama başlarken tam 2 kişi (1v+1i) mi — bu tur "1v1 ilk oylama" sayılır */
    this.isFirstTwoPlayerVoteRound = false;
    /** 1v1 ilk oylama bir kez tamamlandı mı (3→2 aynı turda sayılmaz) */
    this.hasCompletedFirstTwoPlayerVoteRound = false;
    /** Skor takibi */
    this.villagerScore = 0;
    this.vampireScore = 0;
  }

  getDayTag() {
    return `${Math.max(1, this.dayCount)}. Gün`;
  }

  pushDayMessage(message) {
    this.messages.push(`[${this.getDayTag()}] ${message}`);
    if (this.messages.length > 100) this.messages.shift();
  }

  addAgent(agent) {
    this.agents.set(agent.id, agent);
  }

  removeAgent(id) {
    this.agents.delete(id);
  }

  getAgent(id) {
    return this.agents.get(id);
  }

  getAllAgents() {
    return Array.from(this.agents.values()).map(a => ({
      ...a,
      isDead: this.deadAgents.has(a.id)
    }));
  }

  getAliveAgents() {
    return this.getAllAgents().filter(a => !this.deadAgents.has(a.id));
  }

  startGame() {
    this.deadAgents.clear();
    this.lastVictim = null;
    this.lastVotingResult = null;
    this.votes.clear();
    this.voteVoters.clear();
    this.voteLog = [];
    this.votingKickOpen = false;
    this.hasCompletedFirstTwoPlayerVoteRound = false;
    this.isFirstTwoPlayerVoteRound = false;
    this.messages = [];
    this.dayCount = 0;
    this.startNightPhase();
    console.log(`[GAME] State reset. Game started (Initiating Night).`);
  }

  startNightPhase() {
    this.currentPhase = PHASES.NIGHT;
    this.phaseEndTime = Date.now() + 20 * 1000; // 20 seconds for Vampire to kill
    console.log(`[NIGHT] Phase started. Vampires are active.`);

    const alive = this.getAliveAgents();

    // Nobody should spend the night in Village Square.
    const allowedNightZones = Object.keys(ZONES).filter((z) => z !== 'Village Square');
    const shuffledZones = [...allowedNightZones];
    for (let i = shuffledZones.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledZones[i], shuffledZones[j]] = [shuffledZones[j], shuffledZones[i]];
    }

    let zIndex = 0;
    alive.forEach(a => {
      // Give every alive player a non-square night location so no one is framed for "sleeping in square".
      const assignedZone = shuffledZones[zIndex % shuffledZones.length] || 'Marketplace';
      zIndex++;
      a.memoryZone = assignedZone;
      a.position.x = ZONES[assignedZone].x;
      a.position.y = ZONES[assignedZone].y;
      console.log(`[ALIBI LOG] ${a.name} slept at ${a.memoryZone}.`);
    });

    if (this.dayCount === 0) {
      const innocents = alive.filter(a => a.role === ROLES.INNOCENT);
      if (innocents.length > 0) {
        const victim = innocents[Math.floor(Math.random() * innocents.length)];
        this.deadAgents.add(victim.id);
        this.getAgent(victim.id).deathReason = 'murdered';
        this.lastVictim = victim;
        victim.position.x = ZONES["Village Square"].x;
        victim.position.y = ZONES["Village Square"].y;
        console.log(`[NIGHT] Vampire randomly killed ${victim.name} on Night 1`);
      }
    } else {
      this.lastVictim = null; // Vampire will autonomously assign this during TICK
    }
  }

  startDayPhase() {
    this.currentPhase = PHASES.DAY;
    this.phaseEndTime = Date.now() + 5 * 60 * 1000; // 5 minutes
    this.dayCount++;
    const dayAnnouncement = `[${this.dayCount}. Gün / Day ${this.dayCount}]`;
    console.log(`${dayAnnouncement} Phase started.`);
    this.pushDayMessage(dayAnnouncement);
    
    if (this.lastVictim) {
      const dawnMsg = `[SYSTEM]: Dawn has come. ${this.lastVictim.name} was found dead during the night.`;
      this.pushDayMessage(dawnMsg);
      console.log(dawnMsg);
    }
    
    const alive = this.getAliveAgents();
    const square = ZONES["Village Square"];
    alive.forEach(a => {
      a.position.x = square.x;
      a.position.y = square.y;
    });
  }

  startVotingPhase() {
    this.currentPhase = PHASES.VOTING;
    this.votingKickOpen = false;
    this.agentVoteDeadline = Date.now() + AGENT_VOTE_MAX_MS;
    this.phaseEndTime = this.agentVoteDeadline;
    this.votes.clear();
    this.voteVoters.clear();
    this.voteLog = [];
    const alive = this.getAliveAgents();
    // Move all to Village Square
    const zCoords = ZONES["Village Square"];
    alive.forEach(a => {
      a.position.x = zCoords.x;
      a.position.y = zCoords.y;
    });
    const aliveInnocents = alive.filter(a => a.role === ROLES.INNOCENT).length;
    const vampireAlive = alive.some(a => a.role === ROLES.VAMPIRE);
    const isTwoPlayers = alive.length === 2 && vampireAlive && aliveInnocents === 1;
    this.isFirstTwoPlayerVoteRound = isTwoPlayers && !this.hasCompletedFirstTwoPlayerVoteRound;
    console.log(`[VOTING] Phase started.${this.isFirstTwoPlayerVoteRound ? ' (1v1 ilk oylama)' : ''}`);
  }

  resolveVoting() {
    console.log(`[VOTING] Tallying votes...`);
    let maxVotes = -1;
    let victimIds = [];
    
    this.votes.forEach((count, id) => {
      if (count > maxVotes) {
        maxVotes = count;
        victimIds = [id];
      } else if (count === maxVotes) {
        victimIds.push(id);
      }
    });

    if (victimIds.length === 1 && maxVotes > 0) {
      const victimId = victimIds[0];
      const victim = this.getAgent(victimId);
      this.deadAgents.add(victimId);
      this.getAgent(victimId).deathReason = 'exiled';
      
      const square = ZONES["Village Square"];
      victim.position.x = square.x;
      victim.position.y = square.y;
      
      console.log(`[VOTING] Chat elected to kill ${victim?.name} (${victim?.role}) with ${maxVotes} votes.`);
      
      this.lastVotingResult = {
        name: victim?.name,
        exiledId: victimId,
        role: victim?.role,
        isVampire: victim?.role === ROLES.VAMPIRE
      };
      const exileMsg = `[SYSTEM]: Village council exiled ${victim.name}. Role revealed: ${victim.role === ROLES.VAMPIRE ? 'VAMPIRE' : 'INNOCENT'}.`;
      this.pushDayMessage(exileMsg);
    } else {
      console.log(`[VOTING] Tie or no votes cast. Nobody dies.`);
      this.lastVotingResult = { none: true };
      const exileMsg = `[SYSTEM]: The vote ended in a tie. No one was exiled.`;
      this.pushDayMessage(exileMsg);
    }

    this.currentPhase = PHASES.VOTING_RESULT;
    this.phaseEndTime = Date.now() + 15 * 1000; // 15 seconds cinematic result viewer
  }

  allAgentsHaveVoted() {
    const alive = this.getAliveAgents();
    if (alive.length === 0) return true;
    return alive.every(a => this.voteVoters.has(a.id));
  }

  tryOpenKickVotingWindow() {
    if (this.currentPhase !== PHASES.VOTING || this.votingKickOpen) return false;
    if (this.allAgentsHaveVoted() || Date.now() >= this.agentVoteDeadline) {
      this.votingKickOpen = true;
      this.phaseEndTime = Date.now() + KICK_VOTE_MS;
      console.log(`[VOTING] Viewer (Kick) voting opened (${KICK_VOTE_MS / 1000}s).`);
      return true;
    }
    return false;
  }

  checkPhaseTransition() {
    if (this.currentPhase === PHASES.PRE_GAME) return false;

    // INSTANT GAME OVER CHECKS (Before timer expires)
    if (this.currentPhase !== PHASES.VOTING_RESULT) {
      const alive = this.getAliveAgents();
      const aliveInnocents = alive.filter(a => a.role === ROLES.INNOCENT).length;
      const vampireAlive = alive.some(a => a.role === ROLES.VAMPIRE);
      
      let instantWinner = null;
      if (!vampireAlive) {
        instantWinner = 'villagers';
        this.villagerScore++;
      } else if (vampireAlive && aliveInnocents === 0) {
        instantWinner = 'vampire';
        this.vampireScore++;
      } else if (vampireAlive && aliveInnocents === 1 && this.hasCompletedFirstTwoPlayerVoteRound) {
        instantWinner = 'vampire';
        this.vampireScore++;
      }

      if (instantWinner) {
        console.log(`[GAME OVER] Instant condition met. Winner: ${instantWinner}`);
        this.currentPhase = PHASES.PRE_GAME;
        if (this.onGameEndCallback) this.onGameEndCallback(instantWinner, this.villagerScore, this.vampireScore);
        return true;
      }
    }

    if (this.currentPhase === PHASES.VOTING) {
      if (this.tryOpenKickVotingWindow()) return true;
    }

    if (Date.now() < this.phaseEndTime) return false;

    if (this.currentPhase === PHASES.NIGHT) {
        if (!this.lastVictim && this.dayCount > 0) {
           const alive = this.getAliveAgents();
           const innocents = alive.filter(a => a.role === ROLES.INNOCENT);
           if (innocents.length > 0) {
             const victim = innocents[Math.floor(Math.random() * innocents.length)];
             this.deadAgents.add(victim.id);
             this.getAgent(victim.id).deathReason = 'murdered';
             this.lastVictim = victim;
             victim.position.x = ZONES["Village Square"].x;
             victim.position.y = ZONES["Village Square"].y;
             console.log(`[NIGHT] Vampire API timed out! System forced assassination of ${victim.name}`);
           }
        }
        this.startDayPhase();
      } else if (this.currentPhase === PHASES.DAY) {
        if (this.deadAgents.size === 0) {
          this.startNightPhase();
        } else {
          this.startVotingPhase();
        }
      } else if (this.currentPhase === PHASES.VOTING) {
        this.resolveVoting();
      } else if (this.currentPhase === PHASES.VOTING_RESULT) {
         const wasFirstTwoPlayerVote = this.isFirstTwoPlayerVoteRound;
         let winner = null;
         if (this.lastVotingResult && this.lastVotingResult.isVampire) {
            console.log(`[GAME OVER] The Vampire was killed! Villagers Win!`);
            this.villagerScore++;
            winner = 'villagers';
            this.currentPhase = PHASES.PRE_GAME;
         } else {
            const alive = this.getAliveAgents();
            const aliveInnocents = alive.filter(a => a.role === ROLES.INNOCENT).length;
            const vampireAlive = alive.some(a => a.role === ROLES.VAMPIRE);
            const vampExiledThisRound = this.lastVotingResult?.isVampire === true;

            if (wasFirstTwoPlayerVote && !vampExiledThisRound) {
              console.log(`[GAME OVER] Vampire Wins! (1v1 ilk oylamada vampir elenmedi)`);
              this.vampireScore++;
              winner = 'vampire';
              this.currentPhase = PHASES.PRE_GAME;
            } else if (vampireAlive && aliveInnocents <= 1) {
              console.log(`[GAME OVER] Vampire Wins! Not enough villagers left.`);
              this.vampireScore++;
              winner = 'vampire';
              this.currentPhase = PHASES.PRE_GAME;
            } else {
              this.startNightPhase();
            }
         }
         if (wasFirstTwoPlayerVote) {
           this.hasCompletedFirstTwoPlayerVoteRound = true;
         }
         this.isFirstTwoPlayerVoteRound = false;
         // Oyun bittiğinde callback çağır
         if (this.currentPhase === PHASES.PRE_GAME && winner && this.onGameEndCallback) {
           this.onGameEndCallback(winner, this.villagerScore, this.vampireScore);
         }
      }
      return true;
  }

  /** Sadece canlılar; ölü/kovulan eşleşmez. Tam isim öncelikli, belirsiz kısmi eşleşmede oy yok. */
  resolveVoteTarget(agentName) {
    if (!agentName || typeof agentName !== 'string') return null;
    const alive = this.getAliveAgents();
    const q = agentName.trim().toLowerCase();
    if (!q) return null;
    const exact = alive.find((a) => a.name.toLowerCase() === q);
    if (exact) return exact;
    const partials = alive.filter(
      (a) => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase())
    );
    if (partials.length === 1) return partials[0];
    return null;
  }

  /**
   * @param {string} agentName - oy verilen hedef (isim eşleşmesi)
   * @param {string} voterKey - benzersiz oyveren anahtarı (ajan id veya chat:kullanıcı)
   * @param {string} voterLabel - voteLog’da görünen isim
   */
  registerVote(agentName, voterKey, voterLabel) {
    if (this.currentPhase !== PHASES.VOTING) return false;
    const isViewer = String(voterKey).startsWith('chat:');
    if (isViewer && !this.votingKickOpen) return false;
    if (!isViewer && this.votingKickOpen) return false;
    if (this.voteVoters.has(voterKey)) return false;
    const target = this.resolveVoteTarget(agentName);
    
    // Geçersiz kural: Kendine oy veremezsin
    if (target && target.id === voterKey) return false;

    if (target) {
      this.voteVoters.add(voterKey);
      this.votes.set(target.id, (this.votes.get(target.id) || 0) + 1);

      if (isViewer && this.onViewerVote) {
        this.onViewerVote(voterLabel, target.name);
      }

      this.voteLog.push({
        voter: voterLabel,
        target: target.name,
        source: isViewer ? 'viewer' : 'agent'
      });
      this.tryOpenKickVotingWindow();
      return true;
    }
    return false;
  }

  generatePrompt(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent || this.deadAgents.has(agentId)) return null;
    
    let context = ``;

    if (this.deadAgents.size > 0) {
      const deadNames = Array.from(this.deadAgents).map(id => this.getAgent(id)?.name).filter(Boolean).join(', ');
      context += `[ SYSTEM ]: DEAD BODIES IN THE SQUARE (YOU CANNOT TALK TO THE DEAD): ${deadNames}.\n\n`;
    }

    if (this.currentPhase === PHASES.NIGHT) {
      if (agent.role !== ROLES.VAMPIRE) return null; // Innocents sleep during night
      if (this.lastVictim) return null; // Vampire already killed tonight!
      
      context += `[ NIGHT PHASE - SECRET MISSION ]\nYou are the bloodthirsty Vampire. Everyone else is asleep.\n`;
      if (this.messages.length > 0) {
        context += `\n[ DISCUSSION HISTORY ]\n`;
        this.messages.slice(-15).forEach(m => context += `${m}\n`);
      }
      context += `\nMISSION: Read recent discussions. Kill ONE person who is most dangerous to you or most suspicious of you.\n`;
      context += `Also choose your alibi zone for tomorrow morning in "alibiZone".\n`;
      context += `Do not use Village Square as your alibiZone.\n`;
      context += `Return output in this exact JSON format:\n`;
      context += `{\n`;
      context += `  "action": "KILL",\n`;
      context += `  "targetAgent": "(full exact name of the victim)",\n`;
      context += `  "alibiZone": "(one of: Marketplace, Fields, Blacksmith's Forge, Forest Edge)"\n`;
      context += `}\n`;
      return context;
    }

    if (this.currentPhase === PHASES.VOTING) {
      if (this.votingKickOpen) return null;
      if (this.voteVoters.has(agentId)) return null;
      if (this.messages.length > 0) {
        context += `[ VILLAGE SQUARE DISCUSSION HISTORY (latest messages) ]\n`;
        this.messages.slice(-10).forEach((m) => (context += `${m}\n`));
        context += `\n`;
      }
      const aliveForVote = this.getAliveAgents();
      // Only list alive players except self
      const aliveNamesList = aliveForVote.filter((a) => a.id !== agentId).map((a) => a.name).join(', ');
      let voteContext = context + `[ TOWN VOTE — VOTE ONLY ]\n\n`;
      voteContext += `[CRITICAL RULES — FOLLOW STRICTLY]\n`;
      voteContext += `- No chatting during vote phase: NEVER use "action": "TALK". Output must use only "action": "VOTE".\n`;
      voteContext += `- Do not output markdown or free text. Return exactly ONE JSON object.\n`;
      voteContext += `- Put your short reasoning only in "dialogue_en" and "dialogue_tr".\n`;
      voteContext += `- After casting this vote, you are done for this round.\n`;
      voteContext += `- Do NOT get distracted by your profession. Your ONLY topic of conversation is the murder and finding the vampire. Use your personality ONLY as a tone of voice.\n\n`;
      voteContext += `VOTE ONLY FOR ALIVE PLAYERS (YOU CANNOT VOTE FOR YOURSELF): "targetAgent" must be one of these exact names:\n`;
      voteContext += `[${aliveNamesList}]\n\n`;
      voteContext += `OUTPUT FORMAT (only this, nothing else):\n`;
      voteContext += `{\n`;
      voteContext += `  "action": "VOTE",\n`;
      voteContext += `  "targetAgent": "(exact full name)",\n`;
      voteContext += `  "dialogue_en": "(short English reason)",\n`;
      voteContext += `  "dialogue_tr": "(short Turkish translation)"\n`;
      voteContext += `}\n`;
      return voteContext;
    }

    // --- DAY PHASE ---
    if (this.messages.length > 0) {
       context += `[ VILLAGE SQUARE DISCUSSION HISTORY ]\n`;
       this.messages.slice(-25).forEach(m => context += `${m}\n`);
       context += `\n`;
    }

    // --- REGULAR DAY PHASE ---
    const allowedZones = Object.keys(ZONES).join(', ');
    
    if (agent.role === ROLES.INNOCENT) {
      context += `[ YOUR ROLE ]\nYou are an INNOCENT villager. Last night you slept alone in "${agent.memoryZone || 'Marketplace'}".\n`;
      context += `(IMPORTANT: The ONLY valid map zones are: [${allowedZones}]. Do not invent places like home, river, etc. Use only these zones.)\n`;
      context += `The vampire is among you and is lying. Analyze past messages, cross-question others, and expose contradictions.\n`;
    } else if (agent.role === ROLES.VAMPIRE) {
      context += `[ YOUR ROLE ]\nYou are the hidden VAMPIRE!\n`;
      context += `If questioned about where you were last night, claim you slept alone in "${agent.memoryZone || 'Marketplace'}" (this is your lie).\n`;
      context += `(IMPORTANT: The ONLY valid map zones are: [${allowedZones}]. Do not invent places like home, river, etc. Use only these zones.)\n`;
      context += `Your goal: redirect suspicion onto innocents, create conflict, and protect yourself.\n`;
    }

    context += `Do NOT get distracted by your profession. Your ONLY topic of conversation is the murder and finding the vampire. Use your personality ONLY as a tone of voice.\n`;
    
    context += `\n[ YOUR TURN ]\nSend ONE message either to a specific player or to the whole village.\n`;
    context += `You MUST follow this exact JSON format:\n`;
    context += `{\n`;
    context += `  "action": "TALK",\n`;
    context += `  "targetAgent": "(target player's name, or 'Village' for general speech)",\n`;
    context += `  "dialogue_en": "(your English message, max 200 chars)",\n`;
    context += `  "dialogue_tr": "(Turkish translation, max 200 chars)"\n`;
    context += `}\n`;

    return context;
  }

  processAction(agentId, decision) {
    const agent = this.agents.get(agentId);
    if (!agent || this.deadAgents.has(agentId)) return;

    if (this.currentPhase === PHASES.VOTING && decision.action === 'TALK') {
      return;
    }

    if (decision.action === 'KILL' && agent.role === ROLES.VAMPIRE) {
      const targetName = decision.targetAgent;
      const targetAgent = this.getAliveAgents().find(a => a.name.toLowerCase().includes(targetName?.toLowerCase()));
      if (targetAgent && targetAgent.id !== agent.id) {
        this.deadAgents.add(targetAgent.id);
        this.getAgent(targetAgent.id).deathReason = 'murdered';
        this.lastVictim = targetAgent;
        targetAgent.position.x = ZONES["Village Square"].x;
        targetAgent.position.y = ZONES["Village Square"].y;
        console.log(`[NIGHT] Vampire assassinated ${targetAgent.name}`);
      }
      if (decision.alibiZone) {
        agent.memoryZone = decision.alibiZone;
      }
      return;
    }

    if (decision.action === 'VOTE' && decision.targetAgent) {
      const ok = this.registerVote(decision.targetAgent, agent.id, agent.name);
      if (!ok) {
        console.warn(`[VOTE] Geçersiz hedef (ölü/kovulan veya eşleşmeyen isim): ${agent.name} -> ${decision.targetAgent}`);
        return;
      }
    }

    if ((decision.action === 'TALK' || decision.action === 'VOTE') && decision.dialogue_tr) {
      // Append directly to global chat with day tag
      let targetInfo = decision.targetAgent ? ` (to ${decision.targetAgent})` : '';
      let msg = `[${agent.name}]${targetInfo}: "${decision.dialogue_tr}"`;
      this.pushDayMessage(msg);
    }
  }
}

export { PHASES, ROLES };
