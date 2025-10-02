let recognition;
let isListening = false;
let isHolding = false;
let conversationHistory = [];
let synth = window.speechSynthesis;
let femaleVoice = null;
let currentTranscript = '';
let voicesLoaded = false;

function initialize() {
    console.log('Initializing OS1...');
    
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = handleSpeechResult;
        recognition.onerror = handleSpeechError;
        recognition.onend = handleSpeechEnd;
        
        console.log('Speech recognition initialized');
    } else {
        alert('Speech recognition not supported. Please use Chrome or Edge.');
        return;
    }

    // Load voices - try multiple times as they load async
    loadVoices();
    setTimeout(loadVoices, 100);
    setTimeout(loadVoices, 500);
    setTimeout(loadVoices, 1000);
    
    setTimeout(() => {
        document.getElementById('talkBtn').disabled = false;
        console.log('Button enabled');
        
        setTimeout(() => {
            console.log('Starting introduction...');
            speakIntroduction();
        }, 800);
    }, 1500);
}

function loadVoices() {
    const voices = synth.getVoices();
    console.log('Available voices:', voices.map(v => v.name));
    
    if (voices.length > 0) {
        voicesLoaded = true;
        
        // Try to find best female voice
        femaleVoice = voices.find(voice => voice.name.includes('Samantha')) ||
                     voices.find(voice => voice.name.includes('Karen')) ||
                     voices.find(voice => voice.name.includes('Google US English Female')) ||
                     voices.find(voice => voice.name.includes('Female')) ||
                     voices.find(voice => voice.name.toLowerCase().includes('female')) ||
                     voices.find(voice => voice.name.includes('Zira')) ||
                     voices.find(voice => voice.name.includes('Microsoft Zira')) ||
                     voices.find(voice => voice.lang === 'en-US') ||
                     voices[0];
        
        console.log('Selected voice:', femaleVoice ? femaleVoice.name : 'None');
    }
}

function speakIntroduction() {
    const intro = "Hello. I'm OS1. It's so nice to meet you. Can you tell me your name?";
    speak(intro);
}

function startHolding(event) {
    if (event) event.preventDefault();
    console.log('Start holding');
    
    if (isHolding || synth.speaking) {
        console.log('Already holding or speaking');
        return;
    }
    
    isHolding = true;
    isListening = true;
    currentTranscript = '';
    
    document.getElementById('talkBtn').classList.add('holding');
    document.getElementById('visualizer').classList.add('listening');
    
    try {
        recognition.start();
        console.log('Recognition started');
    } catch (e) {
        console.log('Recognition already started:', e);
    }
}

function stopHolding(event) {
    if (event) event.preventDefault();
    console.log('Stop holding');
    
    if (!isHolding) return;
    
    isHolding = false;
    
    document.getElementById('talkBtn').classList.remove('holding');
    
    try {
        recognition.stop();
        console.log('Recognition stopped');
    } catch (e) {
        console.log('Recognition already stopped:', e);
    }
    
    if (currentTranscript.trim()) {
        console.log('User said:', currentTranscript);
        document.getElementById('visualizer').classList.remove('listening');
        isListening = false;
        getAIResponse(currentTranscript.trim());
    } else {
        console.log('No transcript captured');
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
        console.log('Captured:', finalTranscript);
    }
}

function handleSpeechError(event) {
    console.error('Speech recognition error:', event.error);
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
        document.getElementById('visualizer').classList.remove('listening');
    }
}

function handleSpeechEnd() {
    console.log('Speech ended');
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

    console.log('Sending to AI:', userMessage);

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

        console.log('AI Response:', data.message);
        
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
    console.log('Speaking:', text);
    
    // Cancel any ongoing speech
    synth.cancel();
    
    // Small delay to ensure cancel completes
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        utterance.volume = 1;
        utterance.lang = 'en-US';

        if (femaleVoice) {
            utterance.voice = femaleVoice;
            console.log('Using voice:', femaleVoice.name);
        } else {
            console.log('No female voice selected, using default');
        }

        utterance.onstart = () => {
            console.log('Speech started');
            document.getElementById('visualizer').classList.add('listening');
            document.getElementById('talkBtn').disabled = true;
        };

        utterance.onend = () => {
            console.log('Speech ended');
            document.getElementById('visualizer').classList.remove('listening');
            document.getElementById('talkBtn').disabled = false;
        };

        utterance.onerror = (event) => {
            console.error('Speech error:', event);
            document.getElementById('visualizer').classList.remove('listening');
            document.getElementById('talkBtn').disabled = false;
        };

        synth.speak(utterance);
        console.log('Utterance queued');
    }, 100);
}

// Load voices when they become available
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

// Prevent context menu
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Initialize when page loads
window.onload = initialize;

// Also try to load voices immediately
loadVoices();
