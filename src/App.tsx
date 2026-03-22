import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatterBox } from './components/ChatterBox';
import { AgentModal } from './components/AgentModal';
import { SimulationCanvas } from './components/SimulationCanvas';
import type { Agent, LogEntry, ProviderType } from './engine/types';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

/*
export const AGENT_PERSONAS = [
  { name: "Asta", description: "A regular barista by day, the city's most dangerous white-hat hacker by night." },
  { name: "Odi", description: "A librarian who prefers the smell of old books to people, quiet but memorizes every detail around." },
  { name: "Shirley", description: "An incurable optimist who always carries a joke in her pocket and an unbreakable smile, even in the most chaotic moments." },
  { name: "Jesi", description: "A rebellious traveler who believes rules only exist to be bent, determined to travel the world with just a backpack." },
  { name: "Sahara", description: "A sharp-tongued data analyst who believes in statistics and cold facts more than people's feelings." },
  { name: "Lumi", description: "An eccentric artist who tries to make sense of the world through neon colors splashed on canvases, not words." },
  { name: "Kira", description: "An ambitious and unbeatable e-sports player who conquers kingdoms in digital worlds to escape real-life problems." },
  { name: "Tera", description: "A modern healer who lives by the rhythm of nature, completely isolated from technology, and talks to plants." },
  { name: "Echo", description: "A born leader and entrepreneur who ruthlessly destroys obstacles on the path to success with pure intellect." },
  { name: "Nova", description: "A nostalgia enthusiast who constantly listens to 80s music and always seems ready to pull a cassette player from her pocket." }
];
*/

export interface ServerConfig {
  ollamaModel: string;
  openRouterModels: string[];
  hasGroqKey: boolean;
  groqApiKey: string;
}

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>('PRE_GAME');
  const [dayCount, setDayCount] = useState<number>(0);
  const [phaseEndTime, setPhaseEndTime] = useState<number>(0);
  const [voteLog, setVoteLog] = useState<Array<{ voter: string; target: string; source?: string }>>([]);
  const [votingKickOpen, setVotingKickOpen] = useState(false);
  const [voteResult, setVoteResult] = useState<any>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [serverDrift, setServerDrift] = useState<number>(0);
  const [villagerScore, setVillagerScore] = useState<number>(0);
  const [vampireScore, setVampireScore] = useState<number>(0);

  const isOverlay = new URLSearchParams(window.location.search).has('overlay');

  useEffect(() => {
    socket.on('CONFIG_INIT', (config: ServerConfig) => {
      setServerConfig(config);
    });

    socket.on('STATE_UPDATE', (data: { agents: Agent[], currentPhase?: string, dayCount?: number, phaseEndTime?: number, votes?: Record<string, number>, voteLog?: Array<{ voter: string; target: string; source?: string }>, votingKickOpen?: boolean, voteResult?: any, serverTime?: number, villagerScore?: number, vampireScore?: number }) => {
      setAgents(data.agents);
      if (data.currentPhase) setCurrentPhase(data.currentPhase);
      if (typeof data.dayCount === 'number') setDayCount(data.dayCount);
      if (data.phaseEndTime) setPhaseEndTime(data.phaseEndTime);
      setVoteLog(data.voteLog ?? []);
      setVotingKickOpen(!!data.votingKickOpen);
      setVoteResult(data.voteResult);
      if (data.serverTime) setServerDrift(Date.now() - data.serverTime);
      if (typeof data.villagerScore === 'number') setVillagerScore(data.villagerScore);
      if (typeof data.vampireScore === 'number') setVampireScore(data.vampireScore);
    });

    socket.on('LOGS_INIT', (serverLogs: LogEntry[]) => {
      setLogs(serverLogs);
    });

    socket.on('NEW_LOG', (entry: LogEntry) => {
      setLogs(prev => {
        const next = [...prev, entry];
        if (next.length > 200) next.splice(0, next.length - 200);
        return next;
      });
    });

    return () => {
      socket.off('CONFIG_INIT');
      socket.off('STATE_UPDATE');
      socket.off('LOGS_INIT');
      socket.off('NEW_LOG');
    };
  }, []);

  const requestSpawn = (name: string, model: string, color: string, count: number, requestedPersona?: string, provider: ProviderType = 'ollama') => {
    socket.emit('SPAWN_REQUEST', {
      name,
      model,
      color,
      count,
      persona: requestedPersona,
      provider
    });
    setShowModal(false);
  };

  return (
    <>
      {!isOverlay && <Header onNewAgent={() => setShowModal(true)} currentPhase={currentPhase} dayCount={dayCount} />}
      <main className="main-content" style={isOverlay ? { padding: 0 } : undefined}>
        <SimulationCanvas 
          agents={agents} 
          currentPhase={currentPhase} 
          phaseEndTime={phaseEndTime} 
          voteLog={voteLog} 
          votingKickOpen={votingKickOpen} 
          voteResult={voteResult} 
          serverDrift={serverDrift}
          villagerScore={villagerScore}
          vampireScore={vampireScore}
        />
        {!isOverlay && <ChatterBox logs={logs} />}
      </main>

      {showModal && serverConfig && (
        <AgentModal 
          onClose={() => setShowModal(false)}
          onCreate={requestSpawn}
          serverConfig={serverConfig}
        />
      )}
    </>
  );
}
