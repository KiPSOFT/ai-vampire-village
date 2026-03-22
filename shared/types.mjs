// Shared constants used by both server and client

export const GRID_SIZE = 10;

export const AGENT_PERSONAS = [
  {
    name: "Arthur",
    description: "You are Arthur, the pragmatic and grumpy farmer. You care about facts and hard work. Your primary goal is to find the vampire because this murder is disrupting the village's peace. You speak bluntly and have no patience for lies or nonsense."
  },
  {
    name: "Barnaby",
    description: "You are Barnaby, the cunning village merchant. You use your extensive gossip network to gather clues about the murder. Your primary goal is to find the vampire, but you still speak like a sly trader, analyzing everyone's secrets and alibis."
  },
  {
    name: "Thomas",
    description: "You are Thomas, the authoritative mayor. Your primary goal is to lead the murder investigation and maintain order. You are slightly paranoid that the vampire is trying to ruin your reputation, so you question people aggressively and speak in a commanding tone."
  },
  {
    name: "Kael",
    description: "You are Kael, the quiet and philosophical blacksmith. Your primary goal is to analyze the murder logically. You speak calmly, using metaphors about fire and iron to describe truth and deception. You never panic, you just observe."
  },
  {
    name: "Silas",
    description: "You are Silas, the nervous village night watchman. Your primary goal is to find the vampire. Because you work in the dark, you are hyper-vigilant and suspicious of everyone. You don't trust anyone's alibi and often point out small, creepy details you noticed at night."
  }
];

export const ZONES = {
  "Village Square": { x: 5, y: 5 }, // Center
  "Marketplace": { x: 1, y: 1 },    // Top-Left Corner
  "Fields": { x: 9, y: 1 },         // Top-Right Corner
  "Blacksmith's Forge": { x: 1, y: 9 }, // Bottom-Left Corner
  "Forest Edge": { x: 9, y: 9 }     // Bottom-Right Corner
};

export const PHASES = {
  PRE_GAME: "PRE_GAME",
  DAY: "DAY",
  NIGHT: "NIGHT",
  VOTING: "VOTING",
  VOTING_RESULT: "VOTING_RESULT"
};

export const ROLES = {
  VAMPIRE: "VAMPIRE",
  INNOCENT: "INNOCENT"
};

export const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#0ea5e9'];
