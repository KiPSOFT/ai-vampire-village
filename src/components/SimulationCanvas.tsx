import React, { useEffect, useRef } from 'react';
import type { Agent } from '../engine/types';
import { GRID_SIZE } from '../engine/Simulation';

const processImageBackground = (img: HTMLImageElement): HTMLCanvasElement | null => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = data.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const avg = (r + g + b) / 3;
    const isGrayscale = Math.abs(r - avg) < 30 && Math.abs(g - avg) < 30 && Math.abs(b - avg) < 30;

    const isNeonGreen = g > 150 && r < 80 && b < 80;

    if ((isGrayscale && avg > 110) || avg > 240 || isNeonGreen) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
};

const processedSprites: Record<string, HTMLCanvasElement> = {};
const loadSprite = (key: string, src: string) => {
  const img = new Image();
  img.onload = () => {
    const p = processImageBackground(img);
    if (p) processedSprites[key] = p;
  };
  img.src = src;
};

loadSprite('innocent', '/innocent.png');
loadSprite('vampire', '/vampire.png');
['zone_marketplace', 'zone_fields', 'zone_blacksmith', 'zone_forest'].forEach(name => {
  loadSprite(name, `/${name}.png`);
});

interface SimulationCanvasProps {
  agents: Agent[];
  currentPhase: string;
  dayCount?: number;
  phaseEndTime: number;
  voteLog?: Array<{ voter: string; target: string; source?: string }>;
  votingKickOpen?: boolean;
  voteResult?: { name?: string; exiledId?: string; role?: string; isVampire?: boolean; none?: boolean };
  serverDrift?: number;
  villagerScore?: number;
  vampireScore?: number;
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ agents, currentPhase, dayCount, phaseEndTime, voteLog = [], votingKickOpen = false, voteResult, serverDrift = 0, villagerScore = 0, vampireScore = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeLeft, setTimeLeft] = React.useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, phaseEndTime - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [phaseEndTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Resize canvas to match display size for crisp rendering
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }
      }

      const w = canvas.width;
      const h = canvas.height;

      const padding = 0; // Enlarge grid visually
      const availableSize = Math.min(w, h) - padding * 2;
      const cellSize = availableSize / GRID_SIZE;

      const offsetX = (w - availableSize) / 2;
      const offsetY = (h - availableSize) / 2;

      ctx.clearRect(0, 0, w, h);

      // Draw Zone Regions
      const drawZone = (name: string, zx: number, zy: number, _color: string, imgKey: string) => {
        const px = offsetX + zx * cellSize;
        const py = offsetY + zy * cellSize;

        if (name !== 'Village Square') {
          const img = processedSprites[imgKey];
          if (img) {
            const drawSize = cellSize; // Exactly 1x1 grid cell
            const imgCenter = px + cellSize / 2;
            const imgMiddle = py + cellSize / 2;
            ctx.drawImage(img, imgCenter - drawSize / 2, imgMiddle - drawSize / 2, drawSize, drawSize);
          }
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.font = 'bold 16px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = 'rgba(0,0,0,1)';
        ctx.shadowBlur = 6;
        ctx.fillText(name, px + cellSize / 2, py - 10);
        ctx.shadowBlur = 0;
      };

      // Zones mapped to corners
      drawZone('Village Square', 5, 5, 'rgba(139, 90, 43, 0.7)', 'zone_square');
      drawZone('Marketplace', 1, 1, 'rgba(218, 165, 32, 0.7)', 'zone_marketplace');
      drawZone('Fields', 9, 1, 'rgba(34, 139, 34, 0.7)', 'zone_fields');
      drawZone('Blacksmith', 1, 9, 'rgba(139, 0, 0, 0.7)', 'zone_blacksmith');
      drawZone('Forest Edge', 9, 9, 'rgba(0, 100, 0, 0.7)', 'zone_forest');

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;

      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + i * cellSize, offsetY);
        ctx.lineTo(offsetX + i * cellSize, offsetY + availableSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + i * cellSize);
        ctx.lineTo(offsetX + availableSize, offsetY + i * cellSize);
        ctx.stroke();
      }

      // Group all agents by position (dead are also shown at their last position)
      const positionMap = new Map<string, Agent[]>();
      agents.forEach(agent => {
        const key = `${Math.round(agent.position.x)},${Math.round(agent.position.y)}`;
        if (!positionMap.has(key)) positionMap.set(key, []);
        positionMap.get(key)!.push(agent);
      });

      const bubbleJobs: Array<{ agent: Agent; cx: number; textY: number }> = [];

      positionMap.forEach((occupants) => {
        const totalCount = occupants.length;
        let occupantIndex = 0;

        occupants.forEach((agent) => {
          let cx = offsetX + agent.position.x * cellSize + cellSize / 2;
          let cy = offsetY + agent.position.y * cellSize + cellSize / 2;

          if (totalCount > 1) {
            const angle = (occupantIndex / totalCount) * Math.PI * 2;
            const ringRadius = cellSize * (agent.isDead ? 0.3 : 2.8); // Dead stay closer, alive spread out for bubbles
            if (!agent.isDead) {
                // Heavily exploded spread for living to prevent speech bubble overlapping
                cx += Math.cos(angle) * ringRadius;
                cy += Math.sin(angle) * ringRadius;
            } else {
                // Slight offset for dead bodies so they don't overlap perfectly
                cx += Math.cos(angle) * (cellSize * 0.4);
                cy += Math.sin(angle) * (cellSize * 0.4);
            }

            // Özel yerleşim istekleri (sadece canlılar için)
            if (!agent.isDead) {
                if (agent.name === 'Arthur') {
                  cx -= 55;
                  cy -= 40;
                } else if (agent.name === 'Barnaby') {
                  cy -= 55;
                  cx -= 40;
                } else if (agent.name === 'Thomas') {
                  cy -= 55;
                  cx -= 40;
                } else if (agent.name === 'Kael') {
                  cx -= 40;
                  cy -= 55;
                } else if (agent.name === 'Silas') {
                  cx -= 15;
                }

                // En üstteki agent'ın konuşma balonunun ekran dışına taşmasını engellemek için biraz aşağı alıyoruz
                if (Math.sin(angle) < -0.5) {
                  cy += 15;
                }
            }

            occupantIndex++;
          }

          const size = cellSize * 1.02;
          const imgX = cx - size / 2;
          const imgY = cy - size / 2;

          // Draw agent sprite seamlessly (Always Innocent to hide identity from Stream)
          const currentAvatar = processedSprites['innocent'];
          if (currentAvatar) {
            if (agent.isDead) {
              if (agent.deathReason === 'murdered') {
                ctx.filter = 'brightness(1000%) grayscale(100%) opacity(80%)';
              } else {
                ctx.filter = 'brightness(0%) opacity(80%)';
              }
            }
            ctx.drawImage(currentAvatar, imgX, imgY, size, size);
            if (agent.isDead) ctx.filter = 'none'; // reset filter for other agents
          } else {
            ctx.beginPath();
            ctx.arc(cx, cy, 20, 0, Math.PI * 2);
            ctx.fillStyle = agent.color;
            ctx.fill();
          }

          // Draw agent name above their head, but prevent clipping at the top
          ctx.fillStyle = agent.isDead ? '#a0a0a0' : agent.color;
          ctx.font = 'bold 26px Inter';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 4;

          let textY = cy - size / 2 - 5;
          if (textY < 16) textY = 16;

          ctx.fillText(agent.name, cx, textY);
          ctx.shadowBlur = 0;

          if (agent.isDead) {
            const nameWidth = ctx.measureText(agent.name).width;
            ctx.beginPath();
            ctx.moveTo(cx - nameWidth / 2, textY - 6);
            ctx.lineTo(cx + nameWidth / 2, textY - 6);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.stroke();

            return; // Dead agents NEVER render speech bubbles! Skip the rest of this loop iteration.
          }

          if (agent.isThinking && currentPhase !== 'VOTING_RESULT') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.roundRect(cx - 24, textY - 32, 48, 20, 10);
            ctx.fill();

            ctx.fillStyle = '#666';
            ctx.font = 'bold 20px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const t = Date.now();
            ctx.globalAlpha = ((t % 1000) > 500) ? 1 : 0.5;
            ctx.fillText('...', cx, textY - 24);
            ctx.globalAlpha = 1;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(cx - 8, textY - 8, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx - 2, textY - 3, 2, 0, Math.PI * 2);
            ctx.fill();
          }

          let isSpeaking = agent.lastDecision && (agent.lastDecision.dialogue_en || agent.lastDecision.dialogue_tr)
            ? !!(agent.lastDecision.dialogue_en || agent.lastDecision.dialogue_tr)
            : !!agent.lastMessage;

          if (agent.lastMessageTime) {
            const adjustedTime = Date.now() - serverDrift;
            if ((adjustedTime - agent.lastMessageTime) > 10000) {
              isSpeaking = false;
            }
          }

          if (isSpeaking && currentPhase !== 'NIGHT') {
            const engText = agent.lastDecision?.dialogue_en || '';
            const trText = agent.lastDecision?.dialogue_tr || agent.lastMessage || '';
            if (engText || trText) {
              bubbleJobs.push({ agent, cx, textY });
            }
          }
        }); // End internal occupant loop
      }); // End positionMap loop

      // Balonları tüm avatarların üstünde çizmek için ikinci geçiş (önceki ajanların gövdesi balonu kapatmasın)
      bubbleJobs.forEach(({ agent, cx, textY }) => {
        const engText = agent.lastDecision?.dialogue_en || '';
        const trText = agent.lastDecision?.dialogue_tr || agent.lastMessage || '';
        const bTextEn = engText.length > 250 ? engText.substring(0, 247) + '...' : engText;
        const bTextTr = trText.length > 250 ? trText.substring(0, 247) + '...' : trText;

        ctx.font = 'bold 22px Inter';
        ctx.textBaseline = 'alphabetic';

        const wrapText = (text: string, maxWidth: number) => {
          if (!text) return [];
          const words = text.split(' ');
          const lines: string[] = [];
          let currentLine = words[0] || '';
          for (let i = 1; i < words.length; i++) {
            const word = words[i];
            if (ctx.measureText(currentLine + " " + word).width < maxWidth) {
              currentLine += " " + word;
            } else {
              lines.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) lines.push(currentLine);
          return lines;
        };

        const maxWidth = 440;
        const linesEn = wrapText(bTextEn, maxWidth);
        const linesTr = wrapText(bTextTr, maxWidth);

        let maxLineWidth = 0;
        [...linesEn, ...linesTr].forEach(l => {
          const lw = ctx.measureText(l).width;
          if (lw > maxLineWidth) maxLineWidth = lw;
        });

        const bubbleW = Math.max(maxLineWidth + 32, 160);
        const lineHeight = 28;
        const paddingY = 20;

        const engHeight = linesEn.length * lineHeight;
        const trHeight = linesTr.length * lineHeight;
        const separator = (linesEn.length > 0 && linesTr.length > 0) ? 12 : 0;

        const bubbleH = paddingY * 2 + engHeight + trHeight + separator;
        const bubbleX = cx - bubbleW / 2;
        const bubbleY = textY - bubbleH - 42;
        const tailSize = 12;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        const r = 16;
        ctx.moveTo(bubbleX + r, bubbleY);
        ctx.lineTo(bubbleX + bubbleW - r, bubbleY);
        ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY, bubbleX + bubbleW, bubbleY + r);
        ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH - r);
        ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY + bubbleH, bubbleX + bubbleW - r, bubbleY + bubbleH);
        ctx.lineTo(cx + tailSize, bubbleY + bubbleH);
        ctx.lineTo(cx, bubbleY + bubbleH + tailSize);
        ctx.lineTo(cx - tailSize, bubbleY + bubbleH);
        ctx.lineTo(bubbleX + r, bubbleY + bubbleH);
        ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleH, bubbleX, bubbleY + bubbleH - r);
        ctx.lineTo(bubbleX, bubbleY + r);
        ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + r, bubbleY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.textAlign = 'center';
        let currentY = bubbleY + paddingY + 18;

        if (linesEn.length > 0) {
          ctx.fillStyle = '#666';
          linesEn.forEach(line => {
            ctx.fillText(line, cx, currentY);
            currentY += lineHeight;
          });
          currentY += separator;
        }
        if (linesTr.length > 0) {
          ctx.fillStyle = '#1a1a2e';
          linesTr.forEach(line => {
            ctx.fillText(line, cx, currentY);
            currentY += lineHeight;
          });
        }
      });

      // --- MAP OVERLAYS (Voting HUD: ajan + Kick izleyici) ---
      if (currentPhase === 'VOTING') {
        const agentVotes = voteLog.filter((e) => e.source !== 'viewer');
        const viewerVotes = voteLog.filter((e) => e.source === 'viewer');
        const agentLines =
          agentVotes.length > 0
            ? agentVotes.map((e, i) => `${i + 1}. ${e.voter} → ${e.target}`)
            : ['Henüz ajan oyu yok...'];
        const viewerLines =
          viewerVotes.length > 0
            ? viewerVotes.map((e, i) => `${i + 1}. ${e.voter} → ${e.target}`)
            : votingKickOpen
              ? ['Henüz izleyici oyu yok...']
              : [];
        const lineCount =
          2 +
          agentLines.length +
          (votingKickOpen || viewerLines.length > 0 ? 2 + Math.max(viewerLines.length, 1) : 1);
        const panelH = Math.min(canvas.height - 64, 72 + lineCount * 40);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        ctx.roundRect(canvas.width - 516, 32, 492, panelH, 16);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px Inter';
        ctx.textAlign = 'left';
        ctx.fillText('AJAN OYLARI', canvas.width - 496, 80);

        ctx.font = '26px Inter';
        let y = 116;
        agentLines.forEach((line) => {
          ctx.fillStyle = line.startsWith('Henüz') ? '#888' : '#e5e5e5';
          const truncated = line.length > 34 ? line.slice(0, 31) + '...' : line;
          ctx.fillText(truncated, canvas.width - 496, y);
          y += 40;
        });

        if (!votingKickOpen) {
          ctx.fillStyle = '#666';
          ctx.font = '22px Inter';
          ctx.fillText('Kick: ajanlar bitince', canvas.width - 496, y + 8);
          y += 44;
        }

        if (votingKickOpen || viewerLines.length > 0) {
          y += 16;
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 28px Inter';
          ctx.fillText('İZLEYİCİ (Kick)', canvas.width - 496, y);
          y += 44;
          ctx.font = '26px Inter';
          viewerLines.forEach((line) => {
            ctx.fillStyle = line.startsWith('Henüz') ? '#888' : '#fde68a';
            const truncated = line.length > 34 ? line.slice(0, 31) + '...' : line;
            ctx.fillText(truncated, canvas.width - 496, y);
            y += 40;
          });
        }
      }

      requestAnimationFrame(render);
    };

    const animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [agents, currentPhase, phaseEndTime, voteLog, votingKickOpen, voteResult, serverDrift]);

  return (
    <div className="canvas-container glass-panel" style={{ position: 'relative' }}>
      <style>{`
        @keyframes viewer-vote-pulse {
          0%, 100% { text-shadow: 0 0 18px #fbbf24, 0 0 40px #f59e0b; opacity: 1; }
          50%       { text-shadow: 0 0 36px #fbbf24, 0 0 80px #f59e0b; opacity: 0.75; }
        }
        @keyframes viewer-vote-icon-bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
      `}</style>

      {currentPhase === 'NIGHT' && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: '#ef4444', fontSize: '3.5rem', fontFamily: 'Inter', textShadow: '0 0 10px black', textAlign: 'center', margin: 0 }}>NIGHT PHASE</h2>
          <h3 style={{ color: '#ef4444', fontSize: '2rem', fontFamily: 'Inter', textShadow: '0 0 8px black', textAlign: 'center', marginTop: 10 }}>(Vampire is choosing...)</h3>

          <h2 style={{ color: '#ef4444', fontSize: '3.5rem', fontFamily: 'Inter', textShadow: '0 0 10px black', textAlign: 'center', margin: '40px 0 0 0' }}>GECE FAZI</h2>
          <h3 style={{ color: '#ef4444', fontSize: '2rem', fontFamily: 'Inter', textShadow: '0 0 8px black', textAlign: 'center', marginTop: 10 }}>(Vampir seçiyor...)</h3>
        </div>
      )}

      {currentPhase === 'VOTING' && votingKickOpen && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.82)',
          zIndex: 10, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 0,
        }}>
          <div style={{
            animation: 'viewer-vote-icon-bounce 1.4s ease-in-out infinite',
            fontSize: '5rem',
            marginBottom: 12,
          }}>🗳️</div>

          <h2 style={{
            color: '#fbbf24',
            fontSize: '3.8rem',
            fontFamily: 'Inter',
            fontWeight: 900,
            textAlign: 'center',
            margin: 0,
            animation: 'viewer-vote-pulse 1.6s ease-in-out infinite',
          }}>
            VIEWER VOTE TIME!
          </h2>
          <h3 style={{
            color: '#fde68a',
            fontSize: '2rem',
            fontFamily: 'Inter',
            fontWeight: 600,
            textAlign: 'center',
            marginTop: 10,
            marginBottom: 0,
            textShadow: '0 0 8px #f59e0b',
          }}>
            Cast your vote in Kick chat!
          </h3>

          <div style={{
            width: 280,
            height: 3,
            background: 'linear-gradient(90deg, transparent, #fbbf24, transparent)',
            margin: '28px 0',
            borderRadius: 3,
          }} />

          <h2 style={{
            color: '#fbbf24',
            fontSize: '3.8rem',
            fontFamily: 'Inter',
            fontWeight: 900,
            textAlign: 'center',
            margin: 0,
            animation: 'viewer-vote-pulse 1.6s ease-in-out infinite',
            animationDelay: '0.8s',
          }}>
            İZLEYİCİ OY ZAMANI!
          </h2>
          <h3 style={{
            color: '#fde68a',
            fontSize: '2rem',
            fontFamily: 'Inter',
            fontWeight: 600,
            textAlign: 'center',
            marginTop: 10,
            textShadow: '0 0 8px #f59e0b',
          }}>
            Kick sohbetinde oyunu kullan!
          </h3>
        </div>
      )}
      {currentPhase === 'VOTING_RESULT' && voteResult && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          {voteResult.none ? (
            <>
              <h2 style={{ color: '#888', fontSize: '2.2rem', fontFamily: 'Inter', textAlign: 'center', margin: 0 }}>Kimse yeterli oyu alamadı</h2>
              <p style={{ color: '#aaa', fontSize: '1.25rem', fontFamily: 'Inter', textAlign: 'center', marginTop: 12 }}>
                {agents.filter(a => !a.isDead).length <= 2
                  ? "Köy oylamada kararsız kaldı (1v1 berabere). Hayatta kalan son masumu vampir öldürecek. VAMPİR KAZANDI!"
                  : "Köy pas geçti, kimse kovulmadı. Oyun devam edecek."}
              </p>
              <p style={{ color: '#bdbdbd', fontSize: '1.12rem', fontFamily: 'Inter', textAlign: 'center', marginTop: 8 }}>
                {agents.filter(a => !a.isDead).length <= 2
                  ? "The village ended in a tie (1v1). The vampire will kill the last innocent. VAMPIRE WINS!"
                  : "The village skipped. No one was exiled. The game continues."}
              </p>
            </>
          ) : (
            <>
              <h2 style={{ color: '#ef4444', fontSize: '2.5rem', fontFamily: 'Inter', textShadow: '0 0 10px black', textAlign: 'center', margin: 0 }}>TOWN HALL KARARI</h2>
              <h3 style={{ color: '#fff', fontSize: '2.8rem', fontFamily: 'Inter', textShadow: '0 0 8px black', textAlign: 'center', margin: '20px 0 0 0' }}>Kovulan: {voteResult.name}</h3>
              <p style={{
                color: voteResult.isVampire ? '#4ade80' : '#a3a3a3',
                fontSize: '1.5rem',
                fontFamily: 'Inter',
                textAlign: 'center',
                marginTop: 16,
                maxWidth: 720,
                lineHeight: 1.4
              }}>
                {voteResult.isVampire
                  ? 'Vampir yakalandı — köylüler kazandı, oyun bitti.'
                  : (agents.filter(a => !a.isDead).length <= 1
                    ? "Masum bir köylü kovuldu; köyde geriye sadece vampir kaldı. VAMPİR KAZANDI!"
                    : "Masum bir köylü kovuldu; vampir hâlâ aranızda. Oyun devam edecek.")}
              </p>
              <p style={{
                color: voteResult.isVampire ? '#86efac' : '#d4d4d4',
                fontSize: '1.2rem',
                fontFamily: 'Inter',
                textAlign: 'center',
                marginTop: 8,
                maxWidth: 720,
                lineHeight: 1.35
              }}>
                {voteResult.isVampire
                  ? 'The vampire was caught — villagers win, game over.'
                  : (agents.filter(a => !a.isDead).length <= 1
                    ? 'An innocent was exiled; only the vampire remains. VAMPIRE WINS!'
                    : 'An innocent was exiled; the vampire is still among you. The game continues.')}
              </p>
            </>
          )}
          {!voteResult.none && voteResult.exiledId ? (() => {
            const exile = agents.find((a) => a.id === voteResult.exiledId);
            if (!exile) return null;
            return (
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 28, marginTop: 36, justifyContent: 'center', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 96 }}>
                  <img
                    src="/innocent.png"
                    alt=""
                    style={{
                      width: 96,
                      height: 96,
                      objectFit: 'contain',
                      filter: 'grayscale(100%) opacity(0.92)',
                    }}
                  />
                  <span style={{ color: '#c0c0c0', fontFamily: 'Inter', fontWeight: 700, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                    {exile.name}
                  </span>
                </div>
              </div>
            );
          })() : null}
        </div>
      )}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: 8, color: 'white', fontFamily: 'Inter', fontWeight: 'bold' }}>
        Faz: {dayCount ? `${dayCount}. Gün / Day ${dayCount} ` : ''}({currentPhase}) | {timeLeft}
      </div>
      <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '12px 20px', borderRadius: 8, color: 'white', fontFamily: 'Inter', fontWeight: 'bold' }}>
        <div style={{ fontSize: '14px', marginBottom: '4px', color: '#aaa' }}>OVERALL SCORE</div>
        <div style={{ display: 'flex', gap: '20px', fontSize: '18px' }}>
          <span style={{ color: '#4ade80' }}>🧑‍🌾 Villagers: {villagerScore}</span>
          <span style={{ color: '#ef4444' }}>🧛 Vampire: {vampireScore}</span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};
