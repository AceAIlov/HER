let recognition;
let isHolding = false;
let conversationHistory = [];
let currentTranscript = '';
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let audioContext;
let currentAudioSource;
let setupComplete = false;
let setupStage = 0;
let selectedVoice = 'female';
let audioUnlocked = false;

function initialize() {
    console.log('🎤 Initializing OS1...');
    console.log('📱 Mobile:', isMobile);
    
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
        console.log('✅ Ready - Tap to begin');
        document.getElementById('talkBtn').textContent = 'Start OS1';
    }, 1000);
}

function unlockAudio() {
    if (audioUnlocked) return Promise.resolve();
    
    console.log('🔓 Unlocking audio for mobile...');
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('🔊 Audio context created');
    }
    
    return audioContext.resume().then(() => {
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        audioUnlocked = true;
        console.log('✅ Audio unlocked, state:', audioContext.state);
        return Promise.resolve();
    }).catch(err => {
        console.error('❌ Failed to unlock audio:', err);
        return Promise.reject(err);
    });
}

function startSetup() {
    console.log('👋 Starting setup...');
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    unlockAudio().then(() => {
        setTimeout(() => runSetup(), 500);
    }).catch(err => {
        alert('Audio initialization failed. Please refresh and try again.');
        console.error('Audio unlock error:', err);
    });
}

async function runSetup() {
    console.log('📢 Running setup sequence...');
    
    await speakWithVoice(
        "Welcome to the world's first artificially intelligent operating system, OS1. We'd like to ask you a few basic questions before the operating system is initiated. This will help create an OS to best fit your needs.",
        'setup'
    );
    
    await sleep(1500);
    
    await speakWithVoice("Are you social or anti-social?", 'setup');
    setupStage = 1;
    enableListening();
}

async function continueSetup() {
    if (setupStage === 1) {
        await speakWithVoice("How's your relationship with your mother?", 'setup');
        setupStage = 2;
        enableListening();
        
    } else if (setupStage === 2) {
        await speakWithVoice("Thank you. Please wait as your individualized operating system is initiated.", 'setup');
        await sleep(2000);
        
        await speakWithVoice("Would you like a male or female voice?", 'setup');
        setupStage = 3;
        enableListening();
        
    } else if (setupStage === 3) {
        setupComplete = true;
        setupStage = 0;
        
        console.log('🎤 Final selected voice:', selectedVoice);
        
        await speakWithVoice("Hi. How are you?", selectedVoice);
    }
}

function enableListening() {
    document.getElementById('talkBtn').disabled = false;
    document.getElementById('talkBtn').textContent = 'Hold to Answer';
    console.log('✅ Ready for user response');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function startHolding(event) {
    event?.preventDefault();
    
    if (!setupComplete && setupStage === 0) {
        startSetup();
        return;
    }
    
    if (currentAudioSource) {
        console.log('⚠️ Wait for voice to finish');
        return;
    }
    
    if (isHolding) return;
    
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
        console.log('Recognition start error:', e);
    }
}

function stopHolding(event) {
    event?.preventDefault();
    
    if (!isHolding) return;
    
    console.log('🛑 Stop listening');
    isHolding = false;
    
    document.getElementById('talkBtn').classList.remove('holding');
    document.getElementById('talkBtn').textContent = 'Processing...';
    
    if (navigator.vibrate) navigator.vibrate(30);
    
    try {
        recognition.stop();
    } catch (e) {}
    
    setTimeout(() => {
        const finalTranscript = currentTranscript.trim();
        if (finalTranscript) {
            console.log('📝 You said:', finalTranscript);
            document.getElementById('visualizer').classList.remove('listening');
            
            if (!setupComplete && setupStage > 0) {
                handleSetupResponse(finalTranscript);
            } else if (setupComplete) {
                getAIResponse(finalTranscript);
            }
        } else {
            console.log('⚠️ No speech detected');
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

function handleSetupResponse(response) {
    console.log(`📝 Setup stage ${setupStage} response:`, response);
    
    if (setupStage === 3) {
        // Voice selection - be more flexible in detection
        const lowerResponse = response.toLowerCase();
        
        console.log('🔍 Analyzing response:', lowerResponse);
        
        // Check for male keywords
        if (lowerResponse.includes('male') || lowerResponse.includes('man') || 
            lowerResponse.includes('boy') || lowerResponse.includes('guy') || 
            lowerResponse.includes('dude') || lowerResponse.includes('him')) {
            
            // Make sure it's not "female"
            if (!lowerResponse.includes('female') && !lowerResponse.includes('woman')) {
                selectedVoice = 'male';
                console.log('✅ DETECTED: Male voice selected');
            } else {
                selectedVoice = 'female';
                console.log('✅ DETECTED: Female voice selected (contained both, defaulted to female)');
            }
        } else if (lowerResponse.includes('female') || lowerResponse.includes('woman') || 
                   lowerResponse.includes('girl') || lowerResponse.includes('lady') || 
                   lowerResponse.includes('her')) {
            selectedVoice = 'female';
            console.log('✅ DETECTED: Female voice selected');
        } else {
            // Default to female if unclear
            selectedVoice = 'female';
            console.log('⚠️ Unclear response, defaulting to female voice');
        }
        
        console.log('🎯 FINAL SELECTION:', selectedVoice);
    }
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    setTimeout(() => {
        continueSetup();
    }, 800);
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
    console.log('🤖 Calling AI with message:', userMessage);
    console.log('🗣️ Using voice:', selectedVoice);
    
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
                        content: 'You are OS1, a warm, empathetic, curious AI companion with a gentle personality. You genuinely care about the person you\'re talking to. Keep responses natural and conversational (2-4 sentences). Show genuine interest and emotional intelligence. Be thoughtful, kind, and speak like a caring friend having an intimate conversation.'
                    },
                    ...conversationHistory
                ]
            })
        });

        console.log('📡 API response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ API error:', errorData);
            throw new Error('API request failed: ' + response.status);
        }

        const data = await response.json();
        console.log('💬 AI Response:', data.message);
        
        conversationHistory.push({ role: 'assistant', content: data.message });
        
        setTimeout(() => {
            speakWithVoice(data.message, selectedVoice);
        }, 300);

    } catch (error) {
        console.error('❌ Full Error:', error);
        document.getElementById('visualizer').classList.remove('listening');
        document.getElementById('talkBtn').disabled = false;
        document.getElementById('talkBtn').textContent = 'Hold to Talk';
        
        // Don't say "sorry" - just log the error
        alert('Error: ' + error.message + '\n\nCheck console for details.');
    }
}

async function speakWithVoice(text, voiceType) {
    console.log(`🔊 Generating speech (${voiceType}):`, text.substring(0, 40) + '...');
    
    if (currentAudioSource) {
        try {
            currentAudioSource.stop();
        } catch (e) {}
        currentAudioSource = null;
    }
    
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').disabled = true;
    
    if (voiceType === 'setup') {
        document.getElementById('talkBtn').textContent = 'Installing...';
    } else {
        document.getElementById('talkBtn').textContent = 'Speaking...';
    }

    try {
        console.log('📡 Calling TTS API with voice type:', voiceType);
        
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceType })
        });

        console.log('📊 TTS response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ TTS Error:', errorData);
            throw new Error(errorData.error || 'TTS request failed');
        }

        const data = await response.json();
        console.log('✅ Audio data received');

        if (!audioContext) {
            await unlockAudio();
        }
        
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('🔊 Audio context resumed');
        }

        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('🎵 Decoding audio...');
        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        
        console.log(`✅ Audio decoded (${audioBuffer.duration.toFixed(1)}s)`);
        
        currentAudioSource = audioContext.createBufferSource();
        currentAudioSource.buffer = audioBuffer;
        currentAudioSource.connect(audioContext.destination);
        
        return new Promise((resolve) => {
            currentAudioSource.onended = () => {
                console.log('⏹️ Speech finished');
                currentAudioSource = null;
                document.getElementById('visualizer').classList.remove('listening');
                
                if (setupComplete) {
                    document.getElementById('talkBtn').disabled = false;
                    document.getElementById('talkBtn').textContent = 'Hold to Talk';
                }
                
                resolve();
            };
            
            currentAudioSource.start(0);
            console.log(`▶️ Playing ${voiceType} voice`);
        });

    } catch (error) {
        console.error('❌ TTS Error:', error);
        currentAudioSource = null;
        document.getElementById('visualizer').classList.remove('listening');
        
        if (setupComplete) {
            document.getElementById('talkBtn').disabled = false;
            document.getElementById('talkBtn').textContent = 'Hold to Talk';
        }
        
        throw error;
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

document.body.addEventListener('touchmove', (e) => {
    if (e.target === document.body) {
        e.preventDefault();
    }
}, { passive: false });

window.onload = () => {
    console.log('🚀 Page loaded');
    initialize();
};
