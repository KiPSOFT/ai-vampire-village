import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'village_stats.db');
const db = new Database(dbPath);

// Veritabanı şemasını oluştur
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      winner TEXT, -- 'villagers' or 'vampire'
      duration_days INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name TEXT,
      model TEXT,
      role TEXT, -- 'VAMPIRE' or 'INNOCENT'
      is_winner BOOLEAN,
      game_id INTEGER,
      FOREIGN KEY(game_id) REFERENCES games(id)
    );

    CREATE TABLE IF NOT EXISTS viewer_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voter_name TEXT,
      target_name TEXT,
      game_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(game_id) REFERENCES games(id)
    );
  `);
}

// Yeni bir oyun kaydı oluştur ve ID'sini dön
export function createGameRecord() {
  const stmt = db.prepare('INSERT INTO games DEFAULT VALUES');
  const info = stmt.run();
  return info.lastInsertRowid;
}

// Oyun bittiğinde kazananı ve süreyi güncelle
export function updateGameResult(gameId, winner, durationDays) {
  const stmt = db.prepare('UPDATE games SET winner = ?, duration_days = ? WHERE id = ?');
  stmt.run(winner, durationDays, gameId);
}

// Her ajan için istatistik ekle
export function addAgentGameStat(gameId, agentName, model, role, isWinner) {
  const stmt = db.prepare(`
    INSERT INTO agent_stats (game_id, agent_name, model, role, is_winner)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(gameId, agentName, model, role, isWinner ? 1 : 0);
}

// İzleyici oyu kaydet
export function addViewerVote(gameId, voterName, targetName) {
  const stmt = db.prepare(`
    INSERT INTO viewer_votes (game_id, voter_name, target_name)
    VALUES (?, ?, ?)
  `);
  stmt.run(gameId, voterName, targetName);
}

// Global skorları getir
export function getGlobalScores() {
  const villagerWins = db.prepare("SELECT COUNT(*) as count FROM games WHERE winner = 'villagers'").get().count;
  const vampireWins = db.prepare("SELECT COUNT(*) as count FROM games WHERE winner = 'vampire'").get().count;
  return { villagerWins, vampireWins };
}

// Detaylı istatistikler
export function getDetailedStats() {
  const agentPerformance = db.prepare(`
    SELECT agent_name, model, role, COUNT(*) as play_count, SUM(is_winner) as win_count
    FROM agent_stats
    GROUP BY agent_name, model, role
  `).all();

  return { agentPerformance };
}

// Toplam oyun sayısı ve kazanan oranları
export function getGameStats() {
  const totalGames = db.prepare("SELECT COUNT(*) as count FROM games WHERE winner IS NOT NULL").get().count;
  const villagerWins = db.prepare("SELECT COUNT(*) as count FROM games WHERE winner = 'villagers'").get().count;
  const vampireWins = db.prepare("SELECT COUNT(*) as count FROM games WHERE winner = 'vampire'").get().count;
  const avgDuration = db.prepare("SELECT AVG(duration_days) as avg FROM games WHERE winner IS NOT NULL").get().avg || 0;
  
  return {
    totalGames,
    villagerWins,
    vampireWins,
    villagerWinRate: totalGames > 0 ? ((villagerWins / totalGames) * 100).toFixed(1) : 0,
    vampireWinRate: totalGames > 0 ? ((vampireWins / totalGames) * 100).toFixed(1) : 0,
    avgDuration: avgDuration.toFixed(1)
  };
}

// LLM model bazında rol dağılımı
export function getModelRoleStats() {
  return db.prepare(`
    SELECT 
      model,
      role,
      COUNT(*) as count
    FROM agent_stats
    GROUP BY model, role
    ORDER BY model, role
  `).all();
}

// LLM model bazında kazanma oranları
export function getModelWinStats() {
  return db.prepare(`
    SELECT 
      model,
      role,
      COUNT(*) as total_games,
      SUM(is_winner) as wins,
      ROUND((SUM(is_winner) * 100.0 / COUNT(*)), 1) as win_rate
    FROM agent_stats
    GROUP BY model, role
    ORDER BY model, role
  `).all();
}

// Son oyunlar
export function getRecentGames(limit = 20) {
  return db.prepare(`
    SELECT 
      g.id,
      g.winner,
      g.duration_days,
      g.created_at,
      (SELECT COUNT(*) FROM agent_stats WHERE game_id = g.id) as player_count
    FROM games g
    WHERE g.winner IS NOT NULL
    ORDER BY g.created_at DESC
    LIMIT ?
  `).all(limit);
}

// Model bazında toplam performans
export function getModelOverallStats() {
  return db.prepare(`
    SELECT 
      model,
      COUNT(*) as total_games,
      SUM(is_winner) as total_wins,
      ROUND((SUM(is_winner) * 100.0 / COUNT(*)), 1) as win_rate,
      SUM(CASE WHEN role = 'VAMPIRE' THEN 1 ELSE 0 END) as vampire_games,
      SUM(CASE WHEN role = 'INNOCENT' THEN 1 ELSE 0 END) as innocent_games,
      SUM(CASE WHEN role = 'VAMPIRE' AND is_winner = 1 THEN 1 ELSE 0 END) as vampire_wins,
      SUM(CASE WHEN role = 'INNOCENT' AND is_winner = 1 THEN 1 ELSE 0 END) as innocent_wins
    FROM agent_stats
    GROUP BY model
    ORDER BY win_rate DESC
  `).all();
}
