let recognition;
let isHolding = false;
let conversationHistory = [];
let synth = window.speechSynthesis;
let femaleVoice = null;
let currentTranscript = '';
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let voicesLoaded = false;
let hasGreeted = false;

function initialize() {
    console.log('🎤 Initializing OS1...');
    console.log('📱 Mobile:', isMobile);
    
    // Speech Recognition
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = handleSpeechResult;
        recognition.onerror = (e) => {
            console.error('❌ Recognition error:', e.error);
            if (e.error === 'not-allowed') {
                alert('Please allow microphone access');
            }
        };
        recognition.onend = handleSpeechEnd;
        console.log('✅ Speech recognition ready');
    } else {
        alert('❌ Speech recognition not supported. Use Chrome or Safari!');
        return;
    }

    // Force load voices
    loadVoices();
    
    const voiceInterval = setInterval(() => {
        loadVoices();
        if (voicesLoaded) {
            clearInterval(voiceInterval);
        }
    }, 100);
    
    setTimeout(() => clearInterval(voiceInterval), 3000);
    
    // Enable button
    setTimeout(() => {
        document.getElementById('talkBtn').disabled = false;
        console.log('✅ Ready - Tap to begin');
    }, 1000);
}

function loadVoices() {
    const voices = synth.getVoices();
    
    if (voices.length > 0 && !voicesLoaded) {
        voicesLoaded = true;
        console.log('🔊 All voices:', voices.map(v => `${v.name} | ${v.lang} | ${v.localService ? 'Local' : 'Network'}`));
        
        // ULTRA PREMIUM VOICES - Most human-like
        femaleVoice = 
            // iOS Premium Neural Voices (BEST)
            voices.find(v => v.name === 'Samantha (Enhanced)') ||
            voices.find(v => v.name === 'Ava (Premium)') ||
            voices.find(v => v.name === 'Nicky') ||
            voices.find(v => v.name === 'Samantha') ||
            voices.find(v => v.name === 'Ava') ||
            voices.find(v => v.name === 'Susan') ||
            voices.find(v => v.name === 'Allison') ||
            voices.find(v => v.name === 'Zoe') ||
            
            // Google Neural/Wavenet Voices (HIGHEST QUALITY)
            voices.find(v => v.name.includes('Google US English Female') && v.name.includes('Wavenet')) ||
            voices.find(v => v.name.includes('en-US-Wavenet-F')) ||
            voices.find(v => v.name.includes('en-US-Wavenet-C')) ||
            voices.find(v => v.name.includes('en-US-Wavenet-E')) ||
            voices.find(v => v.name.includes('en-US-Neural2-F')) ||
            voices.find(v => v.name.includes('en-US-Neural2-C')) ||
            voices.find(v => v.name.includes('en-US-Neural2-E')) ||
            voices.find(v => v.name.includes('Google US English Female')) ||
            voices.find(v => v.name.includes('en-us-x-sfg-network')) ||
            voices.find(v => v.name.includes('en-us-x-tpf-network')) ||
            voices.find(v => v.name.includes('en-us-x-iob-network')) ||
            
            // Microsoft Azure Neural Voices (PREMIUM)
            voices.find(v => v.name.includes('Microsoft Aria Online (Natural)')) ||
            voices.find(v => v.name.includes('Microsoft Jenny Online (Natural)')) ||
            voices.find(v => v.name.includes('Microsoft Michelle Online (Natural)')) ||
            voices.find(v => v.name.includes('Microsoft Sonia Online (Natural)')) ||
            voices.find(v => v.name.includes('Natural') && v.lang === 'en-US') ||
            
            // Amazon Polly Neural Voices
            voices.find(v => v.name.includes('Joanna (Neural)')) ||
            voices.find(v => v.name.includes('Kendra (Neural)')) ||
            voices.find(v => v.name.includes('Kimberly (Neural)')) ||
            voices.find(v => v.name.includes('Salli (Neural)')) ||
            
            // Standard Premium voices
            voices.find(v => v.name === 'Karen' && v.lang === 'en-AU') ||
            voices.find(v => v.name.includes('Microsoft Zira Desktop') && v.lang === 'en-US') ||
            voices.find(v => v.name.toLowerCase().includes('female') && v.lang === 'en-US') ||
            voices.find(v => v.lang === 'en-US' && !v.localService) || // Prefer network voices
            voices.find(v => v.lang === 'en-US') ||
            voices.find(v => v.lang.startsWith('en')) ||
            voices[0];
        
        console.log('✅ Selected PREMIUM voice:', femaleVoice.name, '(' + femaleVoice.lang + ')', femaleVoice.localService ? '[Local]' : '[Network]');
    }
}

function speakIntroduction() {
    const intro = "Hello. I'm OS1. It's so nice to meet you. Can you tell me your name?";
    speak(intro);
}

function startHolding(event) {
    event?.preventDefault();
    
    // First tap plays intro, doesn't record
    if (!hasGreeted) {
        console.log('👋 Playing greeting...');
        hasGreeted = true;
        speakIntroduction();
        return;
    }
    
    // Don't start if AI is speaking
    if (synth.speaking) {
        console.log('⚠️ Wait for OS1 to finish speaking');
        return;
    }
    
    if (isHolding) {
        console.log('⚠️ Already listening');
        return;
    }
    
    console.log('🎙️ Start listening...');
    isHolding = true;
    currentTranscript = '';
    
    document.getElementById('talkBtn').classList.add('holding');
    document.getElementById('talkBtn').textContent = 'Listening...';
    document.getElementById('visualizer').classList.add('listening');
    
    // Haptic feedback
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }
    
    try {
        recognition.start();
    } catch (e) {
        console.log('Recognition start error:', e);
    }
}

function stopHolding(event) {
    event?.preventDefault();
    
    // Ignore if we haven't greeted yet
    if (!hasGreeted) return;
    
    if (!isHolding) return;
    
    console.log('🛑 Stop listening');
    isHolding = false;
    
    document.getElementById('talkBtn').classList.remove('holding');
    document.getElementById('talkBtn').textContent = 'Processing...';
    
    // Haptic feedback
    if (navigator.vibrate) {
        navigator.vibrate(30);
    }
    
    try {
        recognition.stop();
    } catch (e) {}
    
    // Wait for final speech results
    setTimeout(() => {
        const finalTranscript = currentTranscript.trim();
        if (finalTranscript) {
            console.log('📝 You said:', finalTranscript);
            document.getElementById('visualizer').classList.remove('listening');
            getAIResponse(finalTranscript);
        } else {
            console.log('⚠️ No speech detected');
            document.getElementById('visualizer').classList.remove('listening');
            document.getElementById('talkBtn').textContent = 'Hold to Talk';
        }
    }, 600);
}

function handleSpeechResult(event) {
    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            currentTranscript += transcript + ' ';
            console.log('📝 Captured:', transcript);
        }
    }
}

function handleSpeechEnd() {
    console.log('🔄 Recognition ended');
    if (isHolding) {
        try {
            recognition.start();
        } catch (e) {}
    } else {
        document.getElementById('visualizer').classList.remove('listening');
    }
}

async function getAIResponse(userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });
    console.log('🤖 Calling AI...');
    
    document.getElementById('visualizer').classList.add('listening');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are OS1, a warm, empathetic, curious AI companion with a gentle feminine personality. You genuinely care about the person you\'re talking to. Keep responses natural and conversational (2-4 sentences). Show genuine interest and emotional intelligence. Be thoughtful, kind, and speak like a caring friend having an intimate conversation.'
                    },
                    ...conversationHistory
                ]
            })
        });

        if (!response.ok) {
            throw new Error('API request failed: ' + response.status);
        }

        const data = await response.json();
        console.log('💬 AI Response:', data.message);
        
        conversationHistory.push({ role: 'assistant', content: data.message });
        
        // Small delay before speaking
        setTimeout(() => {
            speak(data.message);
        }, 300);

    } catch (error) {
        console.error('❌ Error:', error);
        speak("I'm sorry, I had trouble with that. Could you try again?");
    }
}

function speak(text) {
    console.log('🔊 Speaking:', text);
    
    // Cancel any ongoing speech
    synth.cancel();
    
    // Wait for cancel to complete
    setTimeout(() => {
        if (!voicesLoaded) {
            loadVoices();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // ULTRA-REALISTIC HUMAN VOICE SETTINGS
        utterance.voice = femaleVoice;
        utterance.lang = 'en-US';
        
        // Perfect human-like speech parameters
        utterance.rate = 0.85;      // Natural conversational pace
        utterance.pitch = 1.15;     // Warm, friendly feminine pitch
        utterance.volume = 1.0;     // Full volume
        
        console.log('🎤 Ultra-premium voice:', utterance.voice ? utterance.voice.name : 'default');
        
        utterance.onstart = () => {
            console.log('▶️ Speaking...');
            document.getElementById('visualizer').classList.add('listening');
            document.getElementById('talkBtn').disabled = true;
            document.getElementById('talkBtn').textContent = 'Speaking...';
        };

        utterance.onend = () => {
            console.log('⏹️ Speech finished');
            document.getElementById('visualizer').classList.remove('listening');
            document.getElementById('talkBtn').disabled = false;
            document.getElementById('talkBtn').textContent = 'Hold to Talk';
        };

        utterance.onerror = (e) => {
            console.error('❌ Speech error:', e);
            document.getElementById('visualizer').classList.remove('listening');
            document.getElementById('talkBtn').disabled = false;
            document.getElementById('talkBtn').textContent = 'Hold to Talk';
        };

        synth.speak(utterance);
        console.log('✅ Ultra-realistic speech queued');
        
    }, 200);
}

// Voice loading
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
        console.log('🔄 Voices changed');
        loadVoices();
    };
}

// Prevent context menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Prevent zoom on double tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Initialize
window.onload = () => {
    console.log('🚀 Page loaded');
    initialize();
    
    document.addEventListener('touchstart', () => {
        if (!voicesLoaded) {
            loadVoices();
        }
    }, { once: true });
};

loadVoices();
