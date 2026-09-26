"use client";
import {useEffect, useRef, useState} from 'react';

type Recognition = {lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void;
  onresult: ((event: {results: ArrayLike<ArrayLike<{transcript: string}> & {isFinal: boolean}>; resultIndex: number}) => void) | null;
  onerror: ((event: {error: string}) => void) | null; onend: (() => void) | null};
type RecognitionConstructor = new () => Recognition;

/**
 * Dictation for the chat box (Lovable's microphone). Uses the browser's own
 * speech recognition; in Chrome and Edge the audio is transcribed by the
 * browser vendor's service, which the tooltip states.
 */
export default function VoiceInputButton({onText, disabled, className}: {onText: (text: string) => void; disabled?: boolean; className?: string}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  useEffect(() => {
    const scope = window as unknown as {SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor};
    setSupported(Boolean(scope.SpeechRecognition || scope.webkitSpeechRecognition));
    return () => recognition.current?.stop();
  }, []);

  function toggle() {
    if (listening) { recognition.current?.stop(); return; }
    const scope = window as unknown as {SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor};
    const Constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Constructor) return;
    const instance = new Constructor();
    instance.lang = 'pt-BR'; instance.interimResults = false; instance.continuous = true;
    instance.onresult = event => {
      let text = '';
      for (let index = event.resultIndex; index < event.results.length; index++) if (event.results[index].isFinal) text += event.results[index][0].transcript;
      if (text.trim()) onText(text.trim());
    };
    instance.onerror = event => { setError(event.error === 'not-allowed' ? 'Permita o uso do microfone no navegador.' : 'Não foi possível ouvir. Tente de novo.'); setListening(false); };
    instance.onend = () => setListening(false);
    recognition.current = instance; setError(''); setListening(true); instance.start();
  }

  return <button type="button" onClick={toggle} disabled={disabled || !supported} aria-pressed={listening}
    aria-label={listening ? 'Parar de ditar' : 'Ditar por voz'}
    title={!supported ? 'Seu navegador não oferece ditado por voz (use Chrome ou Edge).' : error || (listening ? 'Ouvindo… clique para parar' : 'Ditar por voz (a transcrição é feita pelo navegador)')}
    className={className ?? `flex h-[36px] w-[36px] items-center justify-center rounded-full ${listening ? 'bg-red-500 text-white' : 'text-current hover:bg-white/10'} disabled:opacity-30`}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
  </button>;
}
