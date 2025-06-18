import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { TransacaoRecorrenteListResponse } from '../types/transacaoRecorrente';
import { getSvgLogo } from '../data/svgLogos';
import { getIconeGenerico } from '../data/iconesGenericos';
import SvgLogoIcon from './SvgLogoIcon';
import IconeGenericoComponent from './IconeGenericoComponent';

interface CalendarioRecorrentesProps {
  transacoes: TransacaoRecorrenteListResponse[];
}

interface TransacaoCalendario {
  transacao: TransacaoRecorrenteListResponse;
  data: Date;
  valor: number;
}

interface DiaCalendario {
  dia: number;
  data: Date;
  transacoes: TransacaoCalendario[];
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const CalendarioRecorrentes: React.FC<CalendarioRecorrentesProps> = ({ transacoes }) => {
  const [mesAtual, setMesAtual] = useState(new Date());
  const [diasCalendario, setDiasCalendario] = useState<DiaCalendario[]>([]);
  const [diaDetalhes, setDiaDetalhes] = useState<DiaCalendario | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Helper para renderizar ícone personalizado
  const renderIconePersonalizado = (iconePersonalizado: string | undefined, size: number = 16) => {
    if (!iconePersonalizado) return null;
    
    // Verificar se é um SVG logo real
    const svgLogo = getSvgLogo(iconePersonalizado);
    if (svgLogo) {
      return <SvgLogoIcon logoId={iconePersonalizado} size={size} />;
    }
    
    // Verificar se é um ícone genérico
    const iconeGenerico = getIconeGenerico(iconePersonalizado);
    if (iconeGenerico) {
      return <IconeGenericoComponent iconeId={iconePersonalizado} size={size} />;
    }
    
    return null;
  };

  // Calcular próximas ocorrências de uma transação recorrente
  const calcularProximasOcorrencias = (
    transacao: TransacaoRecorrenteListResponse,
    mesInicio: Date,
    mesFim: Date
  ): Date[] => {
    const ocorrencias: Date[] = [];
    
    // Se a transação não está ativa, não mostrar
    if (!transacao.ativa) return ocorrencias;
    
    // CORREÇÃO: Verificar se temos data_inicio para não calcular antes dela
    if (!transacao.data_inicio) {
      console.log('⚠️ Transação sem data de início:', transacao.descricao);
      return ocorrencias;
    }
    
    const dataInicio = new Date(transacao.data_inicio + 'T00:00:00');
    const dataFim = transacao.data_fim ? new Date(transacao.data_fim + 'T00:00:00') : null;
    
    // Se a transação ainda não começou no período, não mostrar
    if (dataInicio > mesFim) {
      return ocorrencias;
    }
    
    // Se a transação já terminou antes do período, não mostrar
    if (dataFim && dataFim < mesInicio) {
      return ocorrencias;
    }
    
    if (!transacao.proximo_vencimento) {
      console.log('⚠️ Transação sem próximo vencimento:', transacao.descricao);
      return ocorrencias;
    }
    
    console.log('🔄 Calculando recorrências para:', transacao.descricao, {
      frequencia: transacao.frequencia,
      proximo_vencimento: transacao.proximo_vencimento,
      periodo: { inicio: mesInicio.toISOString().split('T')[0], fim: mesFim.toISOString().split('T')[0] }
    });
    
    // CORREÇÃO: Para o calendário, sempre começar da data_inicio se ela estiver no período
    // ou próxima a ele, em vez de usar proximo_vencimento
    let dataAtual: Date;
    
    if (dataInicio >= mesInicio && dataInicio <= mesFim) {
      // Se data_inicio está no período, começar dela
      dataAtual = new Date(dataInicio);
      console.log('📅 Usando data_inicio (está no período):', dataAtual.toISOString().split('T')[0]);
    } else if (dataInicio < mesInicio) {
      // Se data_inicio é antes do período, avançar até o período
      dataAtual = new Date(dataInicio);
      let contador = 0;
      while (dataAtual < mesInicio && contador < 100) {
        contador++;
        dataAtual = calcularProximaData(dataAtual, transacao.frequencia);
      }
      console.log('📅 Avançado da data_inicio até o período:', dataAtual.toISOString().split('T')[0]);
    } else {
      // Se data_inicio é depois do período, usar proximo_vencimento
      dataAtual = new Date(transacao.proximo_vencimento + 'T00:00:00');
      console.log('📅 Usando próximo vencimento (data_inicio é futura):', dataAtual.toISOString().split('T')[0]);
      
      // Retroceder até o período se necessário, mas não antes da data_inicio
      if (dataAtual > mesFim) {
        let contador = 0;
        while (dataAtual > mesFim && dataAtual >= dataInicio && contador < 100) {
          contador++;
          const dataAnterior = calcularDataAnterior(dataAtual, transacao.frequencia);
          if (dataAnterior >= dataInicio) {
            dataAtual = dataAnterior;
          } else {
            break;
          }
        }
      }
    }
    
    // Gerar todas as ocorrências no período
    let contador = 0; // Proteção contra loop infinito
    while (dataAtual <= mesFim && contador < 100) {
      contador++;
      
      // Verificar se está no período E não é antes da data de início E não é depois da data fim
      if (dataAtual >= mesInicio && dataAtual <= mesFim && 
          dataAtual >= dataInicio && 
          (!dataFim || dataAtual <= dataFim)) {
        ocorrencias.push(new Date(dataAtual));
        console.log('✅ Adicionada ocorrência:', dataAtual.toISOString().split('T')[0]);
      }
      
      // Calcular próxima data
      dataAtual = calcularProximaData(dataAtual, transacao.frequencia);
      
      // Se passou do período ou da data fim, parar
      if (dataAtual > mesFim || (dataFim && dataAtual > dataFim)) break;
    }
    
    console.log('📊 Total de ocorrências encontradas:', ocorrencias.length);
    return ocorrencias;
  };

  // Função auxiliar para calcular próxima data baseada na frequência
  const calcularProximaData = (dataBase: Date, frequencia: string): Date => {
    const novaData = new Date(dataBase);
    
    switch (frequencia) {
      case 'DIARIA':
        novaData.setDate(novaData.getDate() + 1);
        break;
      case 'SEMANAL':
        novaData.setDate(novaData.getDate() + 7);
        break;
      case 'QUINZENAL':
        novaData.setDate(novaData.getDate() + 15);
        break;
      case 'MENSAL':
        novaData.setMonth(novaData.getMonth() + 1);
        break;
      case 'BIMESTRAL':
        novaData.setMonth(novaData.getMonth() + 2);
        break;
      case 'TRIMESTRAL':
        novaData.setMonth(novaData.getMonth() + 3);
        break;
      case 'SEMESTRAL':
        novaData.setMonth(novaData.getMonth() + 6);
        break;
      case 'ANUAL':
        novaData.setFullYear(novaData.getFullYear() + 1);
        break;
      default:
        novaData.setMonth(novaData.getMonth() + 1);
    }
    
    return novaData;
  };

  // Função auxiliar para calcular data anterior baseada na frequência
  const calcularDataAnterior = (dataBase: Date, frequencia: string): Date => {
    const novaData = new Date(dataBase);
    
    switch (frequencia) {
      case 'DIARIA':
        novaData.setDate(novaData.getDate() - 1);
        break;
      case 'SEMANAL':
        novaData.setDate(novaData.getDate() - 7);
        break;
      case 'QUINZENAL':
        novaData.setDate(novaData.getDate() - 15);
        break;
      case 'MENSAL':
        novaData.setMonth(novaData.getMonth() - 1);
        break;
      case 'BIMESTRAL':
        novaData.setMonth(novaData.getMonth() - 2);
        break;
      case 'TRIMESTRAL':
        novaData.setMonth(novaData.getMonth() - 3);
        break;
      case 'SEMESTRAL':
        novaData.setMonth(novaData.getMonth() - 6);
        break;
      case 'ANUAL':
        novaData.setFullYear(novaData.getFullYear() - 1);
        break;
      default:
        novaData.setMonth(novaData.getMonth() - 1);
    }
    
    return novaData;
  };

  // Gerar calendário do mês
  const gerarCalendario = () => {
    const inicio = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
    const fim = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0);
    
    // Incluir dias do mês anterior e próximo para completar semanas
    const inicioCalendario = new Date(inicio);
    inicioCalendario.setDate(inicio.getDate() - inicio.getDay());
    
    const fimCalendario = new Date(fim);
    fimCalendario.setDate(fim.getDate() + (6 - fim.getDay()));
    
    const dias: DiaCalendario[] = [];
    const hoje = new Date();
    
    // Calcular todas as ocorrências de transações no período
    const todasOcorrencias: TransacaoCalendario[] = [];
    
    transacoes.forEach(transacao => {
      const ocorrencias = calcularProximasOcorrencias(transacao, inicioCalendario, fimCalendario);
      ocorrencias.forEach(data => {
        todasOcorrencias.push({
          transacao,
          data,
          valor: transacao.valor
        });
      });
    });
    
    // Gerar dias do calendário
    const dataAtual = new Date(inicioCalendario);
    while (dataAtual <= fimCalendario) {
      const transacoesDoDia = todasOcorrencias.filter(t => 
        t.data.toDateString() === dataAtual.toDateString()
      );
      
      const totalEntradas = transacoesDoDia
        .filter(t => t.transacao.tipo === 'ENTRADA')
        .reduce((sum, t) => sum + t.valor, 0);
      
      const totalSaidas = transacoesDoDia
        .filter(t => t.transacao.tipo === 'SAIDA')
        .reduce((sum, t) => sum + t.valor, 0);
      
      dias.push({
        dia: dataAtual.getDate(),
        data: new Date(dataAtual),
        transacoes: transacoesDoDia,
        totalEntradas,
        totalSaidas,
        saldo: totalEntradas - totalSaidas,
        isCurrentMonth: dataAtual.getMonth() === mesAtual.getMonth(),
        isToday: dataAtual.toDateString() === hoje.toDateString()
      });
      
      dataAtual.setDate(dataAtual.getDate() + 1);
    }
    
    setDiasCalendario(dias);
  };

  useEffect(() => {
    gerarCalendario();
  }, [mesAtual, transacoes]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const navegarMes = (direcao: 'anterior' | 'proximo') => {
    const novoMes = new Date(mesAtual);
    if (direcao === 'anterior') {
      novoMes.setMonth(novoMes.getMonth() - 1);
    } else {
      novoMes.setMonth(novoMes.getMonth() + 1);
    }
    setMesAtual(novoMes);
  };

  const abrirDetalhes = (dia: DiaCalendario) => {
    if (dia.transacoes.length > 0) {
      setDiaDetalhes(dia);
      setShowModal(true);
    }
  };

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-4">
      {/* Cabeçalho do Calendário */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navegarMes('anterior')}
              className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-gray-400" />
            </button>
            
            <div className="text-center">
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400">Transações Recorrentes</p>
            </div>
            
            <button
              onClick={() => navegarMes('proximo')}
              className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-slate-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Grade do Calendário */}
        <div className="p-4 sm:p-6">
          {/* Cabeçalho dos dias da semana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {diasSemana.map(dia => (
              <div key={dia} className="text-center py-2">
                <span className="text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  {dia}
                </span>
              </div>
            ))}
          </div>

          {/* Dias do calendário */}
          <div className="grid grid-cols-7 gap-1">
            {diasCalendario.map((dia, index) => (
              <div
                key={index}
                onClick={() => abrirDetalhes(dia)}
                className={`
                  relative p-1 sm:p-2 h-20 sm:h-24 border border-slate-100 dark:border-gray-700 rounded-lg cursor-pointer
                  transition-all duration-200 hover:border-slate-300 dark:hover:border-gray-600
                  ${dia.isCurrentMonth 
                    ? 'bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700' 
                    : 'bg-slate-50 dark:bg-gray-900 text-slate-400 dark:text-gray-600'
                  }
                  ${dia.isToday ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''}
                  ${dia.transacoes.length > 0 ? 'hover:shadow-md dark:hover:shadow-xl dark:hover:shadow-gray-900/50' : ''}
                `}
              >
                <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-white mb-1">
                  {dia.dia}
                </div>
                
                {dia.transacoes.length > 0 && (
                  <div className="space-y-0.5">
                    {dia.totalEntradas > 0 && (
                      <div className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1 rounded truncate">
                        +{formatCurrency(dia.totalEntradas)}
                      </div>
                    )}
                    {dia.totalSaidas > 0 && (
                      <div className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1 rounded truncate">
                        -{formatCurrency(dia.totalSaidas)}
                      </div>
                    )}
                    {dia.transacoes.length > 2 && (
                      <div className="text-xs text-slate-500 dark:text-gray-400 px-1">
                        +{dia.transacoes.length - 2} mais
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Legenda */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 rounded-b-2xl">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded"></div>
              <span className="text-slate-600 dark:text-gray-400">Entradas</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded"></div>
              <span className="text-slate-600 dark:text-gray-400">Saídas</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded"></div>
              <span className="text-slate-600 dark:text-gray-400">Hoje</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-600 dark:text-gray-400">💡 Clique em um dia com transações para ver detalhes</span>
            </div>
          </div>
        </div>

        {/* Modal de Detalhes do Dia */}
        {showModal && diaDetalhes && (
          <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="p-4 border-b border-slate-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {formatDate(diaDetalhes.data)}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-gray-400">
                      {diaDetalhes.transacoes.length} transação(ões)
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-1 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                  >
                    <X className="h-5 w-5 text-slate-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 overflow-y-auto max-h-96">
                <div className="space-y-3">
                  {diaDetalhes.transacoes.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${
                          item.transacao.tipo === 'ENTRADA' 
                            ? 'bg-green-100 dark:bg-green-900/30' 
                            : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          {item.transacao.icone_personalizado ? (
                            renderIconePersonalizado(item.transacao.icone_personalizado, 16)
                          ) : (
                            <Calendar className={`h-4 w-4 ${
                              item.transacao.tipo === 'ENTRADA' 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`} />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white text-sm">
                            {item.transacao.descricao}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-gray-400">
                            {item.transacao.categoria_nome} • {item.transacao.forma_pagamento}
                          </div>
                        </div>
                      </div>
                      <div className={`font-semibold ${
                        item.transacao.tipo === 'ENTRADA' 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {item.transacao.tipo === 'ENTRADA' ? '+' : '-'}{formatCurrency(item.valor)}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Resumo do dia */}
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-gray-600">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-gray-400">Entradas</div>
                      <div className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(diaDetalhes.totalEntradas)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-gray-400">Saídas</div>
                      <div className="font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(diaDetalhes.totalSaidas)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-gray-400">Saldo</div>
                      <div className={`font-semibold ${
                        diaDetalhes.saldo >= 0 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-orange-600 dark:text-orange-400'
                      }`}>
                        {formatCurrency(diaDetalhes.saldo)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarioRecorrentes; 