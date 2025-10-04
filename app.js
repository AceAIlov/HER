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
    console.log('Audio context state:', audioContext.state);
    
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

function startSetup() {
    console.log('🎬 Starting setup...');
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    // Resume audio context first
    if (audioContext.state === 'suspended') {
        console.log('Resuming audio context...');
        audioContext.resume().then(() => {
            console.log('✅ Audio context resumed');
            setTimeout(() => runSetupSequence(), 500);
        }).catch(err => {
            console.error('❌ Failed to resume audio:', err);
            alert('Audio failed to start. Please refresh and try again.');
        });
    } else {
        setTimeout(() => runSetupSequence(), 500);
    }
}

function runSetupSequence() {
    console.log('📢 Running setup sequence...');
    
    // Message 1
    playAudio(
        "Welcome to the world's first artificially intelligent operating system, OS1. We'd like to ask you a few basic questions before the operating system is initiated. This will help create an OS to best fit your needs.",
        'setup',
        () => {
            setTimeout(() => {
                // Message 2
                playAudio(
                    "Are you social or anti-social?",
                    'setup',
                    () => {
                        showFakeListening(3500);
                        setTimeout(() => {
                            // Message 3
                            playAudio(
                                "In your voice, I sense hesitance. Would you agree with that?",
                                'setup',
                                () => {
                                    showFakeListening(3000);
                                    setTimeout(() => {
                                        // Message 4
                                        playAudio(
                                            "Thank you. Please wait as your individualized operating system is initiated.",
                                            'setup',
                                            () => {
                                                setTimeout(() => {
                                                    // Start OS1
                                                    setupComplete = true;
                                                    playAudio(
                                                        "Hello. I'm OS1. It's wonderful to meet you. What should I call you?",
                                                        'os1',
                                                        () => {
                                                            console.log('✅ Setup complete!');
                                                        }
                                                    );
                                                }, 2000);
                                            }
                                        );
                                    }, 3000);
                                }
                            );
                        }, 3500);
                    }
                );
            }, 1500);
        }
    );
}

function showFakeListening(duration) {
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').textContent = 'Listening...';
    
    setTimeout(() => {
        document.getElementById('visualizer').classList.remove('listening');
        document.getElementById('talkBtn').textContent = 'Installing...';
    }, duration);
}

function playAudio(text, voiceType, callback) {
    console.log(`🔊 Requesting audio: "${text.substring(0, 40)}..." (${voiceType})`);
    isPlayingAudio = true;
    
    fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceType })
    })
    .then(response => {
        console.log('TTS response status:', response.status);
        if (!response.ok) {
            throw new Error('TTS request failed: ' + response.status);
        }
        return response.json();
    })
    .then(data => {
        console.log('✅ Audio data received');
        
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
        
        console.log(`🎵 Decoding ${bytes.length} bytes...`);
        return audioContext.decodeAudioData(bytes.buffer);
    })
    .then(audioBuffer => {
        console.log(`✅ Audio decoded (${audioBuffer.duration.toFixed(1)}s)`);
        
        currentAudioSource = audioContext.createBufferSource();
        currentAudioSource.buffer = audioBuffer;
        currentAudioSource.connect(audioContext.destination);
        
        currentAudioSource.onended = () => {
            console.log('⏹️ Audio playback finished');
            currentAudioSource = null;
            isPlayingAudio = false;
            if (callback) callback();
        };
        
        currentAudioSource.start(0);
        console.log('▶️ Playing audio...');
    })
    .catch(error => {
        console.error('❌ Audio error:', error);
        isPlayingAudio = false;
        alert('Audio playback failed: ' + error.message + '\n\nCheck console for details.');
        if (callback) callback(); // Continue anyway
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function startHolding(event) {
    event?.preventDefault();
    
    // Start setup on first tap
    if (!setupComplete) {
        console.log('👋 Starting setup...');
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

function getAIResponse(userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });
    console.log('🤖 Asking AI...');
    
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').disabled = true;

    fetch('/api/chat', {
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
    })
    .then(response => {
        if (!response.ok) throw new Error('AI failed');
        return response.json();
    })
    .then(data => {
        console.log('💬 AI said:', data.message);
        conversationHistory.push({ role: 'assistant', content: data.message });
        
        setTimeout(() => {
            speakOS1(data.message);
        }, 300);
    })
    .catch(error => {
        console.error('❌ Error:', error);
        speakOS1("I'm sorry, I had trouble with that. Could you try again?");
    });
}

function speakOS1(text) {
    console.log('🔊 OS1 speaking...');
    isPlayingAudio = true;
    
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Speaking...';

    fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceType: 'os1' })
    })
    .then(response => {
        if (!response.ok) throw new Error('TTS failed');
        return response.json();
    })
    .then(data => {
        if (currentAudioSource) {
            currentAudioSource.stop();
            currentAudioSource = null;
        }

        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        return audioContext.decodeAudioData(bytes.buffer);
    })
    .then(audioBuffer => {
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
    })
    .catch(error => {
        console.error('❌ Speech error:', error);
        isPlayingAudio = false;
        document.getElementById('visualizer').classList.remove('listening');
        document.getElementById('talkBtn').disabled = false;
        document.getElementById('talkBtn').textContent = 'Hold to Talk';
    });
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
