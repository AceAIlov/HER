let recognition;
let isHolding = false;
let conversationHistory = [];
let synth = window.speechSynthesis;
let femaleVoice = null;
let currentTranscript = '';
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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
            // Auto-recover from common mobile errors
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

    // Load voices multiple times (important for mobile)
    loadVoices();
    setTimeout(loadVoices, 100);
    setTimeout(loadVoices, 500);
    setTimeout(loadVoices, 1000);
    setTimeout(loadVoices, 2000);
    
    // Enable button and start intro
    setTimeout(() => {
        document.getElementById('talkBtn').disabled = false;
        console.log('✅ Button enabled');
        
        // On mobile, wait for user interaction before speaking
        if (!isMobile) {
            setTimeout(() => speakIntroduction(), 500);
        } else {
            console.log('📱 Waiting for user tap to start...');
        }
    }, 1500);
}

function loadVoices() {
    const voices = synth.getVoices();
    console.log('🔊 Voices available:', voices.length);
    
    if (voices.length > 0) {
        // Better voice selection for mobile
        femaleVoice = voices.find(v => v.name.includes('Samantha')) || // iOS
                     voices.find(v => v.name.includes('Google US English Female')) || // Android
                     voices.find(v => v.name.includes('Karen')) ||
                     voices.find(v => v.name.includes('Female')) ||
                     voices.find(v => v.lang === 'en-US') ||
                     voices[0];
        
        console.log('✅ Voice:', femaleVoice?.name || 'Default');
    }
}

function speakIntroduction() {
    speak("Hello. I'm OS1. It's so nice to meet you. Can you tell me your name?");
}

function startHolding(event) {
    event?.preventDefault();
    
    // First tap on mobile triggers intro
    if (isMobile && conversationHistory.length === 0) {
        speakIntroduction();
        return;
    }
    
    if (isHolding || synth.speaking) return;
    
    console.log('🎙️ Start listening...');
    isHolding = true;
    currentTranscript = '';
    
    document.getElementById('talkBtn').classList.add('holding');
    document.getElementById('visualizer').classList.add('listening');
    
    // Prevent screen from sleeping on mobile
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(() => {});
    }
    
    try {
        recognition.start();
    } catch (e) {
        console.log('Recognition already started');
    }
}

function stopHolding(event) {
    event?.preventDefault();
    if (!isHolding) return;
    
    console.log('🛑 Stop listening');
    isHolding = false;
    
    document.getElementById('talkBtn').classList.remove('holding');
    
    try {
        recognition.stop();
    } catch (e) {}
    
    setTimeout(() => {
        if (currentTranscript.trim()) {
            console.log('📝 You said:', currentTranscript);
            document.getElementById('visualizer').classList.remove('listening');
            getAIResponse(currentTranscript.trim());
        } else {
            document.getElementById('visualizer').classList.remove('listening');
        }
    }, 300);
}

function handleSpeechResult(event) {
    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            currentTranscript += transcript + ' ';
        }
    }
}

function handleSpeechEnd() {
    if (isHolding) {
        try {
            recognition.start();
        } catch (e) {
            console.log('Could not restart recognition');
        }
    } else {
        document.getElementById('visualizer').classList.remove('listening');
    }
}

async function getAIResponse(userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });
    console.log('🤖 Asking AI...');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are OS1, a warm, empathetic AI companion with a gentle feminine personality. Keep responses brief (2-4 sentences). Be thoughtful, kind, and emotionally intelligent.'
                    },
                    ...conversationHistory
                ]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API request failed');
        }

        const data = await response.json();
        console.log('💬 AI said:', data.message);
        
        conversationHistory.push({ role: 'assistant', content: data.message });
        speak(data.message);

    } catch (error) {
        console.error('❌ Error:', error);
        speak('I apologize, I had trouble processing that. Could you try again?');
    }
}

function speak(text) {
    console.log('🔊 Speaking:', text);
    synth.cancel();
    
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = isMobile ? 0.9 : 0.95; // Slightly slower on mobile
        utterance.pitch = 1.05;
        utterance.volume = 1;
        utterance.lang = 'en-US';

        if (femaleVoice) {
            utterance.voice = femaleVoice;
        }

        utterance.onstart = () => {
            console.log('▶️ Speech started');
            document.getElementById('visualizer').classList.add('listening');
            document.getElementById('talkBtn').disabled = true;
        };

        utterance.onend = () => {
            console.log('⏹️ Speech ended');
            document.getElementById('visualizer').classList.remove('listening');
            document.getElementById('talkBtn').disabled = false;
        };

        utterance.onerror = (e) => {
            console.error('❌ Speech error:', e);
            document.getElementById('visualizer').classList.remove('listening');
            document.getElementById('talkBtn').disabled = false;
        };

        synth.speak(utterance);
    }, isMobile ? 200 : 100); // Longer delay on mobile
}

// Load voices
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
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

// Prevent pull-to-refresh
document.body.addEventListener('touchmove', (e) => {
    if (e.target === document.body) {
        e.preventDefault();
    }
}, { passive: false });

window.onload = initialize;
loadVoices();
