import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

  if (loading) {
    return (
      <div className="stats-page" style={{ padding: 40, textAlign: 'center' }}>
        <h2>Loading statistics...</h2>
      </div>
    );
  }

  const winRateData = gameStats ? [
    { name: 'Villagers', value: gameStats.villagerWins, color: '#4ade80' },
    { name: 'Vampire', value: gameStats.vampireWins, color: '#ef4444' }
  ] : [];

  const modelWinRateData = modelStats.map(m => ({
    name: m.model.split('/').pop()?.replace(/-instruct.*/, '').substring(0, 15) || m.model,
    winRate: m.win_rate,
    totalGames: m.total_games
  }));

  const modelRoleData = modelStats.map(m => ({
    name: m.model.split('/').pop()?.replace(/-instruct.*/, '').substring(0, 15) || m.model,
    vampire: m.vampire_games,
    innocent: m.innocent_games
  }));

  const modelWinByRoleData = modelStats.map(m => ({
    name: m.model.split('/').pop()?.replace(/-instruct.*/, '').substring(0, 15) || m.model,
    vampireWins: m.vampire_wins,
    innocentWins: m.innocent_wins
  }));

  return (
    <div className="stats-page glass-panel" style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 32, color: '#fff' }}>📊 AI Vampire Village Statistics</h1>
      
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="glass-panel" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>Total Games</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: '#fff' }}>{gameStats?.totalGames || 0}</div>
        </div>
        <div className="glass-panel" style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>Avg Duration</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: '#fff' }}>{gameStats?.avgDuration || 0}</div>
          <div style={{ fontSize: 12, color: '#888' }}>days</div>
        </div>
        <div className="glass-panel" style={{ padding: 20, textAlign: 'center', background: 'rgba(74, 222, 128, 0.1)' }}>
          <div style={{ fontSize: 14, color: '#4ade80', marginBottom: 8 }}>🧑‍🌾 Villagers Win Rate</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: '#4ade80' }}>{gameStats?.villagerWinRate || 0}%</div>
        </div>
        <div className="glass-panel" style={{ padding: 20, textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)' }}>
          <div style={{ fontSize: 14, color: '#ef4444', marginBottom: 8 }}>🧛 Vampire Win Rate</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: '#ef4444' }}>{gameStats?.vampireWinRate || 0}%</div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Win Rate Pie Chart */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16, color: '#fff' }}>Overall Win Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={winRateData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {winRateData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Model Win Rate Bar Chart */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16, color: '#fff' }}>Win Rate by LLM Model</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={modelWinRateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" fontSize={10} angle={-45} textAnchor="end" height={60} />
              <YAxis stroke="#888" />
              <Tooltip 
                contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="winRate" fill="#6366f1" name="Win Rate %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Role Distribution by Model */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16, color: '#fff' }}>Role Distribution by Model</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={modelRoleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" fontSize={10} angle={-45} textAnchor="end" height={60} />
              <YAxis stroke="#888" />
              <Tooltip 
                contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="innocent" stackId="a" fill="#4ade80" name="Innocent" />
              <Bar dataKey="vampire" stackId="a" fill="#ef4444" name="Vampire" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Wins by Role */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16, color: '#fff' }}>Wins by Role & Model</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={modelWinByRoleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" fontSize={10} angle={-45} textAnchor="end" height={60} />
              <YAxis stroke="#888" />
              <Tooltip 
                contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="innocentWins" fill="#4ade80" name="Innocent Wins" />
              <Bar dataKey="vampireWins" fill="#ef4444" name="Vampire Wins" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model Performance Table */}
      <div className="glass-panel" style={{ padding: 20, marginBottom: 32 }}>
        <h3 style={{ marginBottom: 16, color: '#fff' }}>🏆 Model Performance Leaderboard</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333' }}>
                <th style={{ textAlign: 'left', padding: 12, color: '#888' }}>Model</th>
                <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>Games</th>
                <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>Wins</th>
                <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>Win Rate</th>
                <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>🧛 Vamp Games</th>
                <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>🧛 Vamp Wins</th>
                <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>🧑‍🌾 Innocent Games</th>
                <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>🧑‍🌾 Innocent Wins</th>
              </tr>
            </thead>
            <tbody>
              {modelStats.map((m, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: 12, color: '#fff' }}>{m.model}</td>
                  <td style={{ textAlign: 'center', padding: 12, color: '#ccc' }}>{m.total_games}</td>
                  <td style={{ textAlign: 'center', padding: 12, color: '#ccc' }}>{m.total_wins}</td>
                  <td style={{ textAlign: 'center', padding: 12, color: m.win_rate > 50 ? '#4ade80' : m.win_rate > 30 ? '#f59e0b' : '#ef4444', fontWeight: 'bold' }}>
                    {m.win_rate}%
                  </td>
                  <td style={{ textAlign: 'center', padding: 12, color: '#ef4444' }}>{m.vampire_games}</td>
                  <td style={{ textAlign: 'center', padding: 12, color: '#ef4444' }}>{m.vampire_wins}</td>
                  <td style={{ textAlign: 'center', padding: 12, color: '#4ade80' }}>{m.innocent_games}</td>
                  <td style={{ textAlign: 'center', padding: 12, color: '#4ade80' }}>{m.innocent_wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Games */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 16, color: '#fff' }}>🕐 Recent Games</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #333' }}>
                <th style={{ textAlign: 'left', padding: 12, color: '#888' }}>Game ID</th>
                <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>Winner</th>
                <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>Duration</th>
                <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>Players</th>
                <th style={{ textAlign: 'left', padding: 12, color: '#888' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentGames.map((g, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: 12, color: '#888' }}>#{g.id}</td>
                  <td style={{ textAlign: 'center', padding: 12 }}>
                    <span style={{ 
                      padding: '4px 12px', 
                      borderRadius: 12, 
                      background: g.winner === 'villagers' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: g.winner === 'villagers' ? '#4ade80' : '#ef4444'
                    }}>
                      {g.winner === 'villagers' ? '🧑‍🌾 Villagers' : '🧛 Vampire'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: 12, color: '#ccc' }}>{g.duration_days} days</td>
                  <td style={{ textAlign: 'center', padding: 12, color: '#ccc' }}>{g.player_count}</td>
                  <td style={{ padding: 12, color: '#888' }}>{new Date(g.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
