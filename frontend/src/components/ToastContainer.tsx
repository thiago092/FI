import React from 'react';
import Toast, { ToastMessage } from './Toast';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemoveToast: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const ToastContainer: React.FC<ToastContainerProps> = ({ 
  toasts, 
  onRemoveToast, 
  position = 'top-right' 
}) => {
  const getPositionStyles = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className={`fixed z-50 ${getPositionStyles()}`}>
      <div className="space-y-3">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={onRemoveToast}
          />
        ))}
      </div>
    </div>
  );
};

export default ToastContainer; 