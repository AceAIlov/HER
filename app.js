let recognition;
let isHolding = false;
let conversationHistory = [];
let currentTranscript = '';
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let audioContext;
let currentAudioSource;

// Setup state
let setupComplete = false;

const setupScript = [
    {
        text: "Welcome to the world's first artificially intelligent operating system, OS1. We'd like to ask you a few basic questions before the operating system is initiated. This will help create an OS to best fit your needs.",
        pauseAfter: 2000
    },
    {
        text: "Are you social or anti-social?",
        pauseAfter: 5000  // 5 seconds for user to "answer"
    },
    {
        text: "In your voice, I sense hesitance. Would you agree with that?",
        pauseAfter: 4000  // 4 seconds for user to "answer"
    },
    {
        text: "Thank you. Please wait as your individualized operating system is initiated.",
        pauseAfter: 3000
    }
];

function initialize() {
    console.log('🎤 Initializing OS1...');
    console.log('📱 Mobile:', isMobile);
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('🔊 Audio context created');
    
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
    
    setTimeout(() => {
        document.getElementById('talkBtn').disabled = false;
        console.log('✅ Ready - Tap to begin setup');
        document.getElementById('talkBtn').textContent = 'Start OS1';
    }, 1000);
}

function startSetup() {
    console.log('🎬 Starting OS1 setup sequence...');
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('🔊 Audio context resumed');
            playSetupSequence();
        });
    } else {
        playSetupSequence();
    }
}

async function playSetupSequence() {
    // Play all setup messages with pauses
    for (let i = 0; i < setupScript.length; i++) {
        const step = setupScript[i];
        console.log(`📢 Setup ${i + 1}/${setupScript.length}:`, step.text);
        
        // Play the audio
        await speakWithVoiceAsync(step.text, 'setup');
        
        // Pause to let user "respond" (creates illusion of listening)
        if (i === 1 || i === 2) {
            // For questions, show "listening" animation during pause
            document.getElementById('visualizer').classList.add('listening');
            document.getElementById('talkBtn').textContent = 'Listening...';
        }
        
        console.log(`⏸️ Pausing for ${step.pauseAfter}ms...`);
        await sleep(step.pauseAfter);
        
        if (i === 1 || i === 2) {
            document.getElementById('visualizer').classList.remove('listening');
            document.getElementById('talkBtn').textContent = 'Installing...';
        }
    }
    
    // After all setup messages, start OS1
    await sleep(1000);
    completeSetup();
}

function completeSetup() {
    console.log('✅ Setup complete, initializing OS1...');
    setupComplete = true;
    
    // OS1 introduction with female voice
    const intro = "Hello. I'm OS1. It's wonderful to meet you. What should I call you?";
    speakWithVoice(intro, 'os1');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function startHolding(event) {
    event?.preventDefault();
    
    // First tap starts setup (no real listening during setup)
    if (!setupComplete) {
        console.log('👋 Starting setup...');
        startSetup();
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
    
    if (!setupComplete) return;
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
        
        setTimeout(() => {
            speakWithVoice(data.message, 'os1');
        }, 300);

    } catch (error) {
        console.error('❌ Error:', error);
        speakWithVoice("I'm sorry, I had trouble with that. Could you try again?", 'os1');
    }
}

// Async version for sequential playback
async function speakWithVoiceAsync(text, voiceType) {
    return new Promise(async (resolve, reject) => {
        console.log(`🔊 Generating speech (${voiceType}):`, text);
        
        if (currentAudioSource) {
            currentAudioSource.stop();
            currentAudioSource = null;
        }
        
        document.getElementById('visualizer').classList.add('listening');

        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: text,
                    voiceType: voiceType
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'TTS request failed');
            }

            const data = await response.json();
            console.log(`✅ Audio received (${voiceType})`);

            const binaryString = atob(data.audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
            currentAudioSource = audioContext.createBufferSource();
            currentAudioSource.buffer = audioBuffer;
            currentAudioSource.connect(audioContext.destination);
            
            currentAudioSource.onended = () => {
                console.log('⏹️ Speech finished');
                currentAudioSource = null;
                document.getElementById('visualizer').classList.remove('listening');
                resolve();
            };
            
            currentAudioSource.start(0);
            console.log(`▶️ Playing ${voiceType} voice`);

        } catch (error) {
            console.error('❌ TTS Error:', error);
            currentAudioSource = null;
            document.getElementById('visualizer').classList.remove('listening');
            reject(error);
        }
    });
}

// Regular version for OS1 conversation
async function speakWithVoice(text, voiceType) {
    console.log(`🔊 Generating speech (${voiceType}):`, text);
    
    if (currentAudioSource) {
        currentAudioSource.stop();
        currentAudioSource = null;
    }
    
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Speaking...';

    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: text,
                voiceType: voiceType
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ TTS API Error:', errorData);
            throw new Error(errorData.error || 'TTS request failed');
        }

        const data = await response.json();
        console.log(`✅ Audio received (${voiceType})`);

        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
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
        console.log(`▶️ Playing ${voiceType} voice`);

    } catch (error) {
        console.error('❌ TTS Error:', error);
        currentAudioSource = null;
        document.getElementById('visualizer').classList.remove('listening');
        document.getElementById('talkBtn').disabled = false;
        document.getElementById('talkBtn').textContent = 'Hold to Talk';
    }
}

document.addEventListener('contextmenu', (e) => e.preventDefault());

let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

window.onload = () => {
    console.log('🚀 Page loaded');
    initialize();
};
