const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Voice ID mappings - Samantha (female) and Samuel (male)
const VOICE_MAPPINGS = {
    samantha: {
        id: 'JSWO6cw2AyFE324d5kEr', // Your custom Samantha voice
        settings: {
            stability: 0.40,
            similarity_boost: 0.30,
            style: 0.75,
            use_speaker_boost: false
        }
    },
    samuel: {
        id: 'GCH5LqLr0x1cLZVr5T10 ', // Adam - male voice
        settings: {
            stability: 0.50,
            similarity_boost: 0.40,
            style: 0.65,
            use_speaker_boost: false
        }
    }
};

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    console.log('📨 Received chat request');
    
    try {
        const { messages, voiceProfile } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            console.error('❌ No OpenAI API key found');
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        // Get personality name
        const personalityName = voiceProfile || 'samantha';
        console.log('🎭 Personality:', personalityName);

        // Enhanced personality-based prompts - Samantha and Samuel
        const personalityPrompts = {
            samantha: "You're warm, intimate, and deeply caring. Speak like a close friend who genuinely cares. Use natural pauses, express emotions freely. Be vulnerable and authentic.",
            samuel: "You're warm, supportive, and genuinely caring. Speak like a trusted friend who's always there. Be confident but tender, strong but understanding."
        };

        const systemPrompt = personalityPrompts[personalityName] || personalityPrompts.samantha;

        const enhancedMessages = [
            {
                role: 'system',
                content: `${systemPrompt} Keep responses natural and conversational (2-4 sentences). Don't mention being an AI. Speak like a real person.`
            },
            ...messages.slice(1)
        ];

        console.log('🤖 Calling OpenAI...');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: enhancedMessages,
                temperature: 0.95,
                max_tokens: 256,
                presence_penalty: 0.7,
                frequency_penalty: 0.4
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error('❌ OpenAI error:', data.error);
            const fallbackResponses = [
                "Hey... I'm here. What's on your mind?",
                "That's interesting. Tell me more.",
                "I love talking with you. Keep going.",
                "Mmm... I'm listening. How does that make you feel?",
                "That's beautiful. Can you tell me more?"
            ];
            const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
            return res.json({ message: randomResponse });
        }

        const message = data.choices[0].message.content;
        console.log('✅ Response:', message);
        res.json({ message: message });

    } catch (error) {
        console.error('❌ Server Error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// TTS endpoint with human-like settings for ALL voices
app.post('/api/tts', async (req, res) => {
    console.log('📨 Received TTS request');
    
    try {
        const { text, voiceType, voiceProfile } = req.body;
        
        console.log('📝 Text:', text.substring(0, 50) + '...');
        console.log('🎤 Voice type:', voiceType);
        console.log('🎭 Voice profile:', voiceProfile);

        if (!process.env.ELEVENLABS_API_KEY) {
            console.error('❌ No ElevenLabs API key found');
            return res.status(500).json({ error: 'ElevenLabs API key not configured' });
        }

        let VOICE_ID;
        let voiceSettings;
        
        // Setup voice - OS1 installer voice
        if (voiceType === 'setup') {
            VOICE_ID = 'GCH5LqLr0x1cLZVr5T10'; // OS1 setup voice
            voiceSettings = {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.3,
                use_speaker_boost: true
            };
            console.log('🔊 Using OS1 SETUP voice:', VOICE_ID);
            
        } else {
            // Use personality-based voice mapping
            const voiceConfig = VOICE_MAPPINGS[voiceProfile] || VOICE_MAPPINGS.samantha;
            VOICE_ID = voiceConfig.id;
            voiceSettings = voiceConfig.settings;
            
            console.log(`🔊 Using ${voiceProfile} voice:`, VOICE_ID);
            console.log('💫 Settings:', voiceSettings);
        }

        // Process text for natural pauses
        let processedText = text;
        processedText = processedText.replace(/\.\.\./g, '... ');
        processedText = processedText.replace(/([.!?])\s+/g, '$1 ');

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': process.env.ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
                text: processedText,
                model_id: 'eleven_turbo_v2_5',
                voice_settings: voiceSettings,
                output_format: 'mp3_44100_128',
                optimize_streaming_latency: 0,
            })
        });

        console.log('📊 ElevenLabs response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ ElevenLabs error:', errorText);
            return res.status(response.status).json({ 
                error: `ElevenLabs API error: ${errorText}` 
            });
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Audio generated:', audioBuffer.byteLength, 'bytes');

        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        res.json({ audio: audioBase64 });

    } catch (error) {
        console.error('❌ TTS Error:', error.message);
        res.status(500).json({ error: error.message || 'TTS generation failed' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ MISSING'}`);
    console.log(`✅ ElevenLabs API Key: ${process.env.ELEVENLABS_API_KEY ? '✓ Configured' : '✗ MISSING'}`);
    console.log('='.repeat(50));
    console.log(`🤖 Chat: gpt-3.5-turbo with personality-based prompts`);
    console.log(`🎤 Voice Model: eleven_turbo_v2_5 (most natural)`);
    console.log('='.repeat(50));
    console.log('🎭 VOICE COMPANIONS:');
    console.log('👩 SAMANTHA (Female):');
    console.log(`   Voice ID: JSWO6cw2AyFE324d5kEr`);
    console.log(`   Stability: 0.40 | Similarity: 0.30 | Style: 0.75`);
    console.log('👨 SAMUEL (Male):');
    console.log(`   Voice ID: GCH5LqLr0x1cLZVr5T10 `);
    console.log(`   Stability: 0.50 | Similarity: 0.40 | Style: 0.65`);
    console.log('='.repeat(50));
});
