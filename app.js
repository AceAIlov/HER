let recognition;
let isHolding = false;
let conversationHistory = [];
let synth = window.speechSynthesis;
let femaleVoice = null;
let currentTranscript = '';
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let voicesLoaded = false;

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

    // Force load voices - critical for mobile
    loadVoices();
    
    // Try multiple times as voices load async
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
        console.log('✅ Button enabled - Tap to begin');
    }, 1500);
}

function loadVoices() {
    const voices = synth.getVoices();
    
    if (voices.length > 0 && !voicesLoaded) {
        voicesLoaded = true;
        console.log('🔊 Available voices:', voices.map(v => v.name + ' (' + v.lang + ')'));
        
        // Priority order for best female voices
        femaleVoice = 
            // iOS voices
            voices.find(v => v.name === 'Samantha') ||
            voices.find(v => v.name.includes('Karen')) ||
            voices.find(v => v.name.includes('Victoria')) ||
            // Android voices
            voices.find(v => v.name.includes('Google US English Female')) ||
            voices.find(v => v.name.includes('Google UK English Female')) ||
            // Windows voices
            voices.find(v => v.name.includes('Microsoft Zira')) ||
            voices.find(v => v.name.includes('Microsoft Aria')) ||
            // Any female voice
            voices.find(v => v.name.toLowerCase().includes('female')) ||
            // Any English voice
            voices.find(v => v.lang.startsWith('en-US')) ||
            voices.find(v => v.lang.startsWith('en')) ||
            // Fallback
            voices[0];
        
        console.log('✅ Selected voice:', femaleVoice.name, '(' + femaleVoice.lang + ')');
    }
}

function speakIntroduction() {
    const intro = "Hello. I'm OS1. It's so nice to meet you. Can you tell me your name?";
    speak(intro);
}

function startHolding(event) {
    event?.preventDefault();
    
    // First tap on mobile triggers intro
    if (conversationHistory.length === 0 && !synth.speaking) {
        console.log('👋 First interaction - playing intro');
        speakIntroduction();
        return;
    }
    
    if (isHolding || synth.speaking) {
        console.log('⚠️ Already holding or speaking');
        return;
    }
    
    console.log('🎙️ Start listening...');
    isHolding = true;
    currentTranscript = '';
    
    document.getElementById('talkBtn').classList.add('holding');
    document.getElementById('visualizer').classList.add('listening');
    
    // Vibrate on mobile for feedback
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
    if (!isHolding) return;
    
    console.log('🛑 Stop listening');
    isHolding = false;
    
    document.getElementById('talkBtn').classList.remove('holding');
    
    // Vibrate feedback
    if (navigator.vibrate) {
        navigator.vibrate(30);
    }
    
    try {
        recognition.stop();
    } catch (e) {}
    
    // Wait a bit for final results
    setTimeout(() => {
        const finalTranscript = currentTranscript.trim();
        if (finalTranscript) {
            console.log('📝 You said:', finalTranscript);
            document.getElementById('visualizer').classList.remove('listening');
            getAIResponse(finalTranscript);
        } else {
            console.log('⚠️ No speech detected');
            document.getElementById('visualizer').classList.remove('listening');
        }
    }, 500);
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
    
    // Show thinking state
    document.getElementById('visualizer').classList.add('listening');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are OS1, a warm, empathetic AI companion with a gentle feminine personality. Keep responses brief and conversational (2-4 sentences). Be thoughtful, kind, and emotionally intelligent. Speak naturally like a caring friend.'
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
        
        // Speak the response
        speak(data.message);

    } catch (error) {
        console.error('❌ Error:', error);
        speak("I'm sorry, I had trouble understanding that. Could you try again?");
    }
}

function speak(text) {
    console.log('🔊 Attempting to speak:', text);
    
    // Cancel any ongoing speech
    synth.cancel();
    
    // Wait a moment for cancel to complete
    setTimeout(() => {
        // Ensure we have voices loaded
        if (!voicesLoaded) {
            loadVoices();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Voice settings
        utterance.voice = femaleVoice;
        utterance.lang = 'en-US';
        utterance.rate = 0.92;
        utterance.pitch = 1.08;
        utterance.volume = 1.0;
        
        console.log('🎤 Using voice:', utterance.voice ? utterance.voice.name : 'default');
        
        utterance.onstart = () => {
            console.log('▶️ Speaking started!');
            document.getElementById('visualizer').classList.add('listening');
            document.getElementById('talkBtn').disabled = true;
            document.getElementById('talkBtn').textContent = 'Speaking...';
        };

        utterance.onend = () => {
            console.log('⏹️ Speaking finished');
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

        // Speak!
        synth.speak(utterance);
        console.log('✅ Utterance queued for speech');
        
        // Failsafe: if speech doesn't start in 3 seconds, reset
        setTimeout(() => {
            if (synth.speaking) {
                console.log('✅ Speech is working');
            } else {
                console.log('⚠️ Speech may have failed - resetting UI');
                document.getElementById('visualizer').classList.remove('listening');
                document.getElementById('talkBtn').disabled = false;
                document.getElementById('talkBtn').textContent = 'Hold to Talk';
            }
        }, 3000);
        
    }, 150);
}

// Voices event handler
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
        console.log('🔄 Voices changed event fired');
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

// Initialize on load
window.onload = () => {
    console.log('🚀 Page loaded');
    initialize();
    
    // Force voice loading on user interaction
    document.addEventListener('touchstart', () => {
        if (!voicesLoaded) {
            loadVoices();
        }
    }, { once: true });
};

// Load voices immediately
loadVoices();
