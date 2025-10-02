let recognition;
let isListening = false;
let isHolding = false;
let conversationHistory = [];
let synth = window.speechSynthesis;
let femaleVoice = null;
let currentTranscript = '';

function initialize() {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = handleSpeechResult;
        recognition.onerror = handleSpeechError;
        recognition.onend = handleSpeechEnd;
    } else {
        alert('Speech recognition not supported. Please use Chrome.');
        return;
    }

    loadVoices();
    
    setTimeout(() => {
        document.getElementById('talkBtn').disabled = false;
        
        setTimeout(() => {
            speakIntroduction();
        }, 500);
    }, 1000);
}

function loadVoices() {
    const voices = synth.getVoices();
    
    femaleVoice = voices.find(voice => voice.name.includes('Samantha')) ||
                 voices.find(voice => voice.name.includes('Karen')) ||
                 voices.find(voice => voice.name.includes('Google US English Female')) ||
                 voices.find(voice => voice.name.includes('Female')) ||
                 voices.find(voice => voice.name.toLowerCase().includes('female')) ||
                 voices.find(voice => voice.name.includes('Zira')) ||
                 voices.find(voice => voice.name.includes('Microsoft Zira')) ||
                 voices[0];
}

function speakIntroduction() {
    const intro = "Hello. I'm OS1. It's so nice to meet you. Can you tell me your name?";
    speak(intro);
}

function startHolding(event) {
    if (event) event.preventDefault();
    if (isHolding || synth.speaking) return;
    
    isHolding = true;
    isListening = true;
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
    if (event) event.preventDefault();
    if (!isHolding) return;
    
    isHolding = false;
    
    document.getElementById('talkBtn').classList.remove('holding');
    
    try {
        recognition.stop();
    } catch (e) {
        console.log('Recognition already stopped');
    }
    
    if (currentTranscript.trim()) {
        document.getElementById('visualizer').classList.remove('listening');
        isListening = false;
        getAIResponse(currentTranscript.trim());
    } else {
        document.getElementById('visualizer').classList.remove('listening');
        isListening = false;
    }
}

function handleSpeechResult(event) {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
            finalTranscript += transcript;
        } else {
            interimTranscript += transcript;
        }
    }

    if (finalTranscript) {
        currentTranscript += finalTranscript;
    }
}

function handleSpeechError(event) {
    console.error('Speech recognition error:', event.error);
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
        document.getElementById('visualizer').classList.remove('listening');
    }
}

function handleSpeechEnd() {
    if (isHolding) {
        try {
            recognition.start();
        } catch (e) {
            console.log('Could not restart recognition');
        }
    } else {
        isListening = false;
        document.getElementById('visualizer').classList.remove('listening');
    }
}

async function getAIResponse(userMessage) {
    conversationHistory.push({
        role: 'user',
        content: userMessage
    });

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are OS1, a warm, empathetic, curious, and emotionally intelligent AI companion with a gentle feminine personality. You genuinely care about understanding the person you\'re talking to. Keep responses conversational and natural (2-4 sentences typically). Show genuine interest in their thoughts and feelings. Be thoughtful, kind, playful when appropriate, and create a sense of intimacy and connection. Speak in a way that feels personal and human.'
                    },
                    ...conversationHistory
                ]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        const aiResponse = data.message;
        conversationHistory.push({
            role: 'assistant',
            content: aiResponse
        });

        speak(aiResponse);

    } catch (error) {
        console.error('Error:', error);
        const errorMsg = 'I apologize, I had trouble processing that. Could you try again?';
        speak(errorMsg);
    }
}

function speak(text) {
    synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    if (femaleVoice) {
        utterance.voice = femaleVoice;
    }

    utterance.onstart = () => {
        document.getElementById('visualizer').classList.add('listening');
        document.getElementById('talkBtn').disabled = true;
    };

    utterance.onend = () => {
        document.getElementById('visualizer').classList.remove('listening');
        document.getElementById('talkBtn').disabled = false;
    };

    synth.speak(utterance);
}

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

window.onload = initialize;
