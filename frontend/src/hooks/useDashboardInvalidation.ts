import { useQueryClient } from 'react-query';
import { useCallback } from 'react';

export const useDashboardInvalidation = () => {
  const queryClient = useQueryClient();

  // Invalidar dados dos cards principais - ATUALIZADO PARA QUERY UNIFICADA
  const invalidateCards = useCallback(() => {
    console.log('🔄 Invalidando dashboard unificado...');
    queryClient.invalidateQueries('dashboard-unified'); // CORREÇÃO: Nova query unificada
    
    // Também invalidar queries relacionadas
    queryClient.invalidateQueries('categorias');
    queryClient.invalidateQueries('cartoes');
    queryClient.invalidateQueries('contas');
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
      default:
        // Para outras páginas, invalidar só se dados estão velhos
        const lastInvalidation = localStorage.getItem('lastDashboardInvalidation');
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        
        if (!lastInvalidation || parseInt(lastInvalidation) < fiveMinutesAgo) {
          invalidateCards();
        }
    }
    
    // Salvar timestamp da última invalidação
    localStorage.setItem('lastDashboardInvalidation', Date.now().toString());
  }, [invalidateAfterTransaction, invalidateAfterCardUpdate, invalidateAfterAccountUpdate, invalidateCards]);

  return {
    invalidateCards,
    invalidateAfterTransaction,
    invalidateAfterCardUpdate,
    invalidateAfterAccountUpdate,
    invalidateOnReturn
  };
}; 