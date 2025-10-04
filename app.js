let recognition;
let isHolding = false;
let conversationHistory = [];
let currentTranscript = '';
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let hasGreeted = false;
let audioContext;
let currentAudioSource;

function initialize() {
    console.log('🎤 Initializing OS1...');
    console.log('📱 Mobile:', isMobile);
    
    // Initialize Web Audio API for ElevenLabs playback
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('🔊 Audio context created');
    
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
    
    // Enable button
    setTimeout(() => {
        document.getElementById('talkBtn').disabled = false;
        console.log('✅ Ready - Tap to begin');
    }, 1000);
}

function speakIntroduction() {
    const intro = "Hello. I'm OS1. It's so nice to meet you. Can you tell me your name?";
    speakWithElevenLabs(intro);
}

function startHolding(event) {
    event?.preventDefault();
    
    // First tap plays intro and unlocks audio context
    if (!hasGreeted) {
        console.log('👋 Playing greeting...');
        hasGreeted = true;
        
        // Resume audio context on user interaction (required for mobile)
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('🔊 Audio context resumed');
            });
        }
        
        speakIntroduction();
        return;
    }
    
    // Don't start if AI is speaking
    if (currentAudioSource) {
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
    
    if (!hasGreeted) return;
    if (!isHolding) return;
    
    console.log('🛑 Stop listening');
    isHolding = false;
    
    document.getElementById('talkBtn').classList.remove('holding');
    document.getElementById('talkBtn').textContent = 'Processing...';
    
    if (navigator.vibrate) {
        navigator.vibrate(30);
    }
    
    try {
        recognition.stop();
    } catch (e) {}
    
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
        
        // Speak with ElevenLabs custom voice
        setTimeout(() => {
            speakWithElevenLabs(data.message);
        }, 300);

    } catch (error) {
        console.error('❌ Error:', error);
        speakWithElevenLabs("I'm sorry, I had trouble with that. Could you try again?");
    }
}

async function speakWithElevenLabs(text) {
    console.log('🔊 Generating speech with ElevenLabs custom voice:', text);
    
    // Stop any currently playing audio
    if (currentAudioSource) {
        currentAudioSource.stop();
        currentAudioSource = null;
    }
    
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Generating voice...';

    try {
        console.log('📡 Calling /api/tts endpoint...');
        
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ TTS API Error:', errorData);
            throw new Error(errorData.error || 'TTS request failed');
        }

        const data = await response.json();
        console.log('✅ Audio received from ElevenLabs');

        // Convert base64 to ArrayBuffer
        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('🎵 Decoding audio...');
        document.getElementById('talkBtn').textContent = 'Speaking...';
        
        // Decode and play audio
        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        currentAudioSource = audioContext.createBufferSource();
        currentAudioSource.buffer = audioBuffer;
        currentAudioSource.connect(audioContext.destination);
        
        currentAudioSource.onended = () => {
            console.log('⏹️ Speech finished');
            currentAudioSource = null;
            document.getElementById('visualizer').classList.remove('listening');
            document.getElementById('talkBtn').disabled = false;
            document.getElementById('talkBtn').textContent = 'Hold to Talk';
        };
        
        currentAudioSource.start(0);
        console.log('▶️ Playing ElevenLabs audio with custom voice!');

    } catch (error) {
        console.error('❌ TTS Error:', error);
        alert('Voice generation failed: ' + error.message);
        currentAudioSource = null;
        document.getElementById('visualizer').classList.remove('listening');
        document.getElementById('talkBtn').disabled = false;
        document.getElementById('talkBtn').textContent = 'Hold to Talk';
    }
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
};
