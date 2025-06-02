import React, { useState, useEffect } from 'react';
import { Settings, Mic, Volume2, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { testSpeechRecognition, checkMicrophonePermissions, getAudioInputDevices, testPhrases } from '../utils/speechTest';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface SpeechDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SpeechDebugPanel({ isOpen, onClose }: SpeechDebugPanelProps) {
  const [testResults, setTestResults] = useState<any>(null);
  const [micPermission, setMicPermission] = useState<any>(null);
  const [audioDevices, setAudioDevices] = useState<any[]>([]);
  const [testPhrase, setTestPhrase] = useState('');
  
  const {
    isListening,
    transcript,
    error: speechError,
    isSupported: speechSupported,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechRecognition();

  useEffect(() => {
    if (isOpen) {
      runDiagnostics();
    }
  }, [isOpen]);

  const runDiagnostics = async () => {
    console.log('🔍 Executando diagnósticos de voz...');
    
    // Teste de suporte
    const speechTest = testSpeechRecognition();
    setTestResults(speechTest);
    
    // Teste de permissões
    const permissionTest = await checkMicrophonePermissions();
    setMicPermission(permissionTest);
    
    // Listar dispositivos
    const devices = await getAudioInputDevices();
    setAudioDevices(devices);
  };

  const handleTestPhrase = (phrase: string) => {
    setTestPhrase(phrase);
    resetTranscript();
    
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Debug Speech Recognition</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Geral */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              Status do Sistema
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Suporte do Navegador:</span>
                <span className={`font-medium ${speechSupported ? 'text-green-600' : 'text-red-600'}`}>
                  {speechSupported ? '✅ Suportado' : '❌ Não Suportado'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Navegador:</span>
                <span className="font-medium text-gray-700">
                  {testResults?.browser || 'Detectando...'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Permissão Microfone:</span>
                <span className={`font-medium ${micPermission?.granted ? 'text-green-600' : 'text-red-600'}`}>
                  {micPermission?.granted ? '✅ Concedida' : '❌ Negada'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Dispositivos de Áudio:</span>
                <span className="font-medium text-gray-700">
                  {audioDevices.length} encontrados
                </span>
              </div>
            </div>
          </div>

          {/* Teste em Tempo Real */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Mic className="w-5 h-5 text-purple-500 mr-2" />
              Teste em Tempo Real
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <span className={`text-sm font-medium ${isListening ? 'text-red-600' : 'text-gray-500'}`}>
                  {isListening ? '🔴 Escutando...' : '⚪ Parado'}
                </span>
              </div>
              
              {transcript && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="text-sm font-medium text-blue-700">Transcrição:</label>
                  <p className="text-blue-900 mt-1">{transcript}</p>
                </div>
              )}
              
              {speechError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <label className="text-sm font-medium text-red-700">Erro:</label>
                  <p className="text-red-900 mt-1">{speechError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Frases de Teste */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Volume2 className="w-5 h-5 text-green-500 mr-2" />
              Frases de Teste
            </h3>
            
            <p className="text-sm text-gray-600 mb-3">
              Clique em uma frase e teste o reconhecimento:
            </p>
            
            <div className="grid gap-2">
              {testPhrases.map((phrase, index) => (
                <button
                  key={index}
                  onClick={() => handleTestPhrase(phrase)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    testPhrase === phrase
                      ? 'bg-purple-50 border-purple-200 text-purple-700'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-sm">{phrase}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dispositivos de Áudio */}
          {audioDevices.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Dispositivos de Áudio</h3>
              <div className="space-y-2">
                {audioDevices.map((device, index) => (
                  <div key={device.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">{device.label}</span>
                    <span className="text-xs text-gray-500">#{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendações */}
          {(!speechSupported || !micPermission?.granted) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Recomendações
              </h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                {!speechSupported && (
                  <>
                    <li>• Use Chrome, Edge ou Safari</li>
                    <li>• Certifique-se de estar em HTTPS</li>
                  </>
                )}
                {!micPermission?.granted && (
                  <>
                    <li>• Permita acesso ao microfone</li>
                    <li>• Verifique as configurações de privacidade</li>
                  </>
                )}
              </ul>
            </div>
          )}

          {/* Ações */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={runDiagnostics}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Executar Novamente
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 