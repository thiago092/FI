import React, { useState, useEffect } from 'react';
import { Bot, MessageCircle, Send, User, Lightbulb, Calculator, Target, Loader2, Check, Edit2, Trash2 } from 'lucide-react';

interface Categoria {
  id: number;
  nome: string;
  cor: string;
  icone: string;
}

interface AssistentePlanejamentoProps {
  categorias: Categoria[];
  onPlanejamentoCriado: (planejamento: any) => void;
  onFechar: () => void;
}

interface Pergunta {
  id: number;
  tipo: 'input' | 'number' | 'select' | 'multiple';
  texto: string;
  opcoes?: string[];
  campo: string;
  validacao?: (value: any) => boolean;
  placeholder?: string;
}

interface RespostaUsuario {
  [key: string]: any;
}

const perguntas: Pergunta[] = [
  {
    id: 1,
    tipo: 'input',
    texto: 'Olá! Sou seu assistente de planejamento financeiro. Para começar, como você gostaria de chamar este planejamento?',
    campo: 'nome',
    placeholder: 'Ex: Planejamento Familiar Janeiro 2024'
  },
  {
    id: 2,
    tipo: 'number',
    texto: 'Qual é a sua renda mensal total? (soma de todos os salários da família)',
    campo: 'renda_total',
    placeholder: '0,00'
  },
  {
    id: 3,
    tipo: 'number',
    texto: 'Quantas pessoas moram na sua casa?',
    campo: 'pessoas_casa',
    placeholder: '1'
  },
  {
    id: 4,
    tipo: 'select',
    texto: 'Qual é o seu tipo de moradia?',
    campo: 'tipo_moradia',
    opcoes: ['Casa própria quitada', 'Casa própria financiada', 'Casa alugada', 'Mora com família']
  },
  {
    id: 5,
    tipo: 'number',
    texto: 'Quanto você gasta mensalmente com moradia? (aluguel, financiamento, condomínio, IPTU)',
    campo: 'gasto_moradia',
    placeholder: '0,00'
  },
  {
    id: 6,
    tipo: 'number',
    texto: 'Quanto você gasta por mês com alimentação? (supermercado, feira, refeições)',
    campo: 'gasto_alimentacao',
    placeholder: '0,00'
  },
  {
    id: 7,
    tipo: 'select',
    texto: 'Você tem filhos em idade escolar?',
    campo: 'tem_filhos_escola',
    opcoes: ['Não', 'Sim, escola pública', 'Sim, escola particular']
  },
  {
    id: 8,
    tipo: 'number',
    texto: 'Quanto você gasta mensalmente com educação? (escola, cursos, material)',
    campo: 'gasto_educacao',
    placeholder: '0,00'
  },
  {
    id: 9,
    tipo: 'number',
    texto: 'Qual é o seu gasto mensal com saúde? (plano de saúde, medicamentos, consultas)',
    campo: 'gasto_saude',
    placeholder: '0,00'
  },
  {
    id: 10,
    tipo: 'number',
    texto: 'Quanto você gasta por mês com transporte? (combustível, transporte público, manutenção)',
    campo: 'gasto_transporte',
    placeholder: '0,00'
  },
  {
    id: 11,
    tipo: 'select',
    texto: 'Você costuma fazer atividades de lazer?',
    campo: 'frequencia_lazer',
    opcoes: ['Raramente', 'Ocasionalmente', 'Regularmente', 'Frequentemente']
  },
  {
    id: 12,
    tipo: 'number',
    texto: 'Quanto você gostaria de destinar para lazer mensalmente?',
    campo: 'gasto_lazer',
    placeholder: '0,00'
  },
  {
    id: 13,
    tipo: 'select',
    texto: 'Você tem o hábito de guardar dinheiro?',
    campo: 'habito_poupanca',
    opcoes: ['Nunca consigo guardar', 'Às vezes', 'Regularmente', 'Sempre']
  },
  {
    id: 14,
    tipo: 'number',
    texto: 'Quanto você gasta por mês com seguros? (carro, vida, residencial)',
    campo: 'gasto_seguros',
    placeholder: '0,00'
  },
  {
    id: 15,
    tipo: 'number',
    texto: 'Você tem financiamentos ou empréstimos? Quanto paga por mês?',
    campo: 'gasto_financiamentos',
    placeholder: '0,00'
  },
  {
    id: 16,
    tipo: 'number',
    texto: 'Quanto gasta com plano de saúde familiar por mês?',
    campo: 'gasto_plano_saude',
    placeholder: '0,00'
  },
  {
    id: 17,
    tipo: 'number',
    texto: 'Quanto você gostaria de conseguir economizar por mês?',
    campo: 'meta_economia',
    placeholder: '0,00'
  }
];

export default function AssistentePlanejamento({ categorias, onPlanejamentoCriado, onFechar }: AssistentePlanejamentoProps) {
  const [perguntaAtual, setPerguntaAtual] = useState(0);
  const [respostas, setRespostas] = useState<RespostaUsuario>({});
  const [respostaAtual, setRespostaAtual] = useState('');
  const [conversaCompleta, setConversaCompleta] = useState(false);
  const [processandoPlanejamento, setProcessandoPlanejamento] = useState(false);
  const [planejamentoGerado, setPlanejamentoGerado] = useState<any>(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [planejamentoEditavel, setPlanejamentoEditavel] = useState<any>(null);
  
  const pergunta = perguntas[perguntaAtual];

  const handleProximaPergunta = () => {
    if (!respostaAtual && pergunta.tipo !== 'number') return;
    if (pergunta.tipo === 'number' && (!respostaAtual || isNaN(Number(respostaAtual)))) return;

    const novasRespostas = {
      ...respostas,
      [pergunta.campo]: pergunta.tipo === 'number' ? Number(respostaAtual) : respostaAtual
    };
    
    setRespostas(novasRespostas);
    setRespostaAtual('');

    if (perguntaAtual < perguntas.length - 1) {
      setPerguntaAtual(perguntaAtual + 1);
    } else {
      setConversaCompleta(true);
      gerarPlanejamento(novasRespostas);
    }
  };

  const gerarPlanejamento = async (respostasFinais: RespostaUsuario) => {
    setProcessandoPlanejamento(true);
    
    try {
      // Preparar dados para enviar à API inteligente
      const dadosUsuario = {
        nome: respostasFinais.nome,
        renda_total: respostasFinais.renda_total || 0,
        pessoas_casa: respostasFinais.pessoas_casa || 1,
        tipo_moradia: respostasFinais.tipo_moradia,
        gasto_moradia: respostasFinais.gasto_moradia || 0,
        gasto_alimentacao: respostasFinais.gasto_alimentacao || 0,
        gasto_transporte: respostasFinais.gasto_transporte || 0,
        gasto_saude: respostasFinais.gasto_saude || 0,
        gasto_educacao: respostasFinais.gasto_educacao || 0,
        gasto_lazer: respostasFinais.gasto_lazer || 0,
        gasto_seguros: respostasFinais.gasto_seguros || 0,
        gasto_financiamentos: respostasFinais.gasto_financiamentos || 0,
        gasto_plano_saude: respostasFinais.gasto_plano_saude || 0,
        tem_filhos_escola: respostasFinais.tem_filhos_escola,
        habito_poupanca: respostasFinais.habito_poupanca,
        meta_economia: respostasFinais.meta_economia || 0,
        frequencia_lazer: respostasFinais.frequencia_lazer
      };

      // Chamar API do assistente inteligente
      const API_BASE_URL = 'https://financeiro-amd5aneeemb2c9bv.canadacentral-01.azurewebsites.net';
      const response = await fetch(`${API_BASE_URL}/api/assistente-planejamento/gerar-planejamento`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(dadosUsuario)
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar planejamento inteligente');
      }

      const resultado = await response.json();
      
      // Verificar se há situação crítica
      if (resultado.emergencia) {
        setPlanejamentoGerado({
          ...resultado,
          isEmergencia: true
        });
      } else {
        const planejamentoCompleto = {
          ...resultado.planejamento,
          analise_ia: resultado.analise_inteligente,
          metricas: resultado.metricas_saude
        };
        setPlanejamentoGerado(planejamentoCompleto);
        setPlanejamentoEditavel({...planejamentoCompleto}); // Cópia para edição
      }
      
    } catch (error) {
      console.error('Erro no assistente:', error);
      
      // Fallback local em caso de erro
      const agora = new Date();
      setPlanejamentoGerado({
        nome: respostasFinais.nome || `Planejamento ${agora.getMonth() + 1}/${agora.getFullYear()}`,
        descricao: 'Planejamento básico (erro na IA)',
        mes: agora.getMonth() + 1,
        ano: agora.getFullYear(),
        renda_esperada: respostasFinais.renda_total || 0,
        planos_categoria: [],
        erro: 'Não foi possível conectar com o assistente inteligente'
      });
    }
    
    setProcessandoPlanejamento(false);
  };

  const handleEditarPlanejamento = () => {
    setModoEdicao(true);
  };

  const handleSalvarEdicao = () => {
    setPlanejamentoGerado(planejamentoEditavel);
    setModoEdicao(false);
  };

  const handleConfirmarPlanejamento = () => {
    const planejamentoFinal = modoEdicao ? planejamentoEditavel : planejamentoGerado;
    onPlanejamentoCriado(planejamentoFinal);
    onFechar();
  };

  const atualizarValorCategoria = (index: number, novoValor: number) => {
    const novosPlanos = [...planejamentoEditavel.planos_categoria];
    novosPlanos[index] = {
      ...novosPlanos[index],
      valor_planejado: novoValor
    };
    
    setPlanejamentoEditavel({
      ...planejamentoEditavel,
      planos_categoria: novosPlanos
    });
  };

  const removerCategoriaDoPlano = (index: number) => {
    const novosPlanos = planejamentoEditavel.planos_categoria.filter((_: any, i: number) => i !== index);
    setPlanejamentoEditavel({
      ...planejamentoEditavel,
      planos_categoria: novosPlanos
    });
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Assistente de Planejamento</h2>
                <p className="text-blue-100">Vou te ajudar a criar um planejamento inteligente</p>
              </div>
            </div>
            <button
              onClick={onFechar}
              className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center hover:bg-opacity-30 transition-colors"
            >
              ✕
            </button>
          </div>
          
          {!conversaCompleta && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-blue-100 mb-2">
                <span>Progresso</span>
                <span>{perguntaAtual + 1} de {perguntas.length}</span>
              </div>
              <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((perguntaAtual + 1) / perguntas.length) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {!conversaCompleta ? (
            <div className="space-y-6">
              {/* Pergunta do Bot */}
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl rounded-tl-none max-w-sm">
                  <p className="text-slate-800">{pergunta.texto}</p>
                </div>
              </div>

              {/* Campo de Resposta */}
              <div className="flex items-end space-x-3">
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1">
                  {pergunta.tipo === 'input' && (
                    <input
                      type="text"
                      value={respostaAtual}
                      onChange={(e) => setRespostaAtual(e.target.value)}
                      placeholder={pergunta.placeholder}
                      className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => e.key === 'Enter' && handleProximaPergunta()}
                    />
                  )}
                  
                  {pergunta.tipo === 'number' && (
                    <input
                      type="number"
                      value={respostaAtual}
                      onChange={(e) => setRespostaAtual(e.target.value)}
                      placeholder={pergunta.placeholder}
                      className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => e.key === 'Enter' && handleProximaPergunta()}
                    />
                  )}
                  
                  {pergunta.tipo === 'select' && (
                    <select
                      value={respostaAtual}
                      onChange={(e) => setRespostaAtual(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione uma opção...</option>
                      {pergunta.opcoes?.map((opcao) => (
                        <option key={opcao} value={opcao}>{opcao}</option>
                      ))}
                    </select>
                  )}
                </div>
                
                <button
                  onClick={handleProximaPergunta}
                  disabled={!respostaAtual || (pergunta.tipo === 'number' && isNaN(Number(respostaAtual)))}
                  className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : processandoPlanejamento ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Criando seu planejamento...</h3>
              <p className="text-slate-600 text-center">
                Estou analisando suas respostas e criando um planejamento personalizado para você
              </p>
            </div>
          ) : planejamentoGerado && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">
                      {modoEdicao ? 'Editar Planejamento' : 'Planejamento Criado!'}
                    </h3>
                    <p className="text-slate-600">
                      {modoEdicao ? 'Ajuste os valores conforme necessário' : 'Baseado no seu perfil, aqui está sua sugestão'}
                    </p>
                  </div>
                </div>
                
                {!modoEdicao && (
                  <button
                    onClick={handleEditarPlanejamento}
                    className="flex items-center space-x-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Editar</span>
                  </button>
                )}
              </div>

              {/* Informações Básicas */}
              <div className="bg-slate-50 p-6 rounded-xl">
                <h4 className="font-semibold text-slate-900 mb-2">
                  {modoEdicao ? planejamentoEditavel.nome : planejamentoGerado.nome}
                </h4>
                <p className="text-sm text-slate-600 mb-4">
                  {modoEdicao ? planejamentoEditavel.descricao : planejamentoGerado.descricao}
                </p>
                
                <div className="flex justify-between items-center mb-4">
                  <span className="font-medium text-slate-700">Renda Esperada:</span>
                  <span className="font-bold text-green-600">
                    {formatarMoeda(modoEdicao ? planejamentoEditavel.renda_esperada : planejamentoGerado.renda_esperada)}
                  </span>
                </div>

                {/* Lista de Categorias - Editável ou Visualização */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-slate-900">Distribuição por Categoria:</h5>
                    {modoEdicao && (
                      <span className="text-sm text-slate-600">
                        Total: {formatarMoeda(planejamentoEditavel.planos_categoria.reduce((total: number, plano: any) => total + plano.valor_planejado, 0))}
                      </span>
                    )}
                  </div>
                  
                  {(modoEdicao ? planejamentoEditavel : planejamentoGerado).planos_categoria.map((plano: any, index: number) => {
                    const categoria = categorias.find(c => c.id === plano.categoria_id);
                    if (!categoria) return null;
                    
                    return (
                      <div key={index} className={`py-3 px-4 rounded-lg border ${modoEdicao ? 'bg-white border-slate-300' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs"
                              style={{ backgroundColor: categoria.cor }}
                            >
                              {categoria.icone}
                            </div>
                            <div>
                              <span className="text-slate-700 font-medium">{categoria.nome}</span>
                              {plano.observacoes && (
                                <p className="text-xs text-slate-500 mt-1">{plano.observacoes}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            {modoEdicao ? (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-slate-600">R$</span>
                                <input
                                  type="number"
                                  value={plano.valor_planejado}
                                  onChange={(e) => atualizarValorCategoria(index, Number(e.target.value))}
                                  className="w-24 px-2 py-1 border border-slate-300 rounded text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  min="0"
                                  step="0.01"
                                />
                                <button
                                  onClick={() => removerCategoriaDoPlano(index)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title="Remover categoria"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="font-medium text-slate-900">
                                {formatarMoeda(plano.valor_planejado)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-700">Total Planejado:</span>
                    <span className="font-bold text-slate-900">
                      {formatarMoeda((modoEdicao ? planejamentoEditavel : planejamentoGerado).planos_categoria.reduce((total: number, plano: any) => total + plano.valor_planejado, 0))}
                    </span>
                  </div>
                  
                  {/* Mostrar sobra/déficit */}
                  {(() => {
                    const renda = modoEdicao ? planejamentoEditavel.renda_esperada : planejamentoGerado.renda_esperada;
                    const total = (modoEdicao ? planejamentoEditavel : planejamentoGerado).planos_categoria.reduce((sum: number, plano: any) => sum + plano.valor_planejado, 0);
                    const sobra = renda - total;
                    
                    return (
                      <div className={`flex justify-between items-center mt-2 text-sm ${sobra >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <span>{sobra >= 0 ? 'Sobra mensal:' : 'Déficit:'}</span>
                        <span className="font-medium">{formatarMoeda(Math.abs(sobra))}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Análise da IA (apenas na visualização) */}
              {!modoEdicao && planejamentoGerado.analise_ia && (
                <div className="bg-blue-50 p-4 rounded-xl">
                  <div className="flex items-start space-x-3">
                    <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h5 className="font-medium text-blue-900 mb-2">Análise do Assistente</h5>
                      {planejamentoGerado.analise_ia.analise_situacao && (
                        <p className="text-blue-800 text-sm mb-2">
                          {planejamentoGerado.analise_ia.analise_situacao}
                        </p>
                      )}
                      
                      {planejamentoGerado.analise_ia.dicas_personalizadas && planejamentoGerado.analise_ia.dicas_personalizadas.length > 0 && (
                        <div className="mt-3">
                          <h6 className="text-sm font-medium text-blue-900 mb-1">Dicas personalizadas:</h6>
                          <ul className="text-xs text-blue-700 space-y-1">
                            {planejamentoGerado.analise_ia.dicas_personalizadas.map((dica: string, index: number) => (
                              <li key={index}>• {dica}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex space-x-3">
                {modoEdicao ? (
                  <>
                    <button
                      onClick={() => setModoEdicao(false)}
                      className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-colors"
                    >
                      Cancelar Edição
                    </button>
                    <button
                      onClick={handleSalvarEdicao}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium transition-colors"
                    >
                      Salvar Alterações
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={onFechar}
                      className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmarPlanejamento}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors flex items-center justify-center space-x-2"
                    >
                      <span>Criar Planejamento</span>
                      <Target className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 