let recognition;
let isHolding = false;
let conversationHistory = [];
let currentTranscript = '';
let audioContext;
let currentAudioSource;
let setupComplete = false;
let setupStage = 0;
let selectedVoice = 'female';
let selectedVoiceProfile = null;
let setupStarted = false;
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let setupProgress = 0;
let totalSetupSteps = 4;

// User responses for personalization
let userResponses = {
    social: null,
    mother: null,
    voicePreference: null
};

// Available voice profiles
const VOICE_PROFILES = {
    // Female voices
    samantha: { 
        name: 'Samantha', 
        type: 'female', 
        theme: 'theme-samantha',
        personality: 'warm and intimate'
    },
    nova: { 
        name: 'Nova', 
        type: 'female', 
        theme: 'theme-nova',
        personality: 'friendly and enthusiastic'
    },
    luna: { 
        name: 'Luna', 
        type: 'female', 
        theme: 'theme-luna',
        personality: 'mysterious and thoughtful'
    },
    aria: { 
        name: 'Aria', 
        type: 'female', 
        theme: 'theme-aria',
        personality: 'gentle and nurturing'
    },
    // Male voices
    ethan: { 
        name: 'Ethan', 
        type: 'male', 
        theme: 'theme-ethan',
        personality: 'confident and supportive'
    },
    atlas: { 
        name: 'Atlas', 
        type: 'male', 
        theme: 'theme-atlas',
        personality: 'intellectual and analytical'
    },
    kai: { 
        name: 'Kai', 
        type: 'male', 
        theme: 'theme-kai',
        personality: 'playful and witty'
    },
    // Unique voices
    sage: { 
        name: 'Sage', 
        type: 'neutral', 
        theme: 'theme-sage',
        personality: 'mystical and calming'
    },
    echo: { 
        name: 'Echo', 
        type: 'neutral', 
        theme: 'theme-echo',
        personality: 'ethereal and artistic'
    }
};

function initialize() {
    console.log('🎤 Initializing OS1...');
    console.log('📱 Mobile:', isMobile);
    
    // Remove personalization button since users can't choose
    const persButton = document.querySelector('.personalization-hint');
    if (persButton) persButton.style.display = 'none';
    
    // Don't create audio context until user interaction (important for mobile)
    audioContext = null;
    
    // Prevent iOS scroll bounce
    document.body.addEventListener('touchmove', function(e) {
        if (e.target === document.body) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Prevent double-tap zoom on iOS
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(e) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
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

function analyzePersonality() {
    // Analyze user responses to assign a voice
    const response1 = userResponses.social?.toLowerCase() || '';
    const response2 = userResponses.mother?.toLowerCase() || '';
    const voicePref = userResponses.voicePreference?.toLowerCase() || '';
    
    // Complex personality matching algorithm
    let scores = {};
    
    // Female voices
    scores.samantha = 0;
    scores.nova = 0;
    scores.luna = 0;
    scores.aria = 0;
    
    // Male voices
    scores.ethan = 0;
    scores.atlas = 0;
    scores.kai = 0;
    
    // Unique voices
    scores.sage = 0;
    scores.echo = 0;
    
    // Analyze social response
    if (response1.includes('social') || response1.includes('people') || response1.includes('friends')) {
        scores.nova += 3;
        scores.kai += 3;
        scores.ethan += 2;
    } else if (response1.includes('anti') || response1.includes('alone') || response1.includes('myself')) {
        scores.luna += 3;
        scores.atlas += 3;
        scores.echo += 2;
    } else if (response1.includes('both') || response1.includes('depends') || response1.includes('sometimes')) {
        scores.samantha += 2;
        scores.sage += 3;
        scores.aria += 2;
    }
    
    // Analyze mother relationship
    if (response2.includes('good') || response2.includes('great') || response2.includes('love') || response2.includes('close')) {
        scores.aria += 3;
        scores.samantha += 2;
        scores.ethan += 2;
    } else if (response2.includes('complicated') || response2.includes('difficult') || response2.includes('complex')) {
        scores.luna += 3;
        scores.sage += 2;
        scores.echo += 2;
    } else if (response2.includes('okay') || response2.includes('fine') || response2.includes('normal')) {
        scores.nova += 2;
        scores.kai += 2;
        scores.atlas += 2;
    }
    
    // Voice preference influence
    if (voicePref.includes('female') || voicePref.includes('woman')) {
        scores.samantha += 5;
        scores.nova += 5;
        scores.luna += 5;
        scores.aria += 5;
    } else if (voicePref.includes('male') || voicePref.includes('man')) {
        scores.ethan += 5;
        scores.atlas += 5;
        scores.kai += 5;
    } else if (voicePref.includes('unique') || voicePref.includes('different') || voicePref.includes('special')) {
        scores.sage += 5;
        scores.echo += 5;
    }
    
    // Add some randomness for variety
    Object.keys(scores).forEach(key => {
        scores[key] += Math.random() * 2;
    });
    
    // Find the best match
    let bestMatch = 'samantha';
    let highestScore = 0;
    
    for (const [key, score] of Object.entries(scores)) {
        if (score > highestScore) {
            highestScore = score;
            bestMatch = key;
        }
    }
    
    console.log('🧠 Personality analysis scores:', scores);
    console.log('✨ Best match:', bestMatch);
    
    return bestMatch;
}

async function startSetup() {
    if (setupStarted) {
        console.log('⚠️ Setup already started');
        return;
    }
    
    setupStarted = true;
    console.log('🎬 Starting setup...');
    
    // Play bootup sound
    playBootupSound();
    
    // Show infinity animation
    showInfinityVideo();
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    // Create audio context on first user interaction (critical for mobile)
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ Audio context created');
        } catch (e) {
            console.error('❌ Failed to create audio context:', e);
            return;
        }
    }
    
    // Always try to resume audio context on mobile
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
            console.log('✅ Audio context resumed');
            await sleep(isMobile ? 500 : 300);
        } catch (e) {
            console.error('❌ Failed to resume audio:', e);
        }
    }
    
    if (isMobile) {
        await sleep(500);
    }
    
    runSetup();
}

async function runSetup() {
    console.log('📢 Running setup sequence...');
    
    if (!setupStarted || setupStage !== 0) {
        console.log('⚠️ Setup already in progress');
        return;
    }
    
    try {
        updateProgress(0, "Welcome to OS1...");
        
        await speakWithVoice(
            "Welcome to the world's first artificially intelligent operating system, OS1. We'd like to ask you a few basic questions before the operating system is initiated. This will help create an OS to best fit your needs.",
            'setup'
        );
        
        await sleep(isMobile ? 1200 : 800);
        
        updateProgress(25, "Question 1 of 3");
        await speakWithVoice("Are you social or anti-social?", 'setup');
        setupStage = 1;
        enableListening();
    } catch (error) {
        console.error('❌ Setup failed:', error);
        hideInfinityVideo();
        setupStarted = false;
        setupStage = 0;
        document.getElementById('talkBtn').disabled = false;
        document.getElementById('talkBtn').textContent = 'Start OS1';
    }
}

async function continueSetup() {
    console.log('🔄 Continue setup, stage:', setupStage);
    
    if (currentAudioSource) {
        console.log('⚠️ Audio still playing, waiting...');
        return;
    }
    
    try {
        if (setupStage === 1) {
            await sleep(isMobile ? 800 : 500);
            updateProgress(50, "Question 2 of 3");
            await speakWithVoice("How's your relationship with your mother?", 'setup');
            setupStage = 2;
            enableListening();
            
        } else if (setupStage === 2) {
            await sleep(isMobile ? 800 : 500);
            updateProgress(75, "Final question...");
            await speakWithVoice("Thank you. Please wait as your individualized operating system is initiated.", 'setup');
            await sleep(isMobile ? 1500 : 1000);
            
            await speakWithVoice("Would you like a male or female voice?", 'setup');
            setupStage = 3;
            enableListening();
            
        } else if (setupStage === 3) {
            updateProgress(100, "Finalizing your OS1...");
            
            selectedVoiceProfile = analyzePersonality();
            const profile = VOICE_PROFILES[selectedVoiceProfile];
            selectedVoice = profile.type;
            
            console.log('✅ Setup complete!');
            console.log('🎭 Assigned personality:', profile.name);
            console.log('💫 Traits:', profile.personality);
            
            await sleep(800);
            
            setupComplete = true;
            setupStage = 0;
            conversationHistory = [];
            
            // Hide infinity animation - DON'T change theme color
            hideInfinityVideo();
            
            document.getElementById('aiName').textContent = profile.name;
            document.getElementById('aiName').style.opacity = '1';
            // Remove subtitle - keep it clean
            
            await sleep(isMobile ? 1000 : 500);
            await speakWithVoice(
                `Hi, I'm ${profile.name}. It's so nice to meet you. How are you feeling right now?`, 
                selectedVoice, 
                selectedVoiceProfile
            );
        }
    } catch (error) {
        console.error('❌ Continue setup failed:', error);
        enableListening();
    }
}

function handleSetupResponse(response) {
    console.log(`📋 Setup stage ${setupStage} response:`, response);
    
    // Store responses for personality analysis
    if (setupStage === 1) {
        userResponses.social = response;
    } else if (setupStage === 2) {
        userResponses.mother = response;
    } else if (setupStage === 3) {
        userResponses.voicePreference = response;
    }
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    // Longer delay on mobile to prevent jittering
    setTimeout(() => {
        continueSetup();
    }, isMobile ? 1000 : 600);
}

async function getAIResponse(userMessage) {
    console.log('🤖 User said:', userMessage);
    console.log('🗣️ Using voice profile:', selectedVoiceProfile);
    
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
                        content: 'You are an AI companion. Keep responses natural and conversational (2-4 sentences).'
                    },
                    ...conversationHistory
                ],
                voiceProfile: selectedVoiceProfile
            })
        });

        if (!response.ok) {
            throw new Error(`API failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ AI response:', data.message);
        
        conversationHistory.push({ role: 'assistant', content: data.message });
        
        await speakWithVoice(data.message, selectedVoice, selectedVoiceProfile);

    } catch (error) {
        console.error('❌ Error:', error);
        document.getElementById('visualizer').classList.remove('listening');
        document.getElementById('talkBtn').disabled = false;
        document.getElementById('talkBtn').textContent = 'Hold to Talk';
    }
}

async function speakWithVoice(text, voiceType, voiceProfile = null) {
    console.log(`🔊 Speaking with voice type: ${voiceType}, profile: ${voiceProfile}`);
    
    // Stop any existing audio to prevent overlapping
    if (currentAudioSource) {
        try {
            currentAudioSource.stop();
            currentAudioSource.disconnect();
            currentAudioSource = null;
            // Wait for audio to fully stop
            await sleep(100);
        } catch (e) {
            console.log('Audio cleanup error:', e);
        }
    }
    
    document.getElementById('visualizer').classList.add('listening');
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = voiceType === 'setup' ? 'Installing...' : 'Speaking...';

    try {
        // Ensure audio context exists and is running
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('📱 Created audio context in speakWithVoice');
        }
        
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('📱 Resumed audio context');
            // Extra wait for mobile
            if (isMobile) {
                await sleep(200);
            }
        }

        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text, 
                voiceType,
                voiceProfile: voiceProfile || selectedVoiceProfile
            })
        });

        if (!response.ok) {
            throw new Error('TTS failed');
        }

        const data = await response.json();
        
        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Add try-catch for audio decoding
        let audioBuffer;
        try {
            audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        } catch (decodeError) {
            console.error('❌ Audio decode error:', decodeError);
            // Try to recover by recreating audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        }
        
        // Create fresh buffer source
        currentAudioSource = audioContext.createBufferSource();
        currentAudioSource.buffer = audioBuffer;
        currentAudioSource.connect(audioContext.destination);
        
        return new Promise((resolve) => {
            currentAudioSource.onended = () => {
                console.log('✅ Finished speaking');
                currentAudioSource = null;
                document.getElementById('visualizer').classList.remove('listening');
                
                if (setupComplete) {
                    document.getElementById('talkBtn').disabled = false;
                    document.getElementById('talkBtn').textContent = 'Hold to Talk';
                }
                
                resolve();
            };
            
            // Start playback
            currentAudioSource.start(0);
            console.log(`▶️ Playing audio (${audioBuffer.duration.toFixed(1)}s)`);
        });

    } catch (error) {
        console.error('❌ Speech error:', error);
        currentAudioSource = null;
        document.getElementById('visualizer').classList.remove('listening');
        
        if (setupComplete) {
            document.getElementById('talkBtn').disabled = false;
            document.getElementById('talkBtn').textContent = 'Hold to Talk';
        } else if (!setupStarted) {
            document.getElementById('talkBtn').disabled = false;
            document.getElementById('talkBtn').textContent = 'Start OS1';
        }
        
        throw error;
    }
}

// Remove the personalization function since users can't change
window.openPersonalization = function() {
    // Disabled - users get assigned their voice
    console.log('Voice personalization is automatic based on setup responses');
};

function enableListening() {
    console.log('✅ Enabling listening for stage:', setupStage);
    document.getElementById('talkBtn').disabled = false;
    document.getElementById('talkBtn').textContent = 'Hold to Answer';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Bootup sound control
function playBootupSound() {
    const bootupAudio = document.getElementById('bootupSound');
    if (bootupAudio) {
        bootupAudio.play().catch(e => console.log('Bootup sound blocked:', e));
        console.log('🔊 Playing bootup sound');
    }
}

// Infinity animation controls
function showInfinityVideo() {
    const infinityContainer = document.getElementById('infinityContainer');
    const visualizer = document.getElementById('visualizer');
    const progressContainer = document.getElementById('progressContainer');
    
    // Hide the pulse visualizer
    visualizer.classList.remove('active');
    
    // Show infinity animation and progress bar
    infinityContainer.classList.add('active');
    progressContainer.classList.add('active');
    
    console.log('∞ Infinity animation shown');
}

function hideInfinityVideo() {
    const infinityContainer = document.getElementById('infinityContainer');
    const visualizer = document.getElementById('visualizer');
    const progressContainer = document.getElementById('progressContainer');
    
    // Hide infinity animation and progress
    infinityContainer.classList.remove('active');
    progressContainer.classList.remove('active');
    
    // Show the pulse visualizer - smooth transition
    setTimeout(() => {
        visualizer.classList.add('active');
    }, 300);
    
    console.log('∞ Infinity animation hidden, circle visualizer shown');
}

function updateProgress(percent, text) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    progressBar.style.width = percent + '%';
    progressText.textContent = text;
    console.log(`📊 Progress: ${percent}% - ${text}`);
}

function startHolding(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    console.log('👆 Button pressed');
    
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
            document.getElementById('visualizer').classList.remove('listening');
            
            if (!setupComplete && setupStage > 0) {
                handleSetupResponse(finalTranscript);
            } else if (setupComplete) {
                getAIResponse(finalTranscript);
            }
        } else {
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
