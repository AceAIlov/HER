let recognition;
let isHolding = false;
let conversationHistory = [];
let currentTranscript = '';
let audioContext;
let currentAudioSource;
let setupComplete = false;
let setupStage = 0;
let selectedVoice = 'female';

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
    } else {
        alert('Speech recognition not supported. Use Chrome or Safari!');
        return;
    }
    
    setTimeout(() => {
        document.getElementById('talkBtn').disabled = false;
        document.getElementById('talkBtn').textContent = 'Start OS1';
    }, 500);
}

function startSetup() {
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => setTimeout(() => runSetup(), 200));
    } else {
        setTimeout(() => runSetup(), 200);
    }
}

async function runSetup() {
    await speakWithVoice(
        "Welcome to the world's first artificially intelligent operating system, OS1. We'd like to ask you a few basic questions before the operating system is initiated. This will help create an OS to best fit your needs.",
        'setup'
    );
    await sleep(800);
    
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
        await sleep(1000);
        
        await speakWithVoice("Would you like a male or female voice?", 'setup');
        setupStage = 3;
        enableListening();
        
    } else if (setupStage === 3) {
        console.log('✅ Setup complete! Selected voice:', selectedVoice);
        setupComplete = true;
        setupStage = 0;
        conversationHistory = [];
        
        await speakWithVoice("Hi. How are you?", selectedVoice);
    }
}

function enableListening() {
    document.getElementById('talkBtn').disabled = false;
    document.getElementById('talkBtn').textContent = 'Hold to Answer';
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
        console.log('Wait for voice to finish');
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
    
    if (!isHolding) return;
    
    console.log('🛑 Stopped');
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
            console.log('No speech detected');
            document.getElementById('visualizer').classList.remove('listening');
            
            if (setupStage > 0) {
                document.getElementById('talkBtn').textContent = 'Hold to Answer';
                document.getElementById('talkBtn').disabled = false;
            } else if (setupComplete) {
                document.getElementById('talkBtn').textContent = 'Hold to Talk';
                document.getElementById('talkBtn').disabled = false;
            }
        }
    }, 400);
}

function handleSetupResponse(response) {
    console.log(`Setup stage ${setupStage} response:`, response);
    
    if (setupStage === 3) {
        const lowerResponse = response.toLowerCase();
        
        if (lowerResponse.includes('male') && !lowerResponse.includes('female')) {
            selectedVoice = 'male';
            console.log('✅ Male voice selected');
        } else if (lowerResponse.includes('female')) {
            selectedVoice = 'female';
            console.log('✅ Female voice selected');
        } else {
            selectedVoice = 'female';
            console.log('⚠️ Defaulting to female');
        }
        
        console.log('🎯 Final voice:', selectedVoice);
    }
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    setTimeout(() => {
        continueSetup();
    }, 500);
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
    console.log('🤖 User said:', userMessage);
    console.log('🗣️ Using voice:', selectedVoice);
    
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
                        content: 'You are OS1, a warm, empathetic, curious AI companion. Keep responses natural and conversational (2-4 sentences). Show genuine interest and emotional intelligence.'
                    },
                    ...conversationHistory
                ]
            })
        });

        if (!response.ok) {
            throw new Error('API failed: ' + response.status);
        }

        const data = await response.json();
        console.log('💬 AI Response:', data.message);
        
        conversationHistory.push({ role: 'assistant', content: data.message });
        
        await speakWithVoice(data.message, selectedVoice);

    } catch (error) {
        console.error('❌ Error:', error);
        document.getElementById('visualizer').classList.remove('listening');
        document.getElementById('talkBtn').disabled = false;
        document.getElementById('talkBtn').textContent = 'Hold to Talk';
        alert('Error: ' + error.message);
    }
}

async function speakWithVoice(text, voiceType) {
    console.log(`🔊 Speaking (${voiceType}):`, text.substring(0, 50) + '...');
    
    if (currentAudioSource) {
        try {
            currentAudioSource.stop();
        } catch (e) {}
        currentAudioSource = null;
    }
    
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = voiceType === 'setup' ? 'Installing...' : 'Speaking...';

    try {
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceType })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'TTS failed');
        }

        const data = await response.json();

        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        currentAudioSource = audioContext.createBufferSource();
        currentAudioSource.buffer = audioBuffer;
        currentAudioSource.connect(audioContext.destination);
        
        return new Promise((resolve) => {
            currentAudioSource.onended = () => {
                console.log('⏹️ Finished speaking');
                currentAudioSource = null;
                document.getElementById('visualizer').classList.remove('listening');
                
                if (setupComplete) {
                    document.getElementById('talkBtn').disabled = false;
                    document.getElementById('talkBtn').textContent = 'Hold to Talk';
                }
                
                resolve();
            };
            
            currentAudioSource.start(0);
            console.log(`▶️ Playing audio`);
        });

    } catch (error) {
        console.error('❌ Speech error:', error);
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
