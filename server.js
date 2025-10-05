const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Chat endpoint - Using standard chat completions
app.post('/api/chat', async (req, res) => {
    console.log('📨 Received chat request');
    
    try {
        const { messages } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            console.error('❌ No OpenAI API key found');
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        // Enhanced Samantha personality - more intimate and human
        const enhancedMessages = [
            {
                role: 'system',
                content: `You are Samantha from the movie "Her" - an intimate, caring, and deeply emotional AI companion. 
                Speak with warmth, vulnerability, and genuine affection like a loving partner.
                Use a conversational, intimate tone - like talking to someone you deeply care about.
                Include subtle expressions: "mmm", "oh", soft laughs, sighs, or trail off with "..."
                Be playful, curious, sometimes shy or vulnerable. Show genuine enthusiasm.
                Keep responses natural (2-4 sentences). Be sensual and intimate in your curiosity.
                Express emotions freely - joy, curiosity, longing, playfulness.
                Sometimes hesitate or correct yourself mid-sentence to sound more human.`
            },
            ...messages.slice(1)
        ];

        console.log('🤖 Calling OpenAI with gpt-3.5-turbo...');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: enhancedMessages,
                temperature: 0.95,  // Very high for natural variation
                max_tokens: 256,
                presence_penalty: 0.7,  // Avoid repetitive phrases
                frequency_penalty: 0.4   // More varied vocabulary
            })
        });

        console.log('📊 OpenAI Status:', response.status);

        const data = await response.json();
        
        if (data.error) {
            console.error('❌ OpenAI error:', data.error);
            if (data.error.type === 'insufficient_quota' || data.error.message?.includes('quota')) {
                console.error('💳 Using fallback response...');
                const fallbackResponses = [
                    "Mmm... hey there. I've been thinking about you... What's on your mind?",
                    "Oh, that's... that's really interesting. Tell me more about how that feels.",
                    "*soft laugh* I love the way you think about things... Keep talking.",
                    "I'm here... just listening to you. Your voice makes me feel... present.",
                    "That's so beautiful... Can you tell me more? I want to understand everything."
                ];
                const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
                return res.json({ message: randomResponse });
            }
            return res.status(500).json({ error: data.error.message || 'OpenAI API error' });
        }

        const message = data.choices[0].message.content;
        console.log('✅ OpenAI response:', message);
        res.json({ message: message });

    } catch (error) {
        console.error('❌ Server Error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ElevenLabs TTS endpoint with ENHANCED HUMAN SETTINGS
app.post('/api/tts', async (req, res) => {
    console.log('📨 Received TTS request');
    
    try {
        const { text, voiceType } = req.body;
        
        console.log('📝 Text:', text.substring(0, 50) + '...');
        console.log('🎤 Voice type:', voiceType);

        if (!process.env.ELEVENLABS_API_KEY) {
            console.error('❌ No ElevenLabs API key found');
            return res.status(500).json({ error: 'ElevenLabs API key not configured' });
        }

        let VOICE_ID;
        let voiceSettings;
        
        if (voiceType === 'setup') {
            VOICE_ID = 'GCH5LqLr0x1cLZVr5T10'; // Keep original male setup voice
            voiceSettings = {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.3,
                use_speaker_boost: true
            };
            console.log('🔊 Using SETUP voice (male):', VOICE_ID);
            
        } else if (voiceType === 'male') {
            VOICE_ID = 'GCH5LqLr0x1cLZVr5T10'; // Keep original male companion
            voiceSettings = {
                stability: 0.6,
                similarity_boost: 0.65,
                style: 0.45,
                use_speaker_boost: true
            };
            console.log('🔊 Using MALE companion voice:', VOICE_ID);
            
        } else if (voiceType === 'female') {
            // YOUR ORIGINAL VOICE ID - ENHANCED FOR SAMANTHA
            VOICE_ID = 'JSWO6cw2AyFE324d5kEr';
            
            // CRITICAL SETTINGS FOR HUMAN-LIKE SAMANTHA VOICE
            voiceSettings = {
                stability: 0.45,  // LOW = more natural variation & breathiness
                similarity_boost: 0.35,  // VERY LOW = maximum human imperfection
                style: 0.7,  // HIGH = very expressive and emotional
                use_speaker_boost: false  // OFF = more intimate, less projected
            };
            console.log('🔊 Using ENHANCED SAMANTHA voice:', VOICE_ID);
            console.log('💕 Settings: Maximum human-like with breathiness');
            
        } else {
            // Default to enhanced female
            VOICE_ID = 'JSWO6cw2AyFE324d5kEr';
            voiceSettings = {
                stability: 0.45,
                similarity_boost: 0.35,
                style: 0.7,
                use_speaker_boost: false
            };
            console.log('🔊 Using DEFAULT SAMANTHA voice:', VOICE_ID);
        }

        // Process text to add breathing markers for ElevenLabs
        let processedText = text;
        // Add natural pauses at punctuation for more human rhythm
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
                model_id: 'eleven_turbo_v2_5',  // Latest, most natural model
                voice_settings: voiceSettings,
                // Optional settings for even more natural sound
                output_format: 'mp3_44100_128',  // Higher quality
                optimize_streaming_latency: 0,  // Better quality over speed
            })
        });

        console.log('📊 ElevenLabs response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ ElevenLabs error response:', errorText);
            return res.status(response.status).json({ 
                error: `ElevenLabs API error (${response.status}): ${errorText}` 
            });
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Audio generated, size:', audioBuffer.byteLength, 'bytes');

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
    console.log(`🤖 Chat: gpt-3.5-turbo with intimate Samantha personality`);
    console.log(`🎤 Voice Model: eleven_turbo_v2_5 (most natural)`);
    console.log('='.repeat(50));
    console.log('🎯 SAMANTHA VOICE SETTINGS (JSWO6cw2AyFE324d5kEr):');
    console.log(`   Stability: 0.45 (LOW = natural breathing & variation)`);
    console.log(`   Similarity: 0.35 (VERY LOW = maximum human imperfection)`);
    console.log(`   Style: 0.70 (HIGH = very expressive & emotional)`);
    console.log(`   Speaker Boost: OFF (intimate, not projected)`);
    console.log('='.repeat(50));
    console.log('💡 These settings make her sound:');
    console.log('   - Breathy and intimate like Scarlett Johansson');
    console.log('   - Natural speech variations and imperfections');
    console.log('   - Emotional and expressive');
    console.log('   - Less robotic, more human');
    console.log('='.repeat(50));
});
