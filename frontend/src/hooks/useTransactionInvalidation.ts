import { useQueryClient } from 'react-query';
import { useCallback } from 'react';

export const useTransactionInvalidation = () => {
  const queryClient = useQueryClient();

  // Invalidar após qualquer operação de transação
  const invalidateAfterTransactionMutation = useCallback(() => {
    console.log('💰 Operação de transação realizada - invalidando dashboard...');
    
    // Invalidar dados do dashboard
    queryClient.invalidateQueries('dashboard-charts');
    
    // Invalidar listagens relacionadas
    queryClient.invalidateQueries('transacoes');
    queryClient.invalidateQueries('categorias');
    queryClient.invalidateQueries('cartoes');
    queryClient.invalidateQueries('contas');
  }, [queryClient]);

  return {
    invalidateAfterTransactionMutation
  };
}; 