import type { ProviderType } from '../engine/types';

// ─── Ollama ───
export const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';
export const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1';

// ─── Groq ───
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

// ─── OpenRouter ───
export const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

const rawModels = import.meta.env.VITE_OPENROUTER_MODELS || '';
export const OPENROUTER_MODELS: string[] = rawModels
  ? rawModels.split(',').map((m: string) => m.trim()).filter(Boolean)
  : [];

let _openRouterIndex = 0;
export const getNextOpenRouterModel = (): string => {
  if (OPENROUTER_MODELS.length === 0) return 'meta-llama/llama-3.1-8b-instruct:free';
  const model = OPENROUTER_MODELS[_openRouterIndex % OPENROUTER_MODELS.length];
  _openRouterIndex++;
  return model;
};

// ─── Default Provider (for !addagent / socket spawn) ───
const envProvider = (import.meta.env.VITE_DEFAULT_PROVIDER || 'ollama') as string;
export const DEFAULT_PROVIDER: ProviderType = 
  ['ollama', 'groq', 'openrouter'].includes(envProvider) 
    ? (envProvider as ProviderType) 
    : 'ollama';
