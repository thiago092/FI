// Utility para testar capacidades de reconhecimento de voz
export const testSpeechRecognition = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn('❌ Speech Recognition não suportado neste navegador');
    return {
      supported: false,
      browser: getBrowserInfo(),
      recommendations: [
        'Use Chrome, Edge ou Safari',
        'Certifique-se de estar em HTTPS',
        'Verifique as permissões do microfone'
      ]
    };
  }

  console.log('✅ Speech Recognition suportado!');
  return {
    supported: true,
    browser: getBrowserInfo(),
    features: {
      continuous: true,
      interimResults: true,
      languages: ['pt-BR', 'en-US', 'es-ES']
    }
  };
};

const getBrowserInfo = () => {
  const userAgent = navigator.userAgent;
  
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  
  return 'Unknown';
};

export const checkMicrophonePermissions = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    
    console.log('✅ Permissões de microfone concedidas');
    return { granted: true };
  } catch (error) {
    console.warn('❌ Permissões de microfone negadas:', error);
    return { 
      granted: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
};

export const getAudioInputDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    
    console.log(`🎤 ${audioInputs.length} dispositivos de áudio encontrados:`, audioInputs);
    return audioInputs.map(device => ({
      id: device.deviceId,
      label: device.label || 'Microfone',
      groupId: device.groupId
    }));
  } catch (error) {
    console.warn('❌ Erro ao listar dispositivos de áudio:', error);
    return [];
  }
};

// Frases de teste para o reconhecimento de voz
export const testPhrases = [
  'Gastei cinquenta reais com iFood',
  'Recebi dois mil reais de salário',
  'Paguei quinhentos reais de aluguel',
  'Comprei um café por cinco reais',
  'Entrou trezentos reais de freelance'
];

export const runSpeechTest = () => {
  console.log('🧪 Iniciando testes de Speech Recognition...');
  
  const recognitionTest = testSpeechRecognition();
  console.log('Teste de Recognition:', recognitionTest);
  
  if (recognitionTest.supported) {
    console.log('📋 Frases de teste sugeridas:', testPhrases);
    console.log('💡 Dica: Fale claramente e aguarde a transcrição');
  }
  
  return recognitionTest;
}; 