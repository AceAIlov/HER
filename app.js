let recognition;
let isHolding = false;
let conversationHistory = [];
let synth = window.speechSynthesis;
let femaleVoice = null;
let currentTranscript = '';

function initialize() {
    console.log('🎤 Initializing OS1...');
    
    // Speech Recognition
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = handleSpeechResult;
        recognition.onerror = (e) => console.error('❌ Recognition error:', e.error);
        recognition.onend = handleSpeechEnd;
        console.log('✅ Speech recognition ready');
    } else {
        alert('❌ Speech recognition not supported. Use Chrome!');
        return;
    }

    // Load voices
    loadVoices();
    
    // Enable button and start intro
    setTimeout(() => {
        document.getElementById('talkBtn').disabled = false;
        console.log('✅ Button enabled');
        setTimeout(() => speakIntroduction(), 500);
    }, 1000);
}

function loadVoices() {
    const voices = synth.getVoices();
    console.log('🔊 Voices:', voices.length);
    
    if (voices.length > 0) {
        femaleVoice = voices.find(v => v.name.includes('Google US English Female')) ||
                     voices.find(v => v.name.includes('Samantha')) ||
                     voices.find(v => v.name.includes('Female')) ||
                     voices.find(v => v.lang === 'en-US' && v.name.includes('Female')) ||
                     voices.find(v => v.lang.startsWith('en')) ||
                     voices[0];
        
        console.log('✅ Selected voice:', femaleVoice?.name || 'Default');
    }
}

function speakIntroduction() {
    speak("Hello. I'm OS1. It's so nice to meet you. Can you tell me your name?");
}

function startHolding(event) {
    event?.preventDefault();
    if (isHolding || synth.speaking) return;
    
    console.log('🎙️ Start listening...');
    isHolding = true;
    currentTranscript = '';
    
    document.getElementById('talkBtn').classList.add('holding');
    document.getElementById('visualizer').classList.add('listening');
    
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
    
    if (currentTranscript.trim()) {
        console.log('📝 You said:', currentTranscript);
        document.getElementById('visualizer').classList.remove('listening');
        getAIResponse(currentTranscript.trim());
    } else {
        document.getElementById('visualizer').classList.remove('listening');
    }
}

function handleSpeechResult(event) {
    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            currentTranscript += transcript;
        }
    }
}

function handleSpeechEnd() {
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
        utterance.rate = 0.95;
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
    }, 100);
}

// Load voices
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

document.addEventListener('contextmenu', (e) => e.preventDefault());
window.onload = initialize;
loadVoices();
