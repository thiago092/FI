import React, { useState, useEffect } from 'react';
import { 
  Clock, MessageSquare, Search, Calendar, Filter, 
  Eye, Edit2, Trash2, Archive, Plus, RefreshCw,
  MessageCircle, Mic, Bot, User
} from 'lucide-react';
import './ChatHistory.css';

interface ChatMessage {
  id: number;
  tipo: 'USUARIO' | 'BOT';
  conteudo: string;
  criado_em: string;
  via_voz: boolean;
  transacao_criada: boolean;
}

interface ChatSession {
  id: number;
  titulo: string;
  tenant_id: string;
  criado_em: string;
  atualizado_em: string;
  ativa: boolean;
  total_mensagens: number;
  transacoes_criadas: number;
}

interface ChatSessionWithMessages extends ChatSession {
  mensagens: ChatMessage[];
}

interface ChatHistoryFilters {
  busca: string;
  data_inicio: string;
  data_fim: string;
  apenas_ativas: boolean;
  limit: number;
  offset: number;
}

interface ChatHistoryProps {
  onSelectSession?: (sessionId: number) => void;
  onNewSession?: () => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ onSelectSession, onNewSession }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSessionWithMessages | null>(null);
  const [filters, setFilters] = useState<ChatHistoryFilters>({
    busca: '',
    data_inicio: '',
    data_fim: '',
    apenas_ativas: true,
    limit: 20,
    offset: 0
  });
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    carregarSessoes();
  }, [filters]);

  const carregarSessoes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/chat/historico?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setSessions(data.sessoes || []);
      } else {
        console.error('Erro ao carregar sessões:', data);
      }
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarDetalheSessao = async (sessionId: number) => {
    try {
      const response = await fetch(`/api/chat/sessao/${sessionId}`);
      const data = await response.json();
      
      if (response.ok) {
        setSelectedSession(data);
        setViewMode('detail');
      } else {
        console.error('Erro ao carregar sessão:', data);
      }
    } catch (error) {
      console.error('Erro ao carregar sessão:', error);
    }
  };

  const atualizarTituloSessao = async (sessionId: number, novoTitulo: string) => {
    try {
      const response = await fetch(`/api/chat/sessao/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: novoTitulo })
      });

      if (response.ok) {
        carregarSessoes();
        setEditingSession(null);
        setNewTitle('');
      }
    } catch (error) {
      console.error('Erro ao atualizar título:', error);
    }
  };

  const excluirSessao = async (sessionId: number) => {
    if (!confirm('Tem certeza que deseja excluir esta conversa?')) return;

    try {
      const response = await fetch(`/api/chat/sessao/${sessionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        carregarSessoes();
        if (selectedSession?.id === sessionId) {
          setSelectedSession(null);
          setViewMode('list');
        }
      }
    } catch (error) {
      console.error('Erro ao excluir sessão:', error);
    }
  };

  const arquivarSessao = async (sessionId: number) => {
    try {
      const response = await fetch(`/api/chat/sessao/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativa: false })
      });

      if (response.ok) {
        carregarSessoes();
      }
    } catch (error) {
      console.error('Erro ao arquivar sessão:', error);
    }
  };

  const criarNovaSessao = async () => {
    try {
      const response = await fetch('/api/chat/nova-sessao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const novaSessao = await response.json();
        carregarSessoes();
        if (onNewSession) {
          onNewSession();
        }
        return novaSessao;
      }
    } catch (error) {
      console.error('Erro ao criar nova sessão:', error);
    }
  };

  const formatarData = (dataString: string) => {
    const data = new Date(dataString);
    const agora = new Date();
    const diff = agora.getTime() - data.getTime();
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (dias === 0) {
      return `Hoje, ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (dias === 1) {
      return `Ontem, ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (dias < 7) {
      return `${dias} dias atrás`;
    } else {
      return data.toLocaleDateString('pt-BR');
    }
  };

  const renderFilters = () => (
    <div className={`chat-history-filters ${showFilters ? 'active' : ''}`}>
      <div className="filters-grid">
        <div className="filter-group">
          <label>Buscar conversas</label>
          <div className="search-input">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Buscar por título ou conteúdo..."
              value={filters.busca}
              onChange={(e) => setFilters(prev => ({ ...prev, busca: e.target.value }))}
            />
          </div>
        </div>

        <div className="filter-group">
          <label>Data início</label>
          <input
            type="date"
            value={filters.data_inicio}
            onChange={(e) => setFilters(prev => ({ ...prev, data_inicio: e.target.value }))}
          />
        </div>

        <div className="filter-group">
          <label>Data fim</label>
          <input
            type="date"
            value={filters.data_fim}
            onChange={(e) => setFilters(prev => ({ ...prev, data_fim: e.target.value }))}
          />
        </div>

        <div className="filter-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.apenas_ativas}
              onChange={(e) => setFilters(prev => ({ ...prev, apenas_ativas: e.target.checked }))}
            />
            Apenas conversas ativas
          </label>
        </div>
      </div>

      <div className="filters-actions">
        <button 
          className="btn-secondary"
          onClick={() => setFilters({
            busca: '',
            data_inicio: '',
            data_fim: '',
            apenas_ativas: true,
            limit: 20,
            offset: 0
          })}
        >
          Limpar filtros
        </button>
      </div>
    </div>
  );

  const renderSessionList = () => (
    <div className="chat-history-list">
      <div className="list-header">
        <h3>
          <MessageSquare size={20} />
          Histórico de Conversas
        </h3>
        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={() => setShowFilters(!showFilters)}
            title="Filtros"
          >
            <Filter size={16} />
          </button>
          <button
            className="btn-icon"
            onClick={carregarSessoes}
            title="Atualizar"
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="btn-primary"
            onClick={criarNovaSessao}
            title="Nova conversa"
          >
            <Plus size={16} />
            Nova
          </button>
        </div>
      </div>

      {renderFilters()}

      {loading ? (
        <div className="loading">
          <RefreshCw className="spin" size={20} />
          Carregando conversas...
        </div>
      ) : (
        <div className="sessions-list">
          {sessions.length === 0 ? (
            <div className="empty-state">
              <MessageCircle size={48} />
              <h4>Nenhuma conversa encontrada</h4>
              <p>Comece uma nova conversa para ver o histórico aqui.</p>
              <button className="btn-primary" onClick={criarNovaSessao}>
                <Plus size={16} />
                Iniciar conversa
              </button>
            </div>
          ) : (
            sessions.map(session => (
              <div 
                key={session.id} 
                className={`session-item ${!session.ativa ? 'archived' : ''}`}
                onClick={() => carregarDetalheSessao(session.id)}
              >
                <div className="session-content">
                  <div className="session-header">
                    {editingSession === session.id ? (
                      <div className="edit-title" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              atualizarTituloSessao(session.id, newTitle);
                            }
                          }}
                          onBlur={() => {
                            if (newTitle.trim()) {
                              atualizarTituloSessao(session.id, newTitle);
                            } else {
                              setEditingSession(null);
                              setNewTitle('');
                            }
                          }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <h4 className="session-title">{session.titulo}</h4>
                    )}
                  </div>

                  <div className="session-stats">
                    <span className="stat">
                      <MessageSquare size={12} />
                      {session.total_mensagens} mensagens
                    </span>
                    {session.transacoes_criadas > 0 && (
                      <span className="stat transactions">
                        <Bot size={12} />
                        {session.transacoes_criadas} transações
                      </span>
                    )}
                  </div>

                  <div className="session-time">
                    <Clock size={12} />
                    {formatarData(session.atualizado_em)}
                  </div>
                </div>

                <div className="session-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-icon"
                    onClick={() => carregarDetalheSessao(session.id)}
                    title="Ver conversa"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => {
                      setEditingSession(session.id);
                      setNewTitle(session.titulo);
                    }}
                    title="Editar título"
                  >
                    <Edit2 size={14} />
                  </button>
                  {session.ativa && (
                    <button
                      className="btn-icon"
                      onClick={() => arquivarSessao(session.id)}
                      title="Arquivar"
                    >
                      <Archive size={14} />
                    </button>
                  )}
                  <button
                    className="btn-icon danger"
                    onClick={() => excluirSessao(session.id)}
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  const renderSessionDetail = () => {
    if (!selectedSession) return null;

    return (
      <div className="chat-history-detail">
        <div className="detail-header">
          <button
            className="btn-back"
            onClick={() => {
              setViewMode('list');
              setSelectedSession(null);
            }}
          >
            ← Voltar
          </button>
          <div className="detail-info">
            <h3>{selectedSession.titulo}</h3>
            <div className="detail-stats">
              <span>{selectedSession.mensagens.length} mensagens</span>
              <span>{selectedSession.transacoes_criadas} transações</span>
              <span>{formatarData(selectedSession.criado_em)}</span>
            </div>
          </div>
        </div>

        <div className="messages-container">
          {selectedSession.mensagens.map(message => (
            <div 
              key={message.id} 
              className={`message ${message.tipo.toLowerCase()}`}
            >
              <div className="message-header">
                <div className="message-author">
                  {message.tipo === 'USUARIO' ? (
                    <>
                      <User size={16} />
                      Você
                      {message.via_voz && <Mic size={12} className="voice-indicator" />}
                    </>
                  ) : (
                    <>
                      <Bot size={16} />
                      FinançasAI
                    </>
                  )}
                </div>
                <div className="message-time">
                  {new Date(message.criado_em).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              <div className="message-content">
                {message.conteudo}
                {message.transacao_criada && (
                  <div className="transaction-badge">
                    💰 Transação criada
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="chat-history">
      {viewMode === 'list' ? renderSessionList() : renderSessionDetail()}
    </div>
  );
};

export default ChatHistory; 