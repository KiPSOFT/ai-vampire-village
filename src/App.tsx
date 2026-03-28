import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { ChatterBox } from './components/ChatterBox';
import { AgentModal } from './components/AgentModal';
import { SimulationCanvas } from './components/SimulationCanvas';
import { StatsPage } from './components/StatsPage';
import type { Agent, LogEntry, ProviderType } from './engine/types';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const socket = io(API_URL);

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

  const navigate = useNavigate();
  const location = useLocation();
  const showStats = location.pathname === '/stats';

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

  const handleStatsToggle = () => {
    if (showStats) {
      navigate('/');
    } else {
      navigate('/stats');
    }
  };

  return (
    <>
      {!isOverlay && <Header onNewAgent={() => setShowModal(true)} currentPhase={currentPhase} dayCount={dayCount} onStats={handleStatsToggle} showStats={showStats} />}

      <Routes>
        <Route path="/stats" element={<StatsPage />} />
        <Route path="*" element={
          <main className="main-content" style={isOverlay ? { padding: 0 } : undefined}>
            <SimulationCanvas 
              agents={agents} 
              currentPhase={currentPhase} 
              dayCount={dayCount}
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
        } />
      </Routes>

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

