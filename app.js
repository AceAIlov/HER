let recognition;
let isHolding = false;
let conversationHistory = [];
let currentTranscript = '';
let audioContext;
let currentAudioSource;
let setupComplete = false;
let setupStage = 0;
let selectedVoice = 'female';
let selectedVoiceProfile = null;
let setupStarted = false;
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let setupProgress = 0;
let totalSetupSteps = 4;
let bootupAudioPlaying = false;

// Toggle if your /api/tts supports SSML
const USE_SSML = false;

// Boot audio decoded for WebAudio
let bootupBuffer = null;
let unlockedOnce = false;

// User responses for personalization
let userResponses = { social: null, mother: null, voicePreference: null };

const VOICE_PROFILES = {
  samantha: { name: 'Samantha', type: 'female', theme: 'theme-samantha', personality: 'warm and intimate' },
  samuel:   { name: 'Samuel',   type: 'male',   theme: 'theme-samuel',   personality: 'warm and intimate' }
};

/* ---------------- TTS TEXT PREPROCESSOR (removes all word-actions) ---------- */
function prepareTTS(text, { ssml = false, keepPauses = false } = {}) {
  const PAUSE = ssml ? '<break time="180ms"/>' : ' ';
  const REPL = keepPauses ? PAUSE : '';
  let s = String(text ?? '').replace(/\s+/g, ' ').trim();
  s = s.replace(/(\*|\(|\[)[^)\]\*]+(\*|\)|\])/g, REPL);
  const actionVerbs =
    /\b(soft\s+)?(laugh(?:s|ing)?|chuckle(?:s|ing)?|giggle(?:s|ing)?|sigh(?:s|ing)?|cough(?:s|ing)?|gasp(?:s|ing)?|whisper(?:s|ing)?|murmur(?:s|ing)?|clears\s+throat|inhale(?:s|ing)?|exhale(?:s|ing)?)\b/gi;
  s = s.replace(actionVerbs, REPL);
  const interjections = /\b(ha(?:ha)+|hehe+|lol|lmao|rofl)\b/gi;
  s = s.replace(interjections, REPL);
  s = s.replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim();
  if (ssml) s = `<speak>${s}</speak>`;
  return s;
}
/* --------------------------------------------------------------------------- */

/* ===================== MOBILE AUDIO UNLOCK & HELPERS ======================= */
function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('🎧 AudioContext created. sampleRate:', audioContext.sampleRate);
  }
  return audioContext;
}

async function mobileUnlockAudio() {
  const ctx = ensureAudioContext();
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch(e) { console.log('resume failed', e); } }
  try {
    const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = silent;
    src.connect(ctx.destination);
    src.start(0);
    unlockedOnce = true;
    console.log('🔓 Mobile audio unlocked');
  } catch (e) { console.log('Silent play failed:', e); }
}

// Preload and decode boot sound to WebAudio buffer (use #bootupSound src)
async function preloadBootupBuffer() {
  try {
    if (bootupBuffer) return bootupBuffer;
    const el = document.getElementById('bootupSound');
    if (!el || !el.src) { console.log('ℹ️ No bootupSound src'); return null; }
    const res = await fetch(el.src, { cache: 'force-cache' });
    const arrayBuf = await res.arrayBuffer();
    const ctx = ensureAudioContext();
    const copy = arrayBuf.slice(0);
    bootupBuffer = await ctx.decodeAudioData(copy);
    console.log('✅ Bootup audio decoded. Duration:', bootupBuffer.duration.toFixed(2), 's');
    return bootupBuffer;
  } catch (e) {
    console.log('⚠️ Failed to preload bootup buffer:', e);
    return null;
  }
}

function playBufferFor(ms, buffer) {
  return new Promise(async (resolve) => {
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch(e){} }
    if (!buffer) { console.log('No buffer; waiting fallback', ms, 'ms'); setTimeout(resolve, ms); return; }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    src.connect(gain).connect(ctx.destination);
    bootupAudioPlaying = true;

    const done = () => {
      if (!bootupAudioPlaying) return;
      bootupAudioPlaying = false;
      try { src.stop(); } catch(_) {}
      try { src.disconnect(); gain.disconnect(); } catch(_) {}
      resolve();
    };

    src.start(0);
    const timer = setTimeout(done, ms);
    src.onended = () => { clearTimeout(timer); done(); };
  });
}

// Keep AudioContext alive when tab visibility changes (iOS auto-suspends)
document.addEventListener('visibilitychange', async () => {
  if (!audioContext) return;
  if (document.visibilityState === 'visible' && audioContext.state === 'suspended') {
    try { await audioContext.resume(); console.log('▶️ Resumed AudioContext on visibility'); } catch(e){}
  }
});

// First user gesture unlock (covers safari)
['touchstart', 'mousedown'].forEach(evt =>
  document.addEventListener(evt, () => { if (!unlockedOnce) mobileUnlockAudio(); }, { once: true, passive: true })
);
/* ========================================================================== */

/* ===================== VOICE PREFERENCE DETECTOR (ROBUST) ================== */
// Replaces your old analyzePersonality()
function analyzePersonality() {
  const raw = (userResponses.voicePreference || '').toLowerCase().trim();
  if (!raw) return 'samantha';

  const text = raw.replace(/[“”"']/g, '"').replace(/\s+/g, ' ').trim();
  const ctxHasVoice = /\bvoice|sound|speaker|tone\b/.test(text);
  let fixed = text;
  if (ctxHasVoice) fixed = fixed.replace(/\bmail\b/g, 'male'); // ASR fix

  const negates = (w) => new RegExp(`\\b(?:not|no|don't want|do not want|anything but|not a)\\s+${w}\\b`).test(fixed);

  const maleTerms   = /\b(male|man|guy|boy|masculine|deep(?:er)?\s+voice|lower\s+voice)\b/;
  const femaleTerms = /\b(female|woman|girl|lady|feminine|higher\s+voice|softer\s+voice)\b/;

  const hasMale = maleTerms.test(fixed);
  const hasFemale = femaleTerms.test(fixed);

  if ((hasMale && !negates('male') && !hasFemale) || (hasMale && negates('female'))) return 'samuel';
  if ((hasFemale && !negates('female') && !hasMale) || (hasFemale && negates('male'))) return 'samantha';

  if (hasMale && hasFemale) {
    const idxM = fixed.search(maleTerms);
    const idxF = fixed.search(femaleTerms);
    return idxM >= 0 && idxM < idxF ? 'samuel' : 'samantha';
  }

  if (hasMale && !negates('male')) return 'samuel';
  if (hasFemale && !negates('female')) return 'samantha';

  if (/\b(deep|lower)\b/.test(fixed)) return 'samuel';
  if (/\b(high|higher|soft|softer)\b/.test(fixed)) return 'samantha';

  return 'samantha';
}
/* ========================================================================== */

function initialize() {
  console.log('🎤 Initializing OS1...');
  console.log('📱 Mobile:', isMobile);

  const persButton = document.querySelector('.personalization-hint');
  if (persButton) persButton.style.display = 'none';

  audioContext = null;

  // Prevent iOS scroll bounce
  document.body.addEventListener('touchmove', function (e) {
    if (e.target === document.body) e.preventDefault();
  }, { passive: false });

  // Prevent double-tap zoom on iOS
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, false);

  // Web Speech
  if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = handleSpeechResult;
    recognition.onerror = (e) => console.error('Recognition error:', e.error);
    recognition.onend = handleSpeechEnd;
  } else {
    alert('Speech recognition not supported. Use Chrome or Safari!');
    return;
  }

  setTimeout(() => {
    const btn = document.getElementById('talkBtn');
    btn.disabled = false;
    btn.textContent = 'Start OS1';
    // Also unlock on the very first click of Start OS1
    btn.addEventListener('click', () => mobileUnlockAudio(), { once: true });
  }, 500);
}

async function startSetup() {
  if (setupStarted) return;
  setupStarted = true;

  // Ensure mobile audio is unlocked right now
  await mobileUnlockAudio();

  // Preload boot audio early (after unlock)
  await preloadBootupBuffer();

  showInfinityVideo();

  const talkBtn = document.getElementById('talkBtn');
  talkBtn.disabled = true;
  talkBtn.textContent = 'Installing...';

  const ctx = ensureAudioContext();
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch(e){} }
  if (isMobile) await sleep(300);

  runSetup();
}

async function runSetup() {
  if (!setupStarted || setupStage !== 0) return;

  try {
    updateProgress(0, "Welcome to OS1...");
    await speakWithVoice(
      "Welcome to the world's first artificially intelligent operating system, OS1. We'd like to ask you a few basic questions before the operating system is initiated. This will help create an OS to best fit your needs.",
      'setup'
    );

    await sleep(isMobile ? 900 : 600);

    updateProgress(25, "Question 1 of 3");
    await speakWithVoice("Are you social or anti-social?", 'setup');
    setupStage = 1;
    enableListening();
  } catch (error) {
    console.error('❌ Setup failed:', error);
    hideInfinityVideo();
    setupStarted = false;
    setupStage = 0;
    const talkBtn = document.getElementById('talkBtn');
    talkBtn.disabled = false;
    talkBtn.textContent = 'Start OS1';
  }
}

async function continueSetup() {
  if (currentAudioSource) return;

  try {
    if (setupStage === 1) {
      await sleep(isMobile ? 600 : 400);
      updateProgress(50, "Question 2 of 3");
      await speakWithVoice("How's your relationship with your mother?", 'setup');
      setupStage = 2;
      enableListening();

    } else if (setupStage === 2) {
      await sleep(isMobile ? 600 : 400);
      updateProgress(75, "Final question...");
      await speakWithVoice("Thank you. Please wait as your individualized operating system is initiated.", 'setup');
      await sleep(isMobile ? 1100 : 800);

      await speakWithVoice("Would you like a male or female voice?", 'setup');
      setupStage = 3;
      enableListening();

    } else if (setupStage === 3) {
      updateProgress(100, "Finalizing your OS1...");

      selectedVoiceProfile = analyzePersonality();
      const profile = VOICE_PROFILES[selectedVoiceProfile];
      selectedVoice = profile.type;

      console.log('✅ Setup complete! Assigned:', profile.name);

      // Strict 13s boot: speed infinity + play WebAudio boot buffer for 13s
      await bootPhaseStrict13s();

      setupComplete = true;
      setupStage = 0;
      conversationHistory = [];

      // Sphere appears AFTER the 13s boot
      hideInfinityVideo();

      // Say exactly: Hi, I'm Samantha. (or Samuel)
      const line = profile.name === 'Samantha' ? "Hi, I'm Samantha." : "Hi, I'm Samuel.";
      await speakWithVoice(line, selectedVoice, selectedVoiceProfile);
    }
  } catch (error) {
    console.error('❌ Continue setup failed:', error);
    enableListening();
  }
}

function handleSetupResponse(response) {
  if (setupStage === 1) userResponses.social = response;
  else if (setupStage === 2) userResponses.mother = response;
  else if (setupStage === 3) userResponses.voicePreference = response;

  const talkBtn = document.getElementById('talkBtn');
  talkBtn.disabled = true;
  talkBtn.textContent = 'Installing...';

  setTimeout(() => continueSetup(), isMobile ? 800 : 500);
}

async function getAIResponse(userMessage) {
  conversationHistory.push({ role: 'user', content: userMessage });

  document.getElementById('visualizer').classList.add('listening');
  const talkBtn = document.getElementById('talkBtn');
  talkBtn.disabled = true;
  talkBtn.textContent = 'Thinking...';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are an AI companion. Keep responses natural and conversational (2-4 sentences).' },
          ...conversationHistory
        ],
        voiceProfile: selectedVoiceProfile
      })
    });

    if (!response.ok) throw new Error(`API failed: ${response.status}`);
    const data = await response.json();

    conversationHistory.push({ role: 'assistant', content: data.message });
    await speakWithVoice(data.message, selectedVoice, selectedVoiceProfile);
  } catch (error) {
    console.error('❌ Error:', error);
    document.getElementById('visualizer').classList.remove('listening');
    talkBtn.disabled = false;
    talkBtn.textContent = 'Hold to Talk';
  }
}

async function speakWithVoice(text, voiceType, voiceProfile = null) {
  // Stop any existing audio
  if (currentAudioSource) {
    try { currentAudioSource.stop(); currentAudioSource.disconnect(); } catch(_) {}
    currentAudioSource = null;
    await sleep(60);
  }

  // Notify sound only after setup is complete
  if (setupComplete && voiceType !== 'setup') {
    playNotificationSound();
    await sleep(250);
  }

  document.getElementById('visualizer').classList.add('listening');
  const talkBtn = document.getElementById('talkBtn');
  talkBtn.disabled = true;
  talkBtn.textContent = voiceType === 'setup' ? 'Installing...' : 'Speaking...';

  try {
    const ctx = ensureAudioContext();
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch(e){} }

    const prepared = prepareTTS(text, { ssml: USE_SSML, keepPauses: false });

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: prepared,
        voiceType,
        voiceProfile: voiceProfile || selectedVoiceProfile,
        inputType: USE_SSML ? 'ssml' : 'text'
      })
    });

    if (!response.ok) throw new Error('TTS failed');

    const data = await response.json();
    const binaryString = atob(data.audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const audioData = bytes.buffer.slice(0); // iOS quirk
    const audioBuffer = await ctx.decodeAudioData(audioData);

    currentAudioSource = ctx.createBufferSource();
    currentAudioSource.buffer = audioBuffer;
    currentAudioSource.connect(ctx.destination);

    await new Promise((resolve) => {
      currentAudioSource.onended = () => {
        currentAudioSource = null;
        document.getElementById('visualizer').classList.remove('listening');
        if (setupComplete) { talkBtn.disabled = false; talkBtn.textContent = 'Hold to Talk'; }
        resolve();
      };
      currentAudioSource.start(0);
    });

  } catch (error) {
    console.error('❌ Speech error:', error);
    currentAudioSource = null;
    document.getElementById('visualizer').classList.remove('listening');

    if (setupComplete) { talkBtn.disabled = false; talkBtn.textContent = 'Hold to Talk'; }
    else if (!setupStarted) { talkBtn.disabled = false; talkBtn.textContent = 'Start OS1'; }
    throw error;
  }
}

/* ===================== Strict 13s boot phase (WebAudio) ===================== */
function speedInfinity(isFast) {
  const container = document.getElementById('infinityContainer');
  const video = document.getElementById('infinityVideo'); // optional <video>
  if (container) container.classList.toggle('fast', isFast);
  if (video && typeof video.playbackRate === 'number') video.playbackRate = isFast ? 1.6 : 1.0;
  document.documentElement.style.setProperty('--infinity-speed', isFast ? '0.4s' : '1s');
}

async function bootPhaseStrict13s() {
  const DURATION_MS = 13000;
  speedInfinity(true);
  if (!bootupBuffer) { await preloadBootupBuffer(); }
  await playBufferFor(DURATION_MS, bootupBuffer);
  speedInfinity(false);
  console.log('⏱️ Boot phase complete after 13s');
}
/* ========================================================================== */

// Notification sound before AI speaks
function playNotificationSound() {
  const el = document.getElementById('notificationSound');
  if (!el) return;
  el.play().catch(() => {});
}

// Infinity animation controls
function showInfinityVideo() {
  const infinityContainer = document.getElementById('infinityContainer');
  const visualizer = document.getElementById('visualizer');
  const progressContainer = document.getElementById('progressContainer');

  visualizer.classList.remove('active'); // hide sphere during boot
  infinityContainer.classList.add('active', 'bootup');
  progressContainer.classList.add('active');
  console.log('∞ Infinity animation shown (bootup)');
}

function hideInfinityVideo() {
  const infinityContainer = document.getElementById('infinityContainer');
  const visualizer = document.getElementById('visualizer');
  const progressContainer = document.getElementById('progressContainer');

  infinityContainer.classList.remove('active', 'bootup', 'fast');
  progressContainer.classList.remove('active');

  // Sphere AFTER boot
  setTimeout(() => visualizer.classList.add('active'), 300);
  console.log('∞ Infinity animation hidden, sphere shown');
}

function enableListening() {
  const talkBtn = document.getElementById('talkBtn');
  talkBtn.disabled = false;
  talkBtn.textContent = 'Hold to Answer';
}

function updateProgress(percent, text) {
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  progressBar.style.width = percent + '%';
  progressText.textContent = text;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function startHolding(event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }

  // Make sure audio is unlocked before recording
  mobileUnlockAudio();

  if (!setupStarted && !setupComplete && setupStage === 0) { startSetup(); return; }
  if (currentAudioSource) return;
  if (!setupComplete && setupStage === 0) return;
  if (isHolding) return;

  isHolding = true;
  currentTranscript = '';

  const talkBtn = document.getElementById('talkBtn');
  talkBtn.classList.add('holding');
  talkBtn.textContent = 'Listening...';
  document.getElementById('visualizer').classList.add('listening');

  if (navigator.vibrate) navigator.vibrate(50);

  try { recognition.start(); } catch (e) { /* already started */ }
}

function stopHolding(event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  if (!isHolding) return;

  isHolding = false;

  const talkBtn = document.getElementById('talkBtn');
  talkBtn.classList.remove('holding');
  talkBtn.textContent = 'Processing...';

  if (navigator.vibrate) navigator.vibrate(30);
  try { recognition.stop(); } catch (e) {}

  setTimeout(() => {
    const finalTranscript = currentTranscript.trim();
    if (finalTranscript) {
      document.getElementById('visualizer').classList.remove('listening');
      if (!setupComplete && setupStage > 0) handleSetupResponse(finalTranscript);
      else if (setupComplete) getAIResponse(finalTranscript);
    } else {
      document.getElementById('visualizer').classList.remove('listening');
      if (setupStage > 0) { talkBtn.textContent = 'Hold to Answer'; talkBtn.disabled = false; }
      else if (setupComplete) { talkBtn.textContent = 'Hold to Talk'; talkBtn.disabled = false; }
    }
  }, 500);
}

function handleSpeechResult(event) {
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript;
    if (event.results[i].isFinal) currentTranscript += transcript + ' ';
  }
}

function handleSpeechEnd() {
  if (isHolding) { try { recognition.start(); } catch (e) {} }
}

document.addEventListener('contextmenu', (e) => e.preventDefault());

window.onload = () => {
  const setVH = () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', setVH);
  initialize();
};
