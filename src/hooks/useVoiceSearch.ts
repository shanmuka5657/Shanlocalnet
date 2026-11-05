import { useState, useEffect, useRef, useCallback } from 'react';
import { SupportedLanguage } from '../types/index.ts';

interface UseVoiceSearchProps {
  language: SupportedLanguage;
  onTranscript: (transcript: string) => void;
}

interface UseVoiceSearchReturn {
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
}

export const useVoiceSearch = ({
  language,
  onTranscript
}: UseVoiceSearchProps): UseVoiceSearchReturn => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        // Map app language to BCP-47 speech recognition locale
        switch (language) {
          case 'te':
            recognition.lang = 'te-IN'; // Telugu (India)
            break;
          case 'hi':
            recognition.lang = 'hi-IN'; // Hindi (India)
            break;
          case 'en':
          default:
            recognition.lang = 'en-IN'; // English (India)
            break;
        }

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript;
          if (transcript) {
            onTranscript(transcript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('[VoiceSearch] Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setError('Microphone permission denied. Please allow microphone access.');
          } else if (event.error === 'no-speech') {
            setError('No speech detected. Please speak clearly.');
          } else {
            setError(`Error: ${event.error}`);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('[VoiceSearch] Failed to initialize SpeechRecognition:', err);
        setIsSupported(false);
      }
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch { }
      }
    };
  }, [language, onTranscript]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    try {
      recognitionRef.current.start();
    } catch (err: any) {
      // In case start() was called while already running
      if (err.name !== 'InvalidStateError') {
        console.warn('[VoiceSearch] Failed to start:', err);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch { }
    setIsListening(false);
  }, []);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    error
  };
};

