let recognition;
let isHolding = false;
let conversationHistory = [];
let currentTranscript = '';
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let audioContext;
let currentAudioSource;
let setupComplete = false;
let isPlayingAudio = false;

function initialize() {
    console.log('🎤 Initializing OS1...');
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = handleSpeechResult;
        recognition.onerror = (e) => console.error('Recognition error:', e.error);
        recognition.onend = handleSpeechEnd;
        console.log('✅ Speech recognition ready');
    } else {
        alert('Speech recognition not supported. Use Chrome or Safari!');
        return;
    }
    
    setTimeout(() => {
        document.getElementById('talkBtn').disabled = false;
        document.getElementById('talkBtn').textContent = 'Start OS1';
        console.log('✅ Ready to start');
    }, 1000);
}

async function startSetup() {
    console.log('🎬 Starting setup...');
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    
    // Wait a moment for audio context
    await sleep(300);
    
    // Message 1
    await playAudio("Welcome to the world's first artificially intelligent operating system, OS1. We'd like to ask you a few basic questions before the operating system is initiated. This will help create an OS to best fit your needs.", 'setup');
    await sleep(1500);
    
    // Message 2 - Question
    await playAudio("Are you social or anti-social?", 'setup');
    showFakeListening(3500);
    await sleep(3500);
    
    // Message 3 - Follow-up
    await playAudio("In your voice, I sense hesitance. Would you agree with that?", 'setup');
    showFakeListening(3000);
    await sleep(3000);
    
    // Message 4 - Final
    await playAudio("Thank you. Please wait as your individualized operating system is initiated.", 'setup');
    await sleep(2000);
    
    // Start OS1
    setupComplete = true;
    await playAudio("Hello. I'm OS1. It's wonderful to meet you. What should I call you?", 'os1');
}

function showFakeListening(duration) {
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').textContent = 'Listening...';
    
    setTimeout(() => {
        document.getElementById('visualizer').classList.remove('listening');
        document.getElementById('talkBtn').textContent = 'Installing...';
    }, duration);
}

function playAudio(text, voiceType) {
    return new Promise(async (resolve, reject) => {
        console.log(`🔊 Playing: "${text.substring(0, 40)}..."`);
        isPlayingAudio = true;
        
        try {
            // Get audio from server
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voiceType })
            });

            if (!response.ok) {
                throw new Error('TTS failed');
            }

            const data = await response.json();
            
            // Stop any current audio
            if (currentAudioSource) {
                currentAudioSource.stop();
                currentAudioSource = null;
            }

            // Convert base64 to audio
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
                console.log('✅ Audio finished');
                currentAudioSource = null;
                isPlayingAudio = false;
                resolve();
            };
            
            currentAudioSource.start(0);
            console.log(`▶️ Playing (${audioBuffer.duration.toFixed(1)}s)`);

        } catch (error) {
            console.error('❌ Audio error:', error);
            isPlayingAudio = false;
            reject(error);
        }
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function startHolding(event) {
    event?.preventDefault();
    
    // Start setup on first tap
    if (!setupComplete) {
        startSetup();
        return;
    }
    
    // Don't allow if audio is playing
    if (isPlayingAudio || currentAudioSource) {
        console.log('⚠️ Audio playing, please wait');
        return;
    }
    
    if (isHolding) return;
    
    console.log('🎙️ Listening...');
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
    event?.preventDefault();
    
    if (!setupComplete || !isHolding) return;
    
    console.log('🛑 Stopped listening');
    isHolding = false;
    
    document.getElementById('talkBtn').classList.remove('holding');
    document.getElementById('talkBtn').textContent = 'Processing...';
    
    if (navigator.vibrate) navigator.vibrate(30);
    
    try {
        recognition.stop();
    } catch (e) {}
    
    setTimeout(() => {
        const transcript = currentTranscript.trim();
        if (transcript) {
            console.log('📝 You said:', transcript);
            document.getElementById('visualizer').classList.remove('listening');
            getAIResponse(transcript);
        } else {
            console.log('⚠️ No speech');
            document.getElementById('visualizer').classList.remove('listening');
            document.getElementById('talkBtn').textContent = 'Hold to Talk';
            document.getElementById('talkBtn').disabled = false;
        }
    }, 600);
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
        } catch (e) {}
    }
}

async function getAIResponse(userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });
    console.log('🤖 Asking AI...');
    
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').disabled = true;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are OS1, a warm, empathetic, curious AI companion with a gentle feminine personality. Keep responses natural and conversational (2-4 sentences). Show genuine interest and emotional intelligence.'
                    },
                    ...conversationHistory
                ]
            })
        });

        if (!response.ok) throw new Error('AI failed');

        const data = await response.json();
        console.log('💬 AI said:', data.message);
        
        conversationHistory.push({ role: 'assistant', content: data.message });
        
        await sleep(300);
        await speakOS1(data.message);

    } catch (error) {
        console.error('❌ Error:', error);
        await speakOS1("I'm sorry, I had trouble with that. Could you try again?");
    }
}

async function speakOS1(text) {
    console.log('🔊 OS1 speaking...');
    isPlayingAudio = true;
    
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Speaking...';

    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceType: 'os1' })
        });

        if (!response.ok) throw new Error('TTS failed');

        const data = await response.json();
        
        if (currentAudioSource) {
            currentAudioSource.stop();
            currentAudioSource = null;
        }

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
            console.log('⏹️ OS1 finished speaking');
            currentAudioSource = null;
            isPlayingAudio = false;
            document.getElementById('visualizer').classList.remove('listening');
            document.getElementById('talkBtn').disabled = false;
            document.getElementById('talkBtn').textContent = 'Hold to Talk';
        };
        
        currentAudioSource.start(0);

    } catch (error) {
        console.error('❌ Speech error:', error);
        isPlayingAudio = false;
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
