let recognition;
let isHolding = false;
let conversationHistory = [];
let currentTranscript = '';
let audioContext;
let currentAudioSource;
let setupComplete = false;
let setupStage = 0;
let selectedVoice = 'female';
let setupStarted = false;
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function initialize() {
    console.log('🎤 Initializing OS1...');
    console.log('📱 Mobile:', isMobile);
    
    if (!isMobile) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
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
    if (setupStarted) {
        console.log('⚠️ Setup already started');
        return;
    }
    
    setupStarted = true;
    console.log('🎬 Starting setup...');
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('✅ Audio unlocked');
            setTimeout(() => runSetup(), 300);
        });
    } else {
        setTimeout(() => runSetup(), 300);
    }
}

async function runSetup() {
    console.log('📢 Running setup sequence...');
    
    try {
        await speakWithVoice(
            "Welcome to the world's first artificially intelligent operating system, OS1. We'd like to ask you a few basic questions before the operating system is initiated. This will help create an OS to best fit your needs.",
            'setup'
        );
        await sleep(800);
        
        await speakWithVoice("Are you social or anti-social?", 'setup');
        setupStage = 1;
        enableListening();
    } catch (error) {
        console.error('❌ Setup failed:', error);
        setupStarted = false;
        document.getElementById('talkBtn').disabled = false;
        document.getElementById('talkBtn').textContent = 'Start OS1';
    }
}

async function continueSetup() {
    console.log('🔄 Continue setup, stage:', setupStage);
    
    try {
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
    } catch (error) {
        console.error('❌ Continue setup failed:', error);
        enableListening();
    }
}

function enableListening() {
    console.log('✅ Enabling listening for stage:', setupStage);
    document.getElementById('talkBtn').disabled = false;
    document.getElementById('talkBtn').textContent = 'Hold to Answer';
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
    console.log('Setup started:', setupStarted, 'Complete:', setupComplete, 'Stage:', setupStage);
    
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
    } catch (e) {}
    
    setTimeout(() => {
        const finalTranscript = currentTranscript.trim();
        console.log('📝 Final transcript:', finalTranscript);
        
        if (finalTranscript) {
            console.log('📝 You said:', finalTranscript);
            document.getElementById('visualizer').classList.remove('listening');
            
            if (!setupComplete && setupStage > 0) {
                console.log('🔄 Handling setup response for stage:', setupStage);
                handleSetupResponse(finalTranscript);
            } else if (setupComplete) {
                console.log('💬 Getting AI response');
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
    console.log(`📋 Setup stage ${setupStage} response:`, response);
    
    if (setupStage === 3) {
        const lowerResponse = response.toLowerCase();
        console.log('🔍 Analyzing voice selection:', lowerResponse);
        
        const hasMale = lowerResponse.includes('male') || 
                       lowerResponse.includes('man') || 
                       lowerResponse.includes('guy') || 
                       lowerResponse.includes('dude') || 
                       lowerResponse.includes('him');
        
        const hasFemale = lowerResponse.includes('female') || 
                         lowerResponse.includes('woman') || 
                         lowerResponse.includes('girl') || 
                         lowerResponse.includes('lady') || 
                         lowerResponse.includes('her');
        
        console.log('🔍 Has male keywords:', hasMale);
        console.log('🔍 Has female keywords:', hasFemale);
        
        if (hasMale && !hasFemale) {
            selectedVoice = 'male';
            console.log('✅✅✅ MALE VOICE SELECTED');
        } else if (hasFemale) {
            selectedVoice = 'female';
            console.log('✅✅✅ FEMALE VOICE SELECTED');
        } else {
            selectedVoice = 'female';
            console.log('⚠️ Unclear, defaulting to female');
        }
        
        console.log('🎯🎯🎯 FINAL SELECTED VOICE:', selectedVoice);
    }
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    console.log('⏱️ Waiting 600ms before continuing...');
    setTimeout(() => {
        console.log('▶️ Calling continueSetup() with voice:', selectedVoice);
        continueSetup();
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
        } catch (e) {}
    }
}

async function getAIResponse(userMessage) {
    console.log('🤖 User said:', userMessage);
    console.log('🗣️ Using voice:', selectedVoice);
    console.log('📜 Conversation history:', conversationHistory);
    
    conversationHistory.push({ role: 'user', content: userMessage });
    
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Thinking...';

    try {
        console.log('📡 Calling /api/chat...');
        
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

        console.log('📊 Response status:', response.status);
        console.log('📊 Response ok:', response.ok);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            
            let errorJson;
            try {
                errorJson = JSON.parse(errorText);
                console.error('❌ Parsed error:', errorJson);
            } catch (e) {
                console.error('❌ Could not parse error as JSON');
            }
            
            throw new Error(`API failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ Full response:', data);
        console.log('💬 AI message:', data.message);
        
        if (!data.message) {
            console.error('❌ No message in response');
            throw new Error('No message received from API');
        }
        
        conversationHistory.push({ role: 'assistant', content: data.message });
        console.log('📜 Updated conversation history:', conversationHistory);
        
        console.log('🔊 About to speak with voice:', selectedVoice);
        await speakWithVoice(data.message, selectedVoice);

    } catch (error) {
        console.error('❌ Full error object:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        
        document.getElementById('visualizer').classList.remove('listening');
        document.getElementById('talkBtn').disabled = false;
        document.getElementById('talkBtn').textContent = 'Hold to Talk';
        
        alert('Error communicating with AI:\n\n' + error.message + '\n\nCheck browser console (F12) and Render logs for details.');
    }
}

async function speakWithVoice(text, voiceType) {
    console.log(`🔊 speakWithVoice called`);
    console.log(`   Text: "${text.substring(0, 50)}..."`);
    console.log(`   Voice type: "${voiceType}"`);
    
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
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioContext.state === 'suspended') {
            console.log('🔓 Resuming audio context...');
            await audioContext.resume();
        }

        console.log('📡 Calling /api/tts with voice type:', voiceType);
        
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceType })
        });

        console.log('📊 TTS Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ TTS Error:', errorData);
            throw new Error(errorData.error || 'TTS failed');
        }

        const data = await response.json();
        console.log('✅ TTS audio received');

        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('🎵 Decoding audio...');
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
            console.log(`▶️ Playing audio (${audioBuffer.duration.toFixed(1)}s) with voice: ${voiceType}`);
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
