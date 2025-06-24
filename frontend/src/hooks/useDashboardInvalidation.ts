import { useQueryClient } from 'react-query';
import { useCallback } from 'react';

export const useDashboardInvalidation = () => {
  const queryClient = useQueryClient();

  // Invalidar dados dos cards principais - QUERY UNIFICADA + PROJEÇÕES
  const invalidateCards = useCallback(() => {
    console.log('🔄 Invalidando dashboard unificado + projeções...');
    queryClient.invalidateQueries('dashboard-unified'); // CORREÇÃO: Nova query unificada
    
    // FORÇA REFRESH nas projeções que são críticas
    queryClient.refetchQueries('dashboard-unified');
    
    // Também invalidar queries relacionadas
    queryClient.invalidateQueries('categorias');
    queryClient.invalidateQueries('cartoes');
    queryClient.invalidateQueries('contas');
    queryClient.invalidateQueries('transacoes-recorrentes'); // Para projeções futuras
  }, [queryClient]);

  // Invalidar após criação de transação
  const invalidateAfterTransaction = useCallback(() => {
    console.log('💰 Transação detectada - invalidando dashboard...');
    invalidateCards();
  }, [invalidateCards]);

  // Invalidar após modificação de cartão
  const invalidateAfterCardUpdate = useCallback(() => {
    console.log('💳 Cartão modificado - invalidando dashboard...');
    invalidateCards();
  }, [invalidateCards]);

  // Invalidar após modificação de conta
  const invalidateAfterAccountUpdate = useCallback(() => {
    console.log('🏦 Conta modificada - invalidando dashboard...');
    invalidateCards();
  }, [invalidateCards]);

  // Invalidar após modificação de transações recorrentes (AFETA PROJEÇÕES)
  const invalidateAfterRecurrentUpdate = useCallback(() => {
    console.log('🔄 Transação recorrente modificada - invalidando projeções...');
    invalidateCards(); // Força refresh completo das projeções
  }, [invalidateCards]);

  // Invalidar após modificação de financiamentos (AFETA PROJEÇÕES)
  const invalidateAfterFinancingUpdate = useCallback(() => {
    console.log('💳 Financiamento modificado - invalidando projeções...');
    invalidateCards(); // Força refresh completo das projeções
  }, [invalidateCards]);

  // Invalidar ao voltar de páginas específicas
  const invalidateOnReturn = useCallback((fromPage: string) => {
    console.log(`📱 Voltou de ${fromPage} - verificando invalidação...`);
    
    // Invalidar baseado na página de origem
    switch (fromPage) {
      case 'transacoes':
      case 'faturas':
      case 'parcelas':
        invalidateAfterTransaction();
        break;
      case 'cartoes':
        invalidateAfterCardUpdate();
        break;
      case 'contas':
        invalidateAfterAccountUpdate();
        break;
      case 'transacoes-recorrentes':
      case 'planejamento':
        invalidateAfterRecurrentUpdate(); // NOVO: invalidação específica para recorrentes
        break;
      case 'financiamentos':
        invalidateAfterFinancingUpdate(); // NOVO: invalidação específica para financiamentos
        break;
      default:
        // Para outras páginas, invalidar com intervalo menor (30 segundos)
        const lastInvalidation = localStorage.getItem('lastDashboardInvalidation');
        const thirtySecondsAgo = Date.now() - 30 * 1000; // REDUZIDO de 5 min para 30s
        
        if (!lastInvalidation || parseInt(lastInvalidation) < thirtySecondsAgo) {
          invalidateCards();
        }
    }
    
    // Salvar timestamp da última invalidação
    localStorage.setItem('lastDashboardInvalidation', Date.now().toString());
  }, [invalidateAfterTransaction, invalidateAfterCardUpdate, invalidateAfterAccountUpdate, invalidateAfterRecurrentUpdate, invalidateAfterFinancingUpdate, invalidateCards]);

  return {
    invalidateCards,
    invalidateAfterTransaction,
    invalidateAfterCardUpdate,
    invalidateAfterAccountUpdate,
    invalidateAfterRecurrentUpdate,
    invalidateAfterFinancingUpdate,
    invalidateOnReturn
  };
}; 