import type { Agent } from './types';

export const GRID_SIZE = 10;

export class SimulationEngine {
  agents: Map<string, Agent> = new Map();

  addAgent(agent: Agent) {
    this.agents.set(agent.id, agent);
  }

  removeAgent(id: string) {
    this.agents.delete(id);
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getSurroundings(agentId: string): string {
    const agent = this.agents.get(agentId);
    if (!agent) return 'Unknown location.';

    const { x, y } = agent.position;
    
    // Check bounds
    const wallNorth = y === 0 ? 'A wall is to your North.' : 'Open space to your North.';
    const wallSouth = y === GRID_SIZE - 1 ? 'A wall is to your South.' : 'Open space to your South.';
    const wallWest = x === 0 ? 'A wall is to your West.' : 'Open space to your West.';
    const wallEast = x === GRID_SIZE - 1 ? 'A wall is to your East.' : 'Open space to your East.';

    // Check other agents
    const otherAgentsList: string[] = [];
    this.agents.forEach((other) => {
      if (other.id !== agent.id) {
        const dx = other.position.x - x;
        const dy = other.position.y - y;
        if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
          let dir = '';
          if (dy < 0) dir += 'North';
          if (dy > 0) dir += 'South';
          if (dx < 0) dir += 'West';
          if (dx > 0) dir += 'East';
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          const adj = distance === 1 ? 'ADJACENT (yan yana, konuşabilirsiniz)' : 'FAR (uzak, konuşamazsınız)';
          otherAgentsList.push(`Agent '${other.name}' is to your ${dir} [${adj}].`);
        }
      }
    });

    let context = `You are at position (X:${x}, Y:${y}) on a ${GRID_SIZE}x${GRID_SIZE} grid. Grid bounds: X[0 to ${GRID_SIZE-1}], Y[0 to ${GRID_SIZE-1}].\n`;
    context += `${wallNorth} ${wallSouth} ${wallWest} ${wallEast}\n`;
    if (otherAgentsList.length > 0) {
      context += `Other agents nearby: ${otherAgentsList.join(' ')}\n`;
      const hasAdjacent = otherAgentsList.some(a => a.includes('ADJACENT'));
      if (hasAdjacent) {
        // Count conversation history entries (they start with "You said" or "[AgentName] said")
        const totalTalks = (agent.conversationHistory || []).length;
        
        if (totalTalks < 4) {
          context += `\nCRITICAL SOCIAL RULE: You are ADJACENT to another agent. DUR! Hemen cekip gitmek yasaktir! Kendi karakterine sadik kalarak, onlarla TALK yap. Meslekleri, tutkulari ve sevdikleri seyler hakkinda sorular sor, kendi rolunun derinliklerinden bahset. Simdiye kadar ${totalTalks} tur konustunuz, en az 4 tur sohbet et!\n`;
        } else if (totalTalks < 7) {
          context += `\nSOCIAL UPDATE: You have been chatting for ${totalTalks} turns. Guzel bir sohbet oldu! Simdi kibarca vedaas ve MOVE ile yoluna devam et. Yeni yerler kesfetmelisin. Hos gorusuruz de ve MOVE action ile bir sonraki hucreye git!\n`;
        } else {
          context += `\nFORCED SEPARATION: ${totalTalks} tur sohbet ettin, yeterli! Artik MOVE etmek ZORUNDASIN. TALK secme, sadece MOVE sec ve bir sonraki hucreye git. Bu bir EMIR!\n`;
        }
      }
    }

    context += `\nYOUR MISSION:
1. PRIMARY: Interact and hold meaningful conversations with other ADJACENT agents on the map.
2. SECONDARY: Travel and explore every single cell on the grid.\n`;

    if (agent.history && agent.history.length > 0) {
      const historyStr = agent.history.map(h => `(${h.x}, ${h.y})`).join(' -> ');
      context += `\nYour recent movement history (last ${agent.history.length} steps): ${historyStr}. Try to explore new areas and avoid going back to recently visited cells unless necessary.\n`;
    }

    if (agent.conversationHistory && agent.conversationHistory.length > 0) {
      context += `\nCONVERSATION MEMORY (Last ${agent.conversationHistory.length} messages):\n${agent.conversationHistory.join('\n')}\n`;
    }

    if (agent.inbox && agent.inbox.length > 0) {
      context += `\nUNREAD INBOX MESSAGES:\n${agent.inbox.join('\n')}\nYou should reply to them!\n`;
      agent.inbox = [];
    }

    const hasAdjacentAgent = otherAgentsList.some(a => a.includes('ADJACENT'));
    const adjacentNames = this.getAllAgents()
      .filter(a => a.id !== agent.id && Math.abs(a.position.x - x) <= 1 && Math.abs(a.position.y - y) <= 1 && (a.position.x !== x || a.position.y !== y))
      .map(a => a.name);

    context += `\nDecide your next action, remember you are ${agent.name}. You MUST reply ONLY with a valid JSON object. No markdown, no backticks, no extra text.\n`;
    
    if (hasAdjacentAgent) {
      context += `AVAILABLE ACTIONS:\n`;
      context += `1. TALK to adjacent agent: {"action": "TALK", "targetAgent": "${adjacentNames[0]}", "message": "English text / Turkce metin"}\n`;
      context += `   Message MUST be UNDER 200 characters. MUST include BOTH English AND Turkish separated by " / ".\n`;
      context += `2. MOVE one step: {"action": "MOVE", "coordinates": {"x": ${x}, "y": ${Math.min(y+1, GRID_SIZE-1)}}}\n`;
      context += `3. STAY: {"action": "STAY"}\n`;
    } else {
      context += `NO AGENTS NEARBY. You CANNOT use TALK action. You MUST use MOVE to explore.\n`;
      context += `AVAILABLE ACTIONS:\n`;
      context += `1. MOVE one step (RECOMMENDED): {"action": "MOVE", "coordinates": {"x": ${Math.min(x+1, GRID_SIZE-1)}, "y": ${y}}}\n`;
      context += `   Pick any adjacent cell (x +/-1 OR y +/-1, not both).\n`;
      context += `2. STAY: {"action": "STAY"}\n`;
      context += `DO NOT use TALK. There is nobody to talk to. MOVE to find other agents!\n`;
    }

    return context;
  }

  processAction(agentId: string, decision: any) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    if (decision.action === 'TALK' && decision.targetAgent && decision.message) {
      const targetName = decision.targetAgent;
      const message = decision.message;
      let targetAgent = this.getAllAgents().find(a => a.name.toLowerCase() === targetName.toLowerCase());
      if (targetAgent) {
        const dx = Math.abs(targetAgent.position.x - agent.position.x);
        const dy = Math.abs(targetAgent.position.y - agent.position.y);
        
        if (dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0)) {
          if (!agent.conversationHistory) agent.conversationHistory = [];
          agent.conversationHistory.push(`You said to [${targetAgent.name}]: "${message}"`);
          if (agent.conversationHistory.length > 15) agent.conversationHistory.shift();

          if (!targetAgent.conversationHistory) targetAgent.conversationHistory = [];
          targetAgent.conversationHistory.push(`[${agent.name}] said to You: "${message}"`);
          if (targetAgent.conversationHistory.length > 15) targetAgent.conversationHistory.shift();

          if (!targetAgent.inbox) targetAgent.inbox = [];
          targetAgent.inbox.push(`[${agent.name}] says: ${message}`);

          // Store for speech bubble display
          agent.lastMessage = message;
          agent.lastMessageTime = Date.now();

          // FORCED SEPARATION: If agent has talked 7+ turns, auto-move them apart
          const agentTalks = (agent.conversationHistory || []).length;
          if (agentTalks >= 7) {
            const possibleMoves = [
              { x: agent.position.x + 1, y: agent.position.y },
              { x: agent.position.x - 1, y: agent.position.y },
              { x: agent.position.x, y: agent.position.y + 1 },
              { x: agent.position.x, y: agent.position.y - 1 },
            ].filter(p => 
              p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE &&
              ![...this.agents.values()].some(a => a.id !== agent.id && a.position.x === p.x && a.position.y === p.y)
            );
            if (possibleMoves.length > 0) {
              const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
              agent.position.x = move.x;
              agent.position.y = move.y;
            }
            // Clear conversation history so they start fresh next encounter
            agent.conversationHistory = [];
          }
        }
      }
      return; 
    }

    if (decision.action === 'STAY') {
      return; 
    }

    if (decision.action === 'MOVE' && decision.coordinates) {
      const targetX = decision.coordinates.x;
      const targetY = decision.coordinates.y;

      const dx = Math.abs(targetX - agent.position.x);
      const dy = Math.abs(targetY - agent.position.y);

      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
      if (targetX >= 0 && targetX < GRID_SIZE && targetY >= 0 && targetY < GRID_SIZE) {
        let collision = false;
        this.agents.forEach(other => {
          if (other.id !== agent.id && other.position.x === targetX && other.position.y === targetY) {
            collision = true;
          }
        });

        if (!collision) {
          // Record history before moving
          if (!agent.history) agent.history = [];
          agent.history.push({ x: agent.position.x, y: agent.position.y });
          if (agent.history.length > 10) agent.history.shift(); // Keep last 10 moves
          
          agent.position.x = targetX;
          agent.position.y = targetY;
        }
      }
      }
    }
  }
}
