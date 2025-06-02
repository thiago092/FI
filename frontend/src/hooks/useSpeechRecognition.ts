import { useState, useCallback } from 'react';

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  browserSupportsSpeechRecognition: boolean;
  isSupported: boolean; // Alias para browserSupportsSpeechRecognition
  error?: string; // Para compatibilidade
}

export const useSpeechRecognition = (): SpeechRecognitionHook => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  // Verificar se o navegador suporta speech recognition
  const browserSupportsSpeechRecognition = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (!browserSupportsSpeechRecognition) {
      setError('Speech recognition not supported');
      console.warn('Speech recognition not supported');
      return;
    }
    setIsListening(true);
    setError(undefined);
    // Implementação básica - pode ser expandida posteriormente
  }, [browserSupportsSpeechRecognition]);

  const stopListening = useCallback(() => {
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(undefined);
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isSupported: browserSupportsSpeechRecognition,
    error,
  };
}; 