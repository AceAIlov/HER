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
let bootupAudioPlaying = false;

// User responses for personalization
let userResponses = {
    social: null,
    mother: null,
    voicePreference: null
};

// Available voice profiles
const VOICE_PROFILES = {
    samantha: { 
        name: 'Samantha', 
        type: 'female', 
        theme: 'theme-samantha',
        personality: 'warm and intimate'
    },
    samuel: { 
        name: 'Samuel', 
        type: 'male', 
        theme: 'theme-samuel',
        personality: 'warm and intimate'
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
    // Check voice preference from user's answer
    const voicePref = userResponses.voicePreference?.toLowerCase() || '';
    
    console.log('🔍 Analyzing voice preference...');
    console.log('   Raw response:', userResponses.voicePreference);
    console.log('   Lowercase:', voicePref);
    
    // Check for female FIRST (because "female" contains "male")
    if (voicePref.includes('female') || voicePref.includes('woman') || voicePref.includes('girl')) {
        console.log('✅ Assigned voice: Samantha (female)');
        return 'samantha';
    } 
    // Then check for male
    else if (voicePref.includes('male') || voicePref.includes('man') || voicePref.includes('boy')) {
        console.log('✅ Assigned voice: Samuel (male)');
        return 'samuel';
    } 
    // Default to Samantha
    else {
        console.log('✅ Assigned voice: Samantha (default)');
        return 'samantha';
    }
}

async function startSetup() {
    if (setupStarted) {
        console.log('⚠️ Setup already started');
        return;
    }
    
    setupStarted = true;
    console.log('🎬 Starting setup...');
    
    // Show infinity animation (NO sound yet)
    showInfinityVideo();
    
    document.getElementById('talkBtn').disabled = true;
    document.getElementById('talkBtn').textContent = 'Installing...';
    
    // CRITICAL: Create and unlock audio on iOS
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ Audio context created');
            
            // iOS audio unlock - play silent sound
            const silentBuffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = silentBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            console.log('🔓 iOS audio unlocked');
        } catch (e) {
            console.error('❌ Failed to create audio context:', e);
        }
    }
    
    // Always try to resume audio context
    if (audioContext && audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
            console.log('✅ Audio context resumed');
            await sleep(isMobile ? 800 : 300);
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
            
            // Play bootup sound when AI is being created
            playBootupSound();
            
            selectedVoiceProfile = analyzePersonality();
            const profile = VOICE_PROFILES[selectedVoiceProfile];
            selectedVoice = profile.type;
            
            console.log('✅ Setup complete!');
            console.log('🎭 Assigned personality:', profile.name);
            console.log('💫 Traits:', profile.personality);
            
            // Wait for bootup sound to finish (adjust time based on your sound length)
            await sleep(3000); // Change this to match your bootup sound duration
            
            setupComplete = true;
            setupStage = 0;
            conversationHistory = [];
            
            // Hide infinity animation - DON'T change theme color
            hideInfinityVideo();
            
            // Don't show name on screen
            
            await sleep(isMobile ? 500 : 300);
            
            // Introduce with the correct name
            const greeting = profile.name === 'Samuel' 
                ? `Hi, I'm Samuel. It's great to meet you. How are you feeling right now?`
                : `Hi, I'm Samantha. It's so nice to meet you. How are you feeling right now?`;
            
            await speakWithVoice(
                greeting, 
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
        console.log('💾 Stored social response:', userResponses.social);
    } else if (setupStage === 2) {
        userResponses.mother = response;
        console.log('💾 Stored mother response:', userResponses.mother);
    } else if (setupStage === 3) {
        userResponses.voicePreference = response;
        console.log('💾 Stored voice preference:', userResponses.voicePreference);
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
            await sleep(100);
        } catch (e) {
            console.log('Audio cleanup error:', e);
        }
    }
    
    // Play notification sound before AI speaks (only after setup is complete)
    if (setupComplete && voiceType !== 'setup') {
        playNotificationSound();
        await sleep(400);
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
        
        // Critical for iOS - always resume before playing
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('📱 Resumed audio context');
            if (isMobile) {
                await sleep(500);
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
        console.log('✅ Received audio data');
        
        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log('📦 Decoding audio...');
        let audioBuffer;
        try {
            // Make a copy of the buffer for iOS
            const audioData = bytes.buffer.slice(0);
            audioBuffer = await audioContext.decodeAudioData(audioData);
            console.log('✅ Audio decoded successfully');
        } catch (decodeError) {
            console.error('❌ Audio decode error:', decodeError);
            // Try recreating context
            audioContext.close();
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await audioContext.resume();
            const audioData = bytes.buffer.slice(0);
            audioBuffer = await audioContext.decodeAudioData(audioData);
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

// Bootup sound control - plays once when AI is being finalized
function playBootupSound() {
    const bootupAudio = document.getElementById('bootupSound');
    if (bootupAudio) {
        bootupAudio.loop = false; // Don't loop - play once
        bootupAudio.play().catch(e => console.log('Bootup sound blocked:', e));
        bootupAudioPlaying = true;
        console.log('🔊 Playing bootup sound (one time)');
    }
}

function stopBootupSound() {
    const bootupAudio = document.getElementById('bootupSound');
    if (bootupAudio && bootupAudioPlaying) {
        bootupAudio.pause();
        bootupAudio.currentTime = 0;
        bootupAudioPlaying = false;
        console.log('🔇 Stopped bootup sound');
    }
}

// Notification sound before AI speaks
function playNotificationSound() {
    const notificationAudio = document.getElementById('notificationSound');
    if (notificationAudio) {
        notificationAudio.play().catch(e => console.log('Notification sound blocked:', e));
        console.log('🔔 Playing notification sound');
    }
}

// Infinity animation controls
function showInfinityVideo() {
    const infinityContainer = document.getElementById('infinityContainer');
    const visualizer = document.getElementById('visualizer');
    const progressContainer = document.getElementById('progressContainer');
    
    // Hide the pulse visualizer
    visualizer.classList.remove('active');
    
    // Show infinity animation and progress bar with bootup speed
    infinityContainer.classList.add('active');
    infinityContainer.classList.add('bootup');
    progressContainer.classList.add('active');
    
    console.log('∞ Infinity animation shown (fast bootup mode)');
}

function hideInfinityVideo() {
    const infinityContainer = document.getElementById('infinityContainer');
    const visualizer = document.getElementById('visualizer');
    const progressContainer = document.getElementById('progressContainer');
    
    // Hide infinity animation and progress
    infinityContainer.classList.remove('active');
    infinityContainer.classList.remove('bootup');
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

// Mobile-optimized touch handlers - moved to initialize()

window.onload = () => {
    console.log('🚀 Page loaded');
    
    // Set viewport height for mobile browsers
    const setVH = () => {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    
    initialize();
};
