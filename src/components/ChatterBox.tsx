import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../engine/types';

interface ChatterBoxProps {
  logs: LogEntry[];
}

export const ChatterBox: React.FC<ChatterBoxProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const uniqueAgents = Array.from(new Set(logs.map(l => l.agentName).filter(Boolean))) as string[];
  const filteredLogs = filter === 'ALL' 
    ? logs 
    : logs.filter(l => l.agentName === filter && l.type !== 'system');

  return (
    <div className="chatterbox glass-panel">
      <div className="chatterbox-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Live Chat Feed</span>
        {uniqueAgents.length > 0 && (
          <select 
            className="select-field" 
            value={filter} 
            onChange={e => setFilter(e.target.value)}
            style={{ width: '130px', padding: '0.2rem', fontSize: '0.8rem' }}
          >
            <option value="ALL">All Agents</option>
            {uniqueAgents.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="chatterbox-logs" ref={scrollRef}>
        {filteredLogs.map((log) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          const roleClass = log.type === 'system' ? 'log-system' : log.type === 'error' ? 'log-error' : 'log-agent';
          const roleLabel = log.type.toUpperCase();

          return (
            <div key={log.id} className={`log-entry ${roleClass}`}>
              <div className="log-header">
                <span>{roleLabel} {log.agentName ? `(${log.agentName})` : ''}</span>
                <span>{time}</span>
              </div>
              <div className="log-message">{log.message}</div>
            </div>
          );
        })}
        {filteredLogs.length === 0 && (
          <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '2rem' }}>
            No activity yet.
          </div>
        )}
      </div>
    </div>
  );
};
