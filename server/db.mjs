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

// Detaylı istatistikler (isteğe bağlı, ilerde dashboard için kullanılabilir)
export function getDetailedStats() {
  const agentPerformance = db.prepare(`
    SELECT agent_name, model, role, COUNT(*) as play_count, SUM(is_winner) as win_count
    FROM agent_stats
    GROUP BY agent_name, model, role
  `).all();

  return { agentPerformance };
}
