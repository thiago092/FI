import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageCircle, TrendingUp, History, Plus, Camera, X } from 'lucide-react';
import ChatHistory from './ChatHistory';
import './ChatIA.css';
import api from '../services/api'; // Importar o api axios configurado

interface Mensagem {
  id: number;
  tipo: 'usuario' | 'bot';
  conteudo: string;
  timestamp: Date;
  transacao_criada?: boolean;
  via_imagem?: boolean;
}

interface ChatStats {
  total_transacoes: number;
  total_transacoes_chat: number;
  percentual_via_chat: number;
  economia_tempo: string;
  total_sessoes?: number;
  total_mensagens?: number;
  ultima_conversa?: string;
}

const ChatIA: React.FC = () => {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const examples = [
    "Gastei R$ 25 no almoço hoje",
    "Recebi R$ 3000 de salário",
    "Paguei R$ 150 de conta de luz",
    "Comprei roupas por R$ 200"
  ];

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const message = inputMessage.trim();
    if (!message || loading) return;

    // Adicionar mensagem do usuário
    const novaMensagem: Mensagem = {
      id: Date.now(),
      tipo: 'usuario',
      conteudo: message,
      timestamp: new Date()
    };

    setMensagens(prev => [...prev, novaMensagem]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await api.post('/chat/processar', {
        mensagem: message,
        sessao_id: currentSessionId,
        via_voz: false
      });

      const data = response.data;

      if (response.status === 200) {
        // Atualizar ID da sessão se for nova
        if (data.sessao_id && data.sessao_id !== currentSessionId) {
          setCurrentSessionId(data.sessao_id);
        }

        // Adicionar resposta do bot
        const respostaBotMensagem: Mensagem = {
          id: Date.now() + 1,
          tipo: 'bot',
          conteudo: data.resposta,
          timestamp: new Date(),
          transacao_criada: data.transacao_criada
        };

        setMensagens(prev => [...prev, respostaBotMensagem]);
        
        // Atualizar estatísticas se transação foi criada
        if (data.transacao_criada) {
          // Recarregar estatísticas inline
          try {
            const statsResponse = await api.get('/chat/estatisticas');
            if (statsResponse.status === 200) {
              setStats(statsResponse.data);
            }
          } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
          }
        }
      } else {
        throw new Error(data.detail || 'Erro no servidor');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      
      const erroMensagem: Mensagem = {
        id: Date.now() + 1,
        tipo: 'bot',
        conteudo: '❌ Desculpe, ocorreu um erro. Tente novamente.',
        timestamp: new Date()
      };
      
      setMensagens(prev => [...prev, erroMensagem]);
    } finally {
      setLoading(false);
    }
  }, [inputMessage, loading, currentSessionId]);

  useEffect(() => {
    // Carregar estatísticas iniciais
    const carregarEstatisticasIniciais = async () => {
      try {
        const response = await api.get('/chat/estatisticas');
        if (response.status === 200) {
          setStats(response.data);
        }
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      }
    };
    
    carregarEstatisticasIniciais();
    obterSessaoAtiva();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  const obterSessaoAtiva = async () => {
    try {
      
      const response = await api.get('/chat/sessao-ativa');
      if (response.status === 200) {
        const sessao = response.data;
        
        setCurrentSessionId(sessao.id);
        // Carregar mensagens da sessão ativa se existir
        if (sessao.total_mensagens > 0) {
          
          await carregarMensagensSessao(sessao.id);
        } else {
          
        }
      } else {
        console.error('❌ Erro ao carregar sessão ativa:', response.status);
      }
    } catch (error) {
      console.error('❌ Erro ao obter sessão ativa:', error);
    }
  };

  const carregarMensagensSessao = async (sessionId: number) => {
    try {

      const response = await api.get(`/chat/sessao/${sessionId}`);
      if (response.status === 200) {
        const sessao = response.data;
        
        const mensagensFormatadas = sessao.mensagens.map((msg: any, index: number) => ({
          id: msg.id || index,
          tipo: msg.tipo.toLowerCase(),
          conteudo: msg.conteudo,
          timestamp: new Date(msg.criado_em),
          transacao_criada: msg.transacao_criada
        }));
        setMensagens(mensagensFormatadas);
        
      } else {
        console.error('❌ Erro ao carregar mensagens:', response.status);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar mensagens da sessão:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleExampleClick = (example: string) => {
    setInputMessage(example);
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione apenas arquivos de imagem.');
        return;
      }

      // Validar tamanho (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Arquivo muito grande. Máximo 10MB.');
        return;
      }

      setSelectedImage(file);
      
      // Criar preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!selectedImage) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedImage);

      

      const response = await api.post('/chat/processar-imagem', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.status === 200) {
        const data = response.data;
        
        // Adicionar mensagem do usuário (simulada)
        const novaMensagemUsuario: Mensagem = {
          id: Date.now(),
          tipo: 'usuario',
          conteudo: `📷 Imagem enviada: ${selectedImage.name}`,
          timestamp: new Date(),
          via_imagem: true
        };

        // Adicionar resposta do bot
        const novaMensagemBot: Mensagem = {
          id: Date.now() + 1,
          tipo: 'bot',
          conteudo: data.resposta,
          timestamp: new Date(),
          transacao_criada: data.transacao_criada
        };

        setMensagens(prev => [...prev, novaMensagemUsuario, novaMensagemBot]);

        // Atualizar estatísticas se transação foi criada
        if (data.transacao_criada) {
          try {
            const statsResponse = await api.get('/chat/estatisticas');
            if (statsResponse.status === 200) {
              setStats(statsResponse.data);
            }
          } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
          }
        }

        // Limpar imagem selecionada
        clearSelectedImage();

      } else {
        throw new Error(response.data?.message || 'Erro no servidor');
      }

    } catch (error: any) {
      console.error('Erro ao processar imagem:', error);
      
      const erroMensagem: Mensagem = {
        id: Date.now() + 1,
        tipo: 'bot',
        conteudo: '❌ Erro ao processar imagem. Tente novamente com uma imagem mais clara.',
        timestamp: new Date()
      };
      
      setMensagens(prev => [...prev, erroMensagem]);
    } finally {
      setLoading(false);
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const criarNovaSessao = async () => {
    try {
      const response = await api.post('/chat/nova-sessao', {});
      
      if (response.status === 200) {
        const novaSessao = response.data;
        setCurrentSessionId(novaSessao.id);
        setMensagens([]);
        setShowHistory(false);
        setInputMessage('');
      }
    } catch (error) {
      console.error('Erro ao criar nova sessão:', error);
    }
  };

  const selecionarSessao = (sessionId: number) => {
    carregarMensagensSessao(sessionId);
    setCurrentSessionId(sessionId);
    setShowHistory(false);
    setInputMessage('');
  };

  if (showHistory) {
    return (
      <div className="chat-ia-container">
        <ChatHistory 
          onSelectSession={selecionarSessao}
          onNewSession={criarNovaSessao}
        />
      </div>
    );
  }

  return (
    <div className="chat-ia-container">
      <div className="chat-header">
        <div className="header-content">
          <MessageCircle size={24} />
          <div>
            <h2>FinançasAI</h2>
            <p>Assistente inteligente para suas finanças</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button
            className="btn-header"
            onClick={() => setShowHistory(true)}
            title="Ver histórico"
          >
            <History size={18} />
            Histórico
          </button>
          <button
            className="btn-header"
            onClick={criarNovaSessao}
            title="Nova conversa"
          >
            <Plus size={18} />
            Nova
          </button>
        </div>
      </div>

      {stats && (
        <div className="chat-stats">
          <div className="stats-grid">
            <div className="stat-item">
              <TrendingUp size={20} />
              <div>
                <span className="stat-number">{stats.total_transacoes_chat}</span>
                <span className="stat-label">Transações criadas</span>
              </div>
            </div>
            <div className="stat-item">
              <MessageCircle size={20} />
              <div>
                <span className="stat-number">{stats.percentual_via_chat}%</span>
                <span className="stat-label">Via chat</span>
              </div>
            </div>
            {stats.total_sessoes && (
              <div className="stat-item">
                <History size={20} />
                <div>
                  <span className="stat-number">{stats.total_sessoes}</span>
                  <span className="stat-label">Conversas</span>
                </div>
              </div>
            )}
            <div className="stat-item">
              <span className="stat-emoji">⏱️</span>
              <div>
                <span className="stat-number">{stats.economia_tempo}</span>
                <span className="stat-label">Economia de tempo</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="chat-messages">
        {mensagens.length === 0 ? (
          <div className="welcome-message">
            <div className="welcome-content">
              <MessageCircle size={48} />
              <h3>Olá! Como posso ajudar você hoje?</h3>
              <p>Digite sobre suas transações financeiras e eu as organizarei para você.</p>
              
              <div className="examples">
                <h4>Experimente dizer:</h4>
                <div className="examples-list">
                  {examples.map((example, index) => (
                    <button
                      key={index}
                      className="example-button"
                      onClick={() => handleExampleClick(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {mensagens.map((mensagem) => (
              <div key={mensagem.id} className={`message ${mensagem.tipo}`}>
                <div className="message-content">
                  {mensagem.tipo === 'usuario' && (
                    <div className="message-header">
                      <span>Você</span>
                      {mensagem.via_imagem && (
                        <span className="image-badge">
                          <Camera size={12} />
                          via imagem
                        </span>
                      )}
                    </div>
                  )}
                  {mensagem.tipo === 'bot' && (
                    <div className="message-header">
                      <span>FinançasAI</span>
                      {mensagem.transacao_criada && (
                        <span className="transaction-badge">
                          💰 Transação criada
                        </span>
                      )}
                    </div>
                  )}
                  <div 
                    className="message-text"
                    dangerouslySetInnerHTML={{ 
                      __html: mensagem.conteudo.replace(/\n/g, '<br/>') 
                    }}
                  />
                  <div className="message-time">
                    {mensagem.timestamp.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="chat-input-form">
        {/* Preview da imagem selecionada */}
        {imagePreview && (
          <div className="image-preview-container">
            <div className="image-preview">
              <img src={imagePreview} alt="Preview" className="preview-image" />
              <button
                type="button"
                onClick={clearSelectedImage}
                className="remove-image-btn"
                title="Remover imagem"
              >
                <X size={16} />
              </button>
            </div>
            <div className="image-actions">
              <button
                type="button"
                onClick={handleImageUpload}
                disabled={loading}
                className="upload-image-btn"
              >
                {loading ? 'Processando...' : 'Processar Imagem'}
              </button>
            </div>
          </div>
        )}

        <div className="input-container">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={loading}
          />

          {/* Input de arquivo oculto */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {/* Botão para anexar imagem */}
          <button
            type="button"
            onClick={openFileSelector}
            disabled={loading}
            className="camera-button"
            title="Anexar imagem de recibo/cupom"
          >
            <Camera size={20} />
          </button>
          
          <button 
            type="submit" 
            disabled={loading || !inputMessage.trim()}
            className="send-button"
          >
            <Send size={20} />
          </button>
        </div>
        
        {loading && (
          <div className="loading-indicator">
            <div className="loading-spinner"></div>
            FinançasAI está pensando...
          </div>
        )}
      </form>
    </div>
  );
};

export default ChatIA;