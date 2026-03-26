import React from 'react';
import { Box, Plus, BarChart3 } from 'lucide-react';

interface HeaderProps {
  onNewAgent: () => void;
  currentPhase?: string;
  dayCount?: number;
  onStats?: () => void;
  showStats?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onNewAgent, onStats, showStats }) => {
  return (
    <header className="app-header glass-panel">
      <div className="header-title">
        <Box size={28} color="#6366f1" />
        AI Vampire Village
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className={`btn-primary ${showStats ? 'active' : ''}`} onClick={onStats} style={showStats ? { background: '#6366f1' } : {}}>
          <BarChart3 size={18} />
          Stats
        </button>
        <button className="btn-primary" onClick={onNewAgent}>
          <Plus size={18} />
          New Agent
        </button>
      </div>
    </header>
  );
};
