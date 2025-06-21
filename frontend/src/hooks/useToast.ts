import { useState, useCallback } from 'react';
import { ToastMessage, ToastType } from '../components/Toast';

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast: ToastMessage = {
      ...toast,
      id,
      duration: toast.duration ?? 5000, // 5 segundos por padrão
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Funções utilitárias para diferentes tipos de toast
  const showSuccess = useCallback((title: string, message?: string, options?: Partial<ToastMessage>) => {
    return addToast({
      type: 'success',
      title,
      message,
      ...options,
    });
  }, [addToast]);

  const showError = useCallback((title: string, message?: string, options?: Partial<ToastMessage>) => {
    return addToast({
      type: 'error',
      title,
      message,
      duration: 7000, // Erros ficam mais tempo
      ...options,
    });
  }, [addToast]);

  const showWarning = useCallback((title: string, message?: string, options?: Partial<ToastMessage>) => {
    return addToast({
      type: 'warning',
      title,
      message,
      ...options,
    });
  }, [addToast]);

  const showInfo = useCallback((title: string, message?: string, options?: Partial<ToastMessage>) => {
    return addToast({
      type: 'info',
      title,
      message,
      ...options,
    });
  }, [addToast]);

  // Toasts específicos para ações comuns
  const showLoadingToast = useCallback((message: string = 'Carregando...') => {
    return addToast({
      type: 'info',
      title: message,
      duration: 0, // Não remove automaticamente
    });
  }, [addToast]);

  const showSaveSuccess = useCallback((entity: string = 'item') => {
    return showSuccess('Salvo com sucesso!', `${entity} foi salvo com sucesso.`);
  }, [showSuccess]);

  const showDeleteSuccess = useCallback((entity: string = 'item') => {
    return showSuccess('Excluído com sucesso!', `${entity} foi excluído com sucesso.`);
  }, [showSuccess]);

  const showNetworkError = useCallback(() => {
    return showError(
      'Erro de conexão',
      'Verifique sua conexão com a internet e tente novamente.',
      {
        action: {
          label: 'Tentar novamente',
          onClick: () => window.location.reload(),
        },
      }
    );
  }, [showError]);

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoadingToast,
    showSaveSuccess,
    showDeleteSuccess,
    showNetworkError,
  };
}; 