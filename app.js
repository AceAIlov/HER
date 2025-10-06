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

// Toggle this if your /api/tts supports SSML ("<speak>...</speak>")
const USE_SSML = false;

// User responses for personalization
let userResponses = {
  social: null,
  mother: null,
  voicePreference: null
};

// Available voice profiles
const VOICE_PROFILES = {
  samantha: {
    name: 'Samantha',
    type: 'female',
    theme: 'theme-samantha',
    personality: 'warm and intimate'
  },
  samuel: {
    name: 'Samuel',
    type: 'male',
    theme: 'theme-samuel',
    personality: 'warm and intimate'
  }
};

/* --------------------------- TTS TEXT PREPROCESSOR --------------------------- */
/**
 * Strip ALL stage directions & word-actions (no fillers, no laughs).
 * Set keepPauses=true if you ever want short silences where actions were.
 */
function prepareTTS(text, { ssml = false, keepPauses = false } = {}) {
  const PAUSE = ssml ? '<break time="180ms"/>' : ' ';
  const REPL = keepPauses ? PAUSE : ''; // full removal by default

  let s = String(text ?? '').replace(/\s+/g, ' ').trim();

  // 1) Remove bracketed stage directions entirely: *...*, (...), [...]
  s = s.replace(/(\*|\(|\[)[^)\]\*]+(\*|\)|\])/g, REPL);

  // 2) Remove common word-actions that appear inline
  const actionVerbs =
    /\b(soft\s+)?(laugh(?:s|ing)?|chuckle(?:s|ing)?|giggle(?:s|ing)?|sigh(?:s|ing)?|cough(?:s|ing)?|gasp(?:s|ing)?|whisper(?:s|ing)?|murmur(?:s|ing)?|clears\s+throat|inhale(?:s|ing)?|exhale(?:s|ing)?)\b/gi;
  s = s.replace(actionVerbs, REPL);

  // 3) Remove laugh/interjection tokens
  const interjections = /\b(ha(?:ha)+|hehe+|lol|lmao|rofl)\b/gi;
  s = s.replace(interjections, REPL);

  // 4) Clean up leftover punctuation/spacing
  s = s.replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim();

  if (ssml) s = `<speak>${s}</speak>`;
  return s;
}
/* --------------------------------------------------------------------------- */

function initialize() {
  console.log('🎤 Initializing OS1...');
  console.log('📱 Mobile:', isMobile);

  // Remove personalization button since users can't choose
  const persButton = document.querySelector('.personalization-hint');
  if (persButton) persButton.style.display = 'none';

  // Don't create audio context until user interaction (important for mobile)
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
    document.getElementById('talkBtn').disabled = false;
    document.getElementById('talkBtn').textContent = 'Start OS1';
  }, 500);
}

function analyzePersonality() {
  const voicePref = userResponses.voicePreference?.toLowerCase() || '';

  console.log('🔍 Analyzing voice preference...');
  console.log('   Raw response:', userResponses.voicePreference);
  console.log('   Lowercase:', voicePref);

  // Check for female FIRST (because "female" contains "male")
  if (voicePref.includes('female') || voicePref.includes('woman') || voicePref.includes('girl')) {
    console.log('✅ Assigned voice: Samantha (female)');
    return 'samantha';
  } else if (voicePref.includes('male') || voicePref.includes('man') || voicePref.includes('boy')) {
    console.log('✅ Assigned voice: Samuel (male)');
    return 'samuel';
  } else {
    console.log('✅ Assigned voice: Samantha (default)');
    return 'samantha';
  }
}

async function startSetup() {
  if (setupStarted) {
    console.log('⚠️ Setup already started');
    return;
  }

  setupStarted = true;
  console.log('🎬 Starting setup...');

  // Show infinity animation (NO sound yet)
  showInfinityVideo();

  document.getElementById('talkBtn').disabled = true;
  document.getElementById('talkBtn').textContent = 'Installing...';

  // CRITICAL: Create and unlock audio on iOS
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('✅ Audio context created');

      // iOS audio unlock - play silent sound
      const silentBuffer = audioContext.createBuffer(1, 1, 22050);
      const source = audioContext.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(audioContext.destination);
      source.start(0);
      console.log('🔓 iOS audio unlocked');
    } catch (e) {
      console.error('❌ Failed to create audio context:', e);
    }
  }

  // Always try to resume audio context
  if (audioContext && audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
      console.log('✅ Audio context resumed');
      await sleep(isMobile ? 800 : 300);
    } catch (e) {
      console.error('❌ Failed to resume audio:', e);
    }
  }

  if (isMobile) await sleep(500);

  runSetup();
}

async function runSetup() {
  console.log('📢 Running setup sequence...');

  if (!setupStarted || setupStage !== 0) {
    console.log('⚠️ Setup already in progress');
    return;
  }

  try {
    updateProgress(0, "Welcome to OS1...");

    await speakWithVoice(
      "Welcome to the world's first artificially intelligent operating system, OS1. We'd like to ask you a few basic questions before the operating system is initiated. This will help create an OS to best fit your needs.",
      'setup'
    );

    await sleep(isMobile ? 1200 : 800);

    updateProgress(25, "Question 1 of 3");
    await speakWithVoice("Are you social or anti-social?", 'setup');
    setupStage = 1;
    enableListening();
  } catch (error) {
    console.error('❌ Setup failed:', error);
    hideInfinityVideo();
    setupStarted = false;
    setupStage = 0;
    document.getElementById('talkBtn').disabled = false;
    document.getElementById('talkBtn').textContent = 'Start OS1';
  }
}

async function continueSetup() {
  console.log('🔄 Continue setup, stage:', setupStage);

  if (currentAudioSource) {
    console.log('⚠️ Audio still playing, waiting...');
    return;
  }

  try {
    if (setupStage === 1) {
      await sleep(isMobile ? 800 : 500);
      updateProgress(50, "Question 2 of 3");
      await speakWithVoice("How's your relationship with your mother?", 'setup');
      setupStage = 2;
      enableListening();

    } else if (setupStage === 2) {
      await sleep(isMobile ? 800 : 500);
      updateProgress(75, "Final question...");
      await speakWithVoice("Thank you. Please wait as your individualized operating system is initiated.", 'setup');
      await sleep(isMobile ? 1500 : 1000);

      await speakWithVoice("Would you like a male or female voice?", 'setup');
      setupStage = 3;
      enableListening();

    } else if (setupStage === 3) {
      updateProgress(100, "Finalizing your OS1...");

      // Analyze and select voice
      selectedVoiceProfile = analyzePersonality();
      const profile = VOICE_PROFILES[selectedVoiceProfile];
      selectedVoice = profile.type;

      console.log('✅ Setup complete!');
      console.log('🎭 Assigned personality:', profile.name);
      console.log('💫 Traits:', profile.personality);

      // Strict boot phase: speed infinity + play audio + wait EXACTLY 13s
      await bootPhaseStrict13s();

      setupComplete = true;
      setupStage = 0;
      conversationHistory = [];

      // Sphere appears AFTER 13s boot phase finishes
      hideInfinityVideo();

      // After bootup: Samantha says ONLY “Hi, I'm Samantha.”
      if (profile.name === 'Samantha') {
        await speakWithVoice("Hi, I'm Samantha.", selectedVoice, selectedVoiceProfile);
      } else if (profile.name === 'Samuel') {
        // keep Samuel minimal too (optional)
        await speakWithVoice("Hi, I'm Samuel.", selectedVoice, selectedVoiceProfile);
      }
    }
  } catch (error) {
    console.error('❌ Continue setup failed:', error);
    enableListening();
  }
}

function handleSetupResponse(response) {
  console.log(`📋 Setup stage ${setupStage} response:`, response);

  // Store responses for personality analysis
  if (setupStage === 1) {
    userResponses.social = response;
    console.log('💾 Stored social response:', userResponses.social);
  } else if (setupStage === 2) {
    userResponses.mother = response;
    console.log('💾 Stored mother response:', userResponses.mother);
  } else if (setupStage === 3) {
    userResponses.voicePreference = response;
    console.log('💾 Stored voice preference:', userResponses.voicePreference);
  }

  document.getElementById('talkBtn').disabled = true;
  document.getElementById('talkBtn').textContent = 'Installing...';

  // Longer delay on mobile to prevent jittering
  setTimeout(() => {
    continueSetup();
  }, isMobile ? 1000 : 600);
}

async function getAIResponse(userMessage) {
  console.log('🤖 User said:', userMessage);
  console.log('🗣️ Using voice profile:', selectedVoiceProfile);

  conversationHistory.push({ role: 'user', content: userMessage });

  document.getElementById('visualizer').classList.add('listening');
  document.getElementById('talkBtn').disabled = true;
  document.getElementById('talkBtn').textContent = 'Thinking...';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are an AI companion. Keep responses natural and conversational (2-4 sentences).'
          },
          ...conversationHistory
        ],
        voiceProfile: selectedVoiceProfile
      })
    });

    if (!response.ok) throw new Error(`API failed: ${response.status}`);

    const data = await response.json();
    console.log('✅ AI response:', data.message);

    conversationHistory.push({ role: 'assistant', content: data.message });

    await speakWithVoice(data.message, selectedVoice, selectedVoiceProfile);

  } catch (error) {
    console.error('❌ Error:', error);
    document.getElementById('visualizer').classList.remove('listening');
    document.getElementById('talkBtn').disabled = false;
    document.getElementById('talkBtn').textContent = 'Hold to Talk';
  }
}

async function speakWithVoice(text, voiceType, voiceProfile = null) {
  console.log(`🔊 Speaking with voice type: ${voiceType}, profile: ${voiceProfile}`);

  // Stop any existing audio to prevent overlapping
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
      currentAudioSource.disconnect();
      currentAudioSource = null;
      await sleep(100);
    } catch (e) {
      console.log('Audio cleanup error:', e);
    }
  }

  // Play notification sound before AI speaks (only after setup is complete)
  if (setupComplete && voiceType !== 'setup') {
    playNotificationSound();
    await sleep(400);
  }

  document.getElementById('visualizer').classList.add('listening');
  document.getElementById('talkBtn').disabled = true;
  document.getElementById('talkBtn').textContent = voiceType === 'setup' ? 'Installing...' : 'Speaking...';

  try {
    // Ensure audio context exists and is running
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('📱 Created audio context in speakWithVoice');
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
      console.log('📱 Resumed audio context');
      if (isMobile) await sleep(500);
    }

    // Prepare text for TTS (strip ALL actions/interjections)
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
    console.log('✅ Received audio data');

    const binaryString = atob(data.audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('📦 Decoding audio...');
    let audioBuffer;
    try {
      // Make a copy of the buffer for iOS
      const audioData = bytes.buffer.slice(0);
      audioBuffer = await audioContext.decodeAudioData(audioData);
      console.log('✅ Audio decoded successfully');
    } catch (decodeError) {
      console.error('❌ Audio decode error:', decodeError);
      // Try recreating context
      audioContext.close();
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();
      const audioData = bytes.buffer.slice(0);
      audioBuffer = await audioContext.decodeAudioData(audioData);
    }

    // Create fresh buffer source
    currentAudioSource = audioContext.createBufferSource();
    currentAudioSource.buffer = audioBuffer;
    currentAudioSource.connect(audioContext.destination);

    return new Promise((resolve) => {
      currentAudioSource.onended = () => {
        console.log('✅ Finished speaking');
        currentAudioSource = null;
        document.getElementById('visualizer').classList.remove('listening');

        if (setupComplete) {
          document.getElementById('talkBtn').disabled = false;
          document.getElementById('talkBtn').textContent = 'Hold to Talk';
        }

        resolve();
      };

      currentAudioSource.start(0);
      console.log(`▶️ Playing audio (${audioBuffer.duration.toFixed(1)}s)`);
    });

  } catch (error) {
    console.error('❌ Speech error:', error);
    currentAudioSource = null;
    document.getElementById('visualizer').classList.remove('listening');

    if (setupComplete) {
      document.getElementById('talkBtn').disabled = false;
      document.getElementById('talkBtn').textContent = 'Hold to Talk';
    } else if (!setupStarted) {
      document.getElementById('talkBtn').disabled = false;
      document.getElementById('talkBtn').textContent = 'Start OS1';
    }

    throw error;
  }
}

/* ===================== Strict 13s boot phase helpers ====================== */
// Speed up infinity animation while boot audio plays
function speedInfinity(isFast) {
  const container = document.getElementById('infinityContainer');
  const video = document.getElementById('infinityVideo'); // optional <video>
  if (container) container.classList.toggle('fast', isFast);
  if (video && typeof video.playbackRate === 'number') {
    video.playbackRate = isFast ? 1.6 : 1.0;
  }
  document.documentElement.style.setProperty('--infinity-speed', isFast ? '0.4s' : '1s');
}

// Play the bootup audio (if present), but ALWAYS run for exactly 13s.
// Even if the audio ends early, we wait out the timer so Samantha won't speak early.
async function bootPhaseStrict13s() {
  const el = document.getElementById('bootupSound');
  const DURATION_MS = 13000;

  speedInfinity(true);

  const playPromise = (el && typeof el.play === 'function')
    ? el.play().then(() => { bootupAudioPlaying = true; }).catch(err => {
        console.log('Bootup sound blocked/failed:', err);
        bootupAudioPlaying = false;
      })
    : Promise.resolve();

  // Run a strict 13s timer
  await Promise.all([
    playPromise,
    new Promise(resolve => setTimeout(resolve, DURATION_MS))
  ]);

  // Stop/cleanup audio if still playing
  if (el && bootupAudioPlaying) {
    try {
      el.pause();
      el.currentTime = 0;
    } catch (e) {}
    bootupAudioPlaying = false;
  }

  speedInfinity(false);
  console.log('⏱️ Boot phase complete after 13s');
}
/* ========================================================================= */

// Notification sound before AI speaks
function playNotificationSound() {
  const notificationAudio = document.getElementById('notificationSound');
  if (notificationAudio) {
    notificationAudio.play().catch(e => console.log('Notification sound blocked:', e));
    console.log('🔔 Playing notification sound');
  }
}

// Infinity animation controls
function showInfinityVideo() {
  const infinityContainer = document.getElementById('infinityContainer');
  const visualizer = document.getElementById('visualizer');
  const progressContainer = document.getElementById('progressContainer');

  // Hide the pulse visualizer (sphere) during boot
  visualizer.classList.remove('active');

  // Show infinity animation and progress bar
  infinityContainer.classList.add('active');
  infinityContainer.classList.add('bootup');
  progressContainer.classList.add('active');

  console.log('∞ Infinity animation shown (bootup mode)');
}

function hideInfinityVideo() {
  const infinityContainer = document.getElementById('infinityContainer');
  const visualizer = document.getElementById('visualizer');
  const progressContainer = document.getElementById('progressContainer');

  // Hide infinity animation and progress
  infinityContainer.classList.remove('active');
  infinityContainer.classList.remove('bootup');
  infinityContainer.classList.remove('fast'); // ensure fast mode cleared
  progressContainer.classList.remove('active');

  // Show the pulse visualizer (sphere) AFTER boot phase — smooth transition
  setTimeout(() => {
    visualizer.classList.add('active');
  }, 300);

  console.log('∞ Infinity animation hidden, sphere shown');
}

function enableListening() {
  console.log('✅ Enabling listening for stage:', setupStage);
  document.getElementById('talkBtn').disabled = false;
  document.getElementById('talkBtn').textContent = 'Hold to Answer';
}

function updateProgress(percent, text) {
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  progressBar.style.width = percent + '%';
  progressText.textContent = text;
  console.log(`📊 Progress: ${percent}% - ${text}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startHolding(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  console.log('👆 Button pressed');

  if (!setupStarted && !setupComplete && setupStage === 0) {
    console.log('🎬 Initiating setup...');
    startSetup();
    return;
  }

  if (currentAudioSource) {
    console.log('⚠️ Wait for voice to finish');
    return;
  }

  if (!setupComplete && setupStage === 0) {
    console.log('⚠️ Setup not ready yet');
    return;
  }

  if (isHolding) {
    console.log('⚠️ Already holding');
    return;
  }

  console.log('🎙️ Start listening...');
  isHolding = true;
  currentTranscript = '';

  document.getElementById('talkBtn').classList.add('holding');
  document.getElementById('talkBtn').textContent = 'Listening...';
  document.getElementById('visualizer').classList.add('listening');

  if (navigator.vibrate) navigator.vibrate(50);

  try {
    recognition.start();
  } catch (e) {
    console.log('Recognition already started');
  }
}

function stopHolding(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (!isHolding) return;

  console.log('🛑 Stop listening');
  isHolding = false;

  document.getElementById('talkBtn').classList.remove('holding');
  document.getElementById('talkBtn').textContent = 'Processing...';

  if (navigator.vibrate) navigator.vibrate(30);

  try {
    recognition.stop();
  } catch (e) { }

  setTimeout(() => {
    const finalTranscript = currentTranscript.trim();
    console.log('📝 Final transcript:', finalTranscript);

    if (finalTranscript) {
      document.getElementById('visualizer').classList.remove('listening');

      if (!setupComplete && setupStage > 0) {
        handleSetupResponse(finalTranscript);
      } else if (setupComplete) {
        getAIResponse(finalTranscript);
      }
    } else {
      document.getElementById('visualizer').classList.remove('listening');

      if (setupStage > 0) {
        document.getElementById('talkBtn').textContent = 'Hold to Answer';
        document.getElementById('talkBtn').disabled = false;
      } else if (setupComplete) {
        document.getElementById('talkBtn').textContent = 'Hold to Talk';
        document.getElementById('talkBtn').disabled = false;
      }
    }
  }, 600);
}

function handleSpeechResult(event) {
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript;
    if (event.results[i].isFinal) {
      currentTranscript += transcript + ' ';
      console.log('✅ Captured:', transcript);
    }
  }
}

function handleSpeechEnd() {
  if (isHolding) {
    try {
      recognition.start();
    } catch (e) { }
  }
}

document.addEventListener('contextmenu', (e) => e.preventDefault());

// Mobile-optimized touch handlers - moved to initialize()
window.onload = () => {
  console.log('🚀 Page loaded');

  // Set viewport height for mobile browsers
  const setVH = () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', setVH);

  initialize();
};
