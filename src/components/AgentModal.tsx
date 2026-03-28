import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { fetchModels } from '../api/groq';
import type { GroqModel } from '../api/groq';
import type { ProviderType } from '../engine/types';
import { AGENT_PERSONAS } from '../../shared/types';
import type { ServerConfig } from '../App';

interface AgentModalProps {
  onClose: () => void;
  onCreate: (name: string, model: string, color: string, count: number, requestedPersona?: string, provider?: ProviderType) => void;
  serverConfig: ServerConfig;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#6366f1', '#d946ef', '#f43f5e'];

export const AgentModal: React.FC<AgentModalProps> = ({ onClose, onCreate, serverConfig }) => {
  const { ollamaModel, openRouterModels, groqApiKey } = serverConfig;

  const [groqModels, setGroqModels] = useState<GroqModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('name');
  const [color, setColor] = useState(COLORS[0]);
  const [count, setCount] = useState(1);
  const [selectedPersona, setSelectedPersona] = useState('');
  const [provider, setProvider] = useState<ProviderType>('ollama');

  useEffect(() => {
    if (!groqApiKey) {
      setLoading(false);
      return;
    }
    fetchModels(groqApiKey)
      .then(res => {
        setGroqModels(res);
        if (res.length > 0) setSelectedModel(res[0].id);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load Groq models');
        setLoading(false);
      });
  }, [groqApiKey]);

  // When provider changes, reset selected model
  useEffect(() => {
    if (provider === 'ollama') {
      setSelectedModel(ollamaModel);
    } else if (provider === 'openrouter') {
      setSelectedModel(openRouterModels[0] || '');
    } else if (provider === 'groq' && groqModels.length > 0) {
      setSelectedModel(groqModels[0].id);
    }
  }, [provider, groqModels, ollamaModel, openRouterModels]);

  const processedGroqModels = groqModels
    .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.id.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (provider === 'groq' && processedGroqModels.length > 0 && !processedGroqModels.find(m => m.id === selectedModel)) {
      setSelectedModel(processedGroqModels[0].id);
    }
  }, [processedGroqModels, selectedModel, provider]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || count < 1) {
      setError('Please fill all required fields correctly');
      return;
    }
    if (provider !== 'ollama' && !selectedModel) {
      setError('Please select a model');
      return;
    }
    const model = provider === 'ollama' ? ollamaModel : selectedModel;
    onCreate(name, model, color, count, selectedPersona || undefined, provider);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        <div className="modal-header">
          <h2 className="modal-title">Spawn New Agent</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Agent Base Name</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Explorer-1" 
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Spawn Count (Max 50)</label>
            <input 
              type="number" 
              className="input-field" 
              min="1"
              max="50"
              value={count}
              onChange={e => setCount(parseInt(e.target.value) || 1)}
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Agent Persona / Role</label>
            <select 
              className="select-field" 
              value={selectedPersona} 
              onChange={e => setSelectedPersona(e.target.value)}
            >
              <option value="">🔮 Rastgele (Random)</option>
              {AGENT_PERSONAS.map(p => (
                <option key={p.name} value={p.name}>
                  {p.name} - {p.description.substring(0, 45)}...
                </option>
              ))}
            </select>
          </div>

          {/* ── Provider Selection ── */}
          <div className="form-group">
            <label className="label">Provider</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([
                { value: 'ollama', label: '🦙 Ollama', color: '#22c55e' },
                { value: 'groq', label: '⚡ Groq', color: '#0ea5e9' },
                { value: 'openrouter', label: '🌐 OpenRouter', color: '#a855f7' },
              ] as { value: ProviderType; label: string; color: string }[]).map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setProvider(p.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: provider === p.value ? `2px solid ${p.color}` : '2px solid rgba(255,255,255,0.1)',
                    backgroundColor: provider === p.value ? `${p.color}22` : 'transparent',
                    color: provider === p.value ? p.color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: provider === p.value ? 600 : 400,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              {provider === 'ollama' && `Yerel Ollama · Model: ${ollamaModel}`}
              {provider === 'groq' && 'Groq Cloud API · Hızlı çıkarım'}
              {provider === 'openrouter' && `OpenRouter · ${openRouterModels.length} model tanımlı`}
            </div>
          </div>

          {/* ── Model Selection (Groq) ── */}
          {provider === 'groq' && (
          <div className="form-group">
            <label className="label">AI Model</label>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading models...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Search models..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <select 
                    className="select-field" 
                    value={sortOrder} 
                    onChange={e => setSortOrder(e.target.value)}
                    style={{ width: '130px', padding: '0.5rem' }}
                  >
                    <option value="name">A-Z</option>
                  </select>
                </div>
                <select 
                  className="select-field"
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                >
                  {processedGroqModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.id}
                    </option>
                  ))}
                </select>
                {processedGroqModels.length === 0 && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    No models match your criteria.
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* ── Model Selection (OpenRouter — from server config) ── */}
          {provider === 'openrouter' && (
          <div className="form-group">
            <label className="label">AI Model</label>
            {openRouterModels.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                ⚠️ OPENROUTER_MODELS env değişkeni tanımlı değil.
              </div>
            ) : (
              <select 
                className="select-field"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              >
                {openRouterModels.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>
          )}

          <div className="form-group">
            <label className="label">Avatar Color</label>
            <div className="colors-grid">
              {COLORS.map(c => (
                <div 
                  key={c}
                  className={`color-option ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={provider === 'groq' && loading}>Spawn Agent</button>
          </div>
        </form>
      </div>
    </div>
  );
};
