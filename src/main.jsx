import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

function useRecorder() {
  const mediaRecorderRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const chunksRef = useRef([]);

  useEffect(() => () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
  }, []);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start();
    setRecording(true);
  };

  const stop = async () => new Promise((resolve) => {
    const mr = mediaRecorderRef.current;
    if (!mr) return resolve(null);
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setRecording(false);
      resolve(blob);
    };
    mr.stop();
  });

  return { start, stop, recording };
}

function InfinityMark({ speaking }) {
  return (
    <div className="infty">
      <div className={`loop left ${speaking ? '' : ''}`}></div>
      <div className={`loop right ${speaking ? '' : ''}`}></div>
    </div>
  );
}

function App() {
  const interviewerVoice = 'alloy';
  const { start, stop, recording } = useRecorder();
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const questions = [
    'Hello. What gender would you like your assistant to be?',
    'Would you like to give me a name?',
    'Would you say you are more introverted or extroverted?',
    'How would you describe your relationship with your mother?'
  ];
  const keys = ['voice','name','social','mother'];

  useEffect(() => {
    (async () => {
      if (!prefs && onboardingStep < questions.length) {
        await playQuestion();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingStep]);

  async function playQuestion() {
    const q = questions[onboardingStep];
    const r = await fetch('/api/say', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text: q, voice: interviewerVoice })
    });
    const { audioBase64 } = await r.json();
    const audio = new Audio('data:audio/mpeg;base64,' + audioBase64);
    setSpeaking(true);
    audio.onended = () => { setSpeaking(false); };
    await audio.play();
  }

  async function beginAnswer() {
    if (!recording) await start();
  }

  async function captureAnswer() {
    if (!recording) return;
    setBusy(true);
    const blob = await stop();
    const form = new FormData();
    form.append('audio', blob, 'speech.webm');
    const t = await fetch('/api/transcribe', { method:'POST', body: form });
    const { text } = await t.json();
    const answer = (text || '').trim();

    let nextPrefs = { ...(prefs || {}) };
    const k = keys[onboardingStep];
    if (k === 'voice') {
      const v = /fem|girl|woman/i.test(answer) ? 'feminine' : /masc|boy|man/i.test(answer) ? 'masculine' : 'neutral';
      nextPrefs.voice = v;
    } else if (k === 'name') {
      nextPrefs.name = answer || 'friend';
    } else if (k === 'social') {
      if (/intro/i.test(answer)) nextPrefs.social = 'introverted';
      else if (/extro/i.test(answer)) nextPrefs.social = 'extroverted';
      else nextPrefs.social = 'balanced';
    } else if (k === 'mother') {
      nextPrefs.mother = answer || '—';
    }

    if (onboardingStep < questions.length - 1) {
      setPrefs(nextPrefs);
      setOnboardingStep(onboardingStep + 1);
      await playQuestion();
    } else {
      localStorage.setItem('osPrefs', JSON.stringify(nextPrefs));
      setPrefs(nextPrefs);
      setOnboardingStep(questions.length);
    }
    setBusy(false);
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-10 select-none">
      <InfinityMark speaking={speaking || busy} />
      <button
        aria-label={recording ? 'Listening. Release to send' : 'Hold to answer'}
        onMouseDown={beginAnswer}
        onMouseUp={captureAnswer}
        onTouchStart={beginAnswer}
        onTouchEnd={captureAnswer}
        disabled={busy}
        className="px-6 py-3 rounded-2xl border border-white/10 bg-white/5 text-white/60 hover:text-white/80"
      >
        {recording ? 'Listening…' : 'Hold to answer'}
      </button>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
