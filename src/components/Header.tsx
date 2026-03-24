import React from 'react';
import { Box, Plus } from 'lucide-react';

interface HeaderProps {
  onNewAgent: () => void;
  currentPhase?: string;
  dayCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ onNewAgent }) => {
  return (
    <header className="app-header glass-panel">
      <div className="header-title">
        <Box size={28} color="#6366f1" />
        AI Vampire Village
      </div>
      <button className="btn-primary" onClick={onNewAgent}>
        <Plus size={18} />
        New Agent
      </button>
    </header>
  );
};
