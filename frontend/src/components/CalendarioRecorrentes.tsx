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
    
    // Usar a data de próximo vencimento como ponto de partida
    let dataAtual = new Date(transacao.proximo_vencimento + 'T00:00:00');
    
    console.log('📅 Data inicial (próximo vencimento):', dataAtual.toISOString().split('T')[0]);
    
    // CORREÇÃO: Se a data atual é depois do período, retroceder até o período
    // mas NUNCA antes da data de início
    if (dataAtual > mesFim) {
      let contador = 0;
      while (dataAtual > mesFim && dataAtual >= dataInicio && contador < 100) {
        contador++;
        const dataAnterior = calcularDataAnterior(dataAtual, transacao.frequencia);
        if (dataAnterior >= dataInicio) {
          dataAtual = dataAnterior;
        } else {
          break; // Não retroceder antes da data de início
        }
      }
    }
    
    // Se a data atual é antes do período, avançar até o período
    if (dataAtual < mesInicio) {
      let contador = 0;
      while (dataAtual < mesInicio && contador < 100) {
        contador++;
        dataAtual = calcularProximaData(dataAtual, transacao.frequencia);
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50">
      {/* Header do Calendário */}
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Calendário de Recorrências
            </h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navegarMes('anterior')}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors touch-manipulation"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <h3 className="text-sm font-medium text-slate-700 px-3 capitalize">
              {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            
            <button
              onClick={() => navegarMes('proximo')}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors touch-manipulation"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendário */}
      <div className="p-4 sm:p-6">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {diasSemana.map(dia => (
            <div key={dia} className="p-2 text-center text-xs font-medium text-slate-500">
              {dia}
            </div>
          ))}
        </div>

        {/* Grade do calendário */}
        <div className="grid grid-cols-7 gap-1">
          {diasCalendario.map((dia, index) => (
            <div
              key={index}
              onClick={() => abrirDetalhes(dia)}
              className={`
                min-h-[80px] p-1 border border-slate-200 rounded-lg transition-all duration-200
                ${dia.isCurrentMonth ? 'bg-white' : 'bg-slate-50'}
                ${dia.isToday ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                ${dia.transacoes.length > 0 ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : 'cursor-default'}
              `}
            >
              {/* Número do dia */}
              <div className={`text-xs font-medium mb-1 ${
                dia.isToday 
                  ? 'text-blue-600' 
                  : dia.isCurrentMonth 
                    ? 'text-slate-900' 
                    : 'text-slate-400'
              }`}>
                {dia.dia}
              </div>

              {/* Transações do dia */}
              {dia.transacoes.length > 0 && (
                <div className="space-y-1">
                  {/* Resumo do saldo */}
                  <div className={`text-xs font-semibold px-1 py-0.5 rounded text-center ${
                    dia.saldo > 0 
                      ? 'bg-green-100 text-green-700'
                      : dia.saldo < 0 
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-700'
                  }`}>
                    {formatCurrency(Math.abs(dia.saldo))}
                  </div>

                  {/* Indicadores de transações */}
                  <div className="space-y-0.5">
                    {dia.transacoes.slice(0, 2).map((t, i) => (
                      <div
                        key={i}
                        className={`text-xs px-1 py-0.5 rounded truncate ${
                          t.transacao.tipo === 'ENTRADA'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                        title={`${t.transacao.descricao} - ${formatCurrency(t.valor)}`}
                      >
                        {t.transacao.descricao}
                      </div>
                    ))}
                    
                    {dia.transacoes.length > 2 && (
                      <div className="text-xs text-slate-500 text-center">
                        +{dia.transacoes.length - 2} mais
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
            <span className="text-slate-600">Entradas</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
            <span className="text-slate-600">Saídas</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span className="text-slate-600">Hoje</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-600">💡 Clique em um dia com transações para ver detalhes</span>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes do Dia */}
      {showModal && diaDetalhes && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-2xl bg-white max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                📅 {formatDate(diaDetalhes.data)}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumo do dia */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Entradas</p>
                <p className="text-lg font-bold text-green-700">
                  {formatCurrency(diaDetalhes.totalEntradas)}
                </p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600 font-medium">Saídas</p>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(diaDetalhes.totalSaidas)}
                </p>
              </div>
              <div className={`text-center p-3 rounded-lg ${
                diaDetalhes.saldo >= 0 ? 'bg-blue-50' : 'bg-orange-50'
              }`}>
                <p className={`text-sm font-medium ${
                  diaDetalhes.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'
                }`}>Saldo</p>
                <p className={`text-lg font-bold ${
                  diaDetalhes.saldo >= 0 ? 'text-blue-700' : 'text-orange-700'
                }`}>
                  {formatCurrency(diaDetalhes.saldo)}
                </p>
              </div>
            </div>

            {/* Lista de transações */}
            <div className="space-y-3">
              <h4 className="font-medium text-slate-900 mb-3">
                Transações do dia ({diaDetalhes.transacoes.length})
              </h4>
              {diaDetalhes.transacoes.map((transacaoCalendario, index) => {
                const t = transacaoCalendario.transacao;
                return (
                  <div key={index} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"
                          style={{ backgroundColor: t.categoria_cor }}
                        >
                                                                                {t.icone_personalizado
                            ? renderIconePersonalizado(t.icone_personalizado, 16)
                            : t.categoria_icone}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{t.descricao}</p>
                          <div className="flex items-center space-x-2 text-sm text-slate-500">
                            <span>{t.categoria_nome}</span>
                            <span>•</span>
                            <span>{t.forma_pagamento}</span>
                            <span>•</span>
                            <span>{t.frequencia}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-semibold ${
                          t.tipo === 'ENTRADA' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {t.tipo === 'ENTRADA' ? '+' : '-'}{formatCurrency(t.valor)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarioRecorrentes; 