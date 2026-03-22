export interface Position {
  x: number;
  y: number;
}

export type ProviderType = 'ollama' | 'groq' | 'openrouter';

export interface Agent {
  id: string;
  name: string;
  model: string;
  position: Position;
  color: string;
  isActive: boolean;
  history: Position[];
  isDead?: boolean;
  deathReason?: 'murdered' | 'exiled';
  inbox?: string[];
  conversationHistory?: string[];
  roleDescription?: string;
  personaName?: string;
  provider: ProviderType;
  role?: string;
  lastMessage?: string;
  lastMessageTime?: number;
  lastDecision?: {
    action: string;
    dialogue_en?: string;
    dialogue_tr?: string;
    suspicion_score?: number;
    targetAgent?: string;
  };
  isThinking?: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  agentName?: string;
  type: 'system' | 'agent' | 'error';
  message: string;
}

export type Action = 'forward' | 'backward' | 'left' | 'right' | 'idle';
