// Type declarations for shared/types.mjs

export interface AgentPersona {
  name: string;
  description: string;
}

export const AGENT_PERSONAS: AgentPersona[];

export const GRID_SIZE: number;

export interface ZonePosition {
  x: number;
  y: number;
}

export const ZONES: Record<string, ZonePosition>;

export const PHASES: {
  PRE_GAME: string;
  DAY: string;
  NIGHT: string;
  VOTING: string;
  VOTING_RESULT: string;
};

export const ROLES: {
  VAMPIRE: string;
  INNOCENT: string;
};

export const COLORS: string[];
