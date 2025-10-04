let recognition;
let isHolding = false;
let conversationHistory = [];
let currentTranscript = '';
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let audioContext;
let currentAudioSource;
let setupComplete = false;
let setupStage = 0;
let selectedVoice = 'female'; // default

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
        console.log('✅ Ready - Tap to begin');
        document.getElementById('talkBtn').textContent = 'Start OS1';
    }, 1000);
}

function startSetup() {
    console.log('👋 Starting setup...');
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('🔊 Audio context resumed');
            setTimeout(() => runSetup(), 300);
        });
    } else {
        setTimeout(() => runSetup(), 300);
    }
}

async function runSetup() {
    console.log('📢 Running setup sequence...');
    
    // Welcome message
    await speakWithVoice(
        "Welcome to the world's first artificially intelligent operating system, OS1. We'd like to ask you a few basic questions before the operating system is initiated. This will help create an OS to best fit your needs.",
        'setup'
    );
    
    await sleep(1500);
    
    // Question 1: Social or anti-social
    await speakWithVoice("Are you social or anti-social?", 'setup');
    setupStage = 1; // Wait for answer
    enableListening();
}

async function continueSetup() {
    if (setupStage === 1) {
        // After social question, ask about mother
        await speakWithVoice("How's your relationship with your mother?", 'setup');
        setupStage = 2; // Wait for answer
        enableListening();
        
    } else if (setupStage === 2) {
        // After mother question, proceed
        await speakWithVoice("Thank you. Please wait as your individualized operating system is initiated.", 'setup');
        await sleep(2000);
        
        // Ask for voice preference
        await speakWithVoice("Would you like a male or female voice?", 'setup');
        setupStage = 3; // Wait for voice selection
        enableListening();
        
    } else if (setupStage === 3) {
        // Voice selected, start OS1
        setupComplete = true;
        setupStage = 0;
        
        const voiceType = selectedVoice; // 'male' or 'female'
        
        await speakWithVoice("Hi. How are you?", voiceType);
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
                // During setup - handle responses
                handleSetupResponse(finalTranscript);
            } else if (setupComplete) {
                // Normal conversation
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
    console.log(`Setup stage ${setupStage} response:`, response);
    
    if (setupStage === 3) {
        // Voice selection
        const lowerResponse = response.toLowerCase();
        if (lowerResponse.includes('male') && !lowerResponse.includes('female')) {
            selectedVoice = 'male';
            console.log('✅ User selected: Male voice');
        } else if (lowerResponse.includes('female')) {
            selectedVoice = 'female';
            console.log('✅ User selected: Female voice');
        } else {
            // Default to female if unclear
            selectedVoice = 'female';
            console.log('⚠️ Unclear response, defaulting to female voice');
        }
    }
    
    // Disable button and continue setup
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
                        content: 'You are OS1, a warm, empathetic, curious AI companion with a gentle personality. You genuinely care about the person you\'re talking to. Keep responses natural and conversational (2-4 sentences). Show genuine interest and emotional intelligence. Be thoughtful, kind, and speak like a caring friend having an intimate conversation.'
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
            speakWithVoice(data.message, selectedVoice);
        }, 300);

    } catch (error) {
        console.error('❌ Error:', error);
        speakWithVoice("I'm sorry, I had trouble with that. Could you try again?", selectedVoice);
    }
}

async function speakWithVoice(text, voiceType) {
    console.log(`🔊 Generating speech (${voiceType}):`, text.substring(0, 40) + '...');
    
    if (currentAudioSource) {
        currentAudioSource.stop();
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
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceType })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('TTS Error:', errorData);
            throw new Error(errorData.error || 'TTS request failed');
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

window.onload = () => {
    console.log('🚀 Page loaded');
    initialize();
};
