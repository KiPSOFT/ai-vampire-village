import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface GameStats {
  totalGames: number;
  villagerWins: number;
  vampireWins: number;
  villagerWinRate: string;
  vampireWinRate: string;
  avgDuration: string;
}

interface ModelStats {
  model: string;
  total_games: number;
  total_wins: number;
  win_rate: number;
  vampire_games: number;
  innocent_games: number;
  vampire_wins: number;
  innocent_wins: number;
}

interface RecentGame {
  id: number;
  winner: string;
  duration_days: number;
  created_at: string;
  player_count: number;
}

const shortModel = (model: string) =>
  model.split('/').pop()?.replace(/:.*/, '').replace(/-\d{4}.*/, '') ?? model;

const COLORS_PIE = ['#4ade80', '#ef4444'];

export function StatsPage() {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gamesRes, modelsRes, recentRes] = await Promise.all([
          fetch(`${API_URL}/api/stats/games`),
          fetch(`${API_URL}/api/stats/models`),
          fetch(`${API_URL}/api/stats/recent-games?limit=20`)
        ]);
        setGameStats(await gamesRes.json());
        setModelStats(await modelsRes.json());
        setRecentGames(await recentRes.json());
      } catch (err) {
        console.error('Stats fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const winRateData = gameStats ? [
    { name: 'Villagers', value: gameStats.villagerWins, color: '#4ade80' },
    { name: 'Vampire', value: gameStats.vampireWins, color: '#ef4444' }
  ] : [];

  const modelWinRateData = modelStats.map(m => ({
    name: shortModel(m.model),
    'Win Rate': m.win_rate,
    Games: m.total_games,
  }));

  const modelRoleData = modelStats.map(m => ({
    name: shortModel(m.model),
    Innocent: m.innocent_games,
    Vampire: m.vampire_games,
  }));

  const modelWinByRoleData = modelStats.map(m => ({
    name: shortModel(m.model),
    'Innocent Wins': m.innocent_wins,
    'Vampire Wins': m.vampire_wins,
  }));

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '24px 32px 48px',
      display: 'flex',
      flexDirection: 'column',
      gap: 32,
    }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: '2rem' }}>📊</span>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            AI Vampire Village — Statistics
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            LLM model performance across all games
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, color: '#94a3b8', fontSize: 16 }}>
          <span style={{ fontSize: 28, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
          Loading statistics...
        </div>
      ) : (
        <>
          {/* ── Overview Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { label: 'Total Games', value: gameStats?.totalGames ?? 0, icon: '🎮', color: '#6366f1' },
              { label: 'Avg Duration', value: `${gameStats?.avgDuration ?? 0} days`, icon: '📅', color: '#8b5cf6' },
              { label: 'Villager Win Rate', value: `${gameStats?.villagerWinRate ?? 0}%`, icon: '🧑‍🌾', color: '#4ade80' },
              { label: 'Vampire Win Rate', value: `${gameStats?.vampireWinRate ?? 0}%`, icon: '🧛', color: '#ef4444' },
            ].map(card => (
              <div key={card.label} style={{
                background: 'rgba(20,22,30,0.7)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                padding: '20px 24px',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxShadow: `0 0 0 1px ${card.color}22, 0 4px 24px rgba(0,0,0,0.3)`,
              }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {card.icon} {card.label}
                </div>
                <div style={{ fontSize: 34, fontWeight: 800, color: card.color, lineHeight: 1.1 }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* ── Charts Row 1 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
            {/* Pie */}
            <ChartCard title="Overall Win Distribution">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={winRateData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {winRateData.map((_entry, i) => (
                      <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Win Rate by Model */}
            <ChartCard title="Win Rate by Model (%)">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={modelWinRateData} margin={{ top: 4, right: 8, left: -16, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e2e8f0' }} />
                  <Bar dataKey="Win Rate" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ── Charts Row 2 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
            <ChartCard title="Role Distribution by Model">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={modelRoleData} margin={{ top: 4, right: 8, left: -16, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e2e8f0' }} />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="Innocent" stackId="a" fill="#4ade80" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Vampire" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Wins by Role & Model">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={modelWinByRoleData} margin={{ top: 4, right: 8, left: -16, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e2e8f0' }} />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="Innocent Wins" fill="#4ade80" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Vampire Wins" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ── Model Leaderboard Table ── */}
          <div style={{
            background: 'rgba(20,22,30,0.7)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            backdropFilter: 'blur(12px)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>🏆 Model Performance Leaderboard</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                    {['Model', 'Games', 'Wins', 'Win Rate', '🧛 Vamp G', '🧛 Vamp W', '🧑‍🌾 Inn G', '🧑‍🌾 Inn W'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Model' ? 'left' : 'center', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modelStats.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 14 }}>
                        No data yet
                      </td>
                    </tr>
                  ) : modelStats.map((m, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{shortModel(m.model)}</div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 2, fontFamily: 'monospace', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.model}>
                          {m.model}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', color: '#94a3b8', fontSize: 13 }}>{m.total_games}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', color: '#94a3b8', fontSize: 13 }}>{m.total_wins}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          background: m.win_rate > 50 ? 'rgba(74,222,128,0.15)' : m.win_rate > 30 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                          color: m.win_rate > 50 ? '#4ade80' : m.win_rate > 30 ? '#f59e0b' : '#ef4444',
                        }}>
                          {m.win_rate}%
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', color: '#ef4444', fontSize: 13 }}>{m.vampire_games}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', color: '#ef4444', fontSize: 13 }}>{m.vampire_wins}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', color: '#4ade80', fontSize: 13 }}>{m.innocent_games}</td>
                      <td style={{ textAlign: 'center', padding: '14px 16px', color: '#4ade80', fontSize: 13 }}>{m.innocent_wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Recent Games ── */}
          <div style={{
            background: 'rgba(20,22,30,0.7)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            backdropFilter: 'blur(12px)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>🕐 Recent Games</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                    {['#', 'Winner', 'Duration', 'Players', 'Date'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: h === '#' || h === 'Date' ? 'left' : 'center', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentGames.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 14 }}>
                        No games yet
                      </td>
                    </tr>
                  ) : recentGames.map((g, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '13px 16px', color: '#475569', fontSize: 12, fontFamily: 'monospace' }}>#{g.id}</td>
                      <td style={{ textAlign: 'center', padding: '13px 16px' }}>
                        <span style={{
                          padding: '4px 14px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          background: g.winner === 'villagers' ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
                          color: g.winner === 'villagers' ? '#4ade80' : '#ef4444',
                        }}>
                          {g.winner === 'villagers' ? '🧑‍🌾 Villagers' : '🧛 Vampire'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '13px 16px', color: '#94a3b8', fontSize: 13 }}>{g.duration_days}d</td>
                      <td style={{ textAlign: 'center', padding: '13px 16px', color: '#94a3b8', fontSize: 13 }}>{g.player_count}</td>
                      <td style={{ padding: '13px 16px', color: '#64748b', fontSize: 12 }}>{new Date(g.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(20,22,30,0.7)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16,
      backdropFilter: 'blur(12px)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {title}
        </h3>
      </div>
      <div style={{ padding: '16px 20px 8px' }}>
        {children}
      </div>
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#e2e8f0',
  fontSize: 13,
};
