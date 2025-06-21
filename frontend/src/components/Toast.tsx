import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animação de entrada
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto-close após duração especificada
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 300);
  };

  const getToastStyles = () => {
    const baseStyles = "flex items-start p-4 rounded-xl shadow-lg border backdrop-blur-sm";
    
    switch (toast.type) {
      case 'success':
        return `${baseStyles} bg-green-50/90 dark:bg-green-900/20 border-green-200 dark:border-green-800`;
      case 'error':
        return `${baseStyles} bg-red-50/90 dark:bg-red-900/20 border-red-200 dark:border-red-800`;
      case 'warning':
        return `${baseStyles} bg-yellow-50/90 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800`;
      case 'info':
        return `${baseStyles} bg-blue-50/90 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800`;
      default:
        return `${baseStyles} bg-white/90 dark:bg-gray-800/90 border-gray-200 dark:border-gray-700`;
    }
  };

  const getIconStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTextStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-800 dark:text-green-200';
      case 'error':
        return 'text-red-800 dark:text-red-200';
      case 'warning':
        return 'text-yellow-800 dark:text-yellow-200';
      case 'info':
        return 'text-blue-800 dark:text-blue-200';
      default:
        return 'text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out max-w-sm w-full
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isLeaving ? 'translate-x-full opacity-0' : ''}
      `}
    >
      <div className={getToastStyles()}>
        {/* Ícone */}
        <div className={`flex-shrink-0 ${getIconStyles()}`}>
          {getIcon()}
        </div>

        {/* Conteúdo */}
        <div className="ml-3 flex-1">
          <div className={`text-sm font-semibold ${getTextStyles()}`}>
            {toast.title}
          </div>
          {toast.message && (
            <div className={`text-sm mt-1 ${getTextStyles()} opacity-80`}>
              {toast.message}
            </div>
          )}
          
          {/* Ação opcional */}
          {toast.action && (
            <div className="mt-2">
              <button
                onClick={toast.action.onClick}
                className={`text-xs font-medium underline hover:no-underline ${getTextStyles()}`}
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        {/* Botão fechar */}
        <button
          onClick={handleClose}
          className={`ml-3 flex-shrink-0 ${getIconStyles()} hover:opacity-70 transition-opacity`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toast; 