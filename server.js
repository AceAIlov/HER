const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    console.log('📨 Received chat request');
    
    try {
        const { messages } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            console.error('❌ No OpenAI API key found');
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        console.log('🤖 Calling OpenAI...');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: messages,
                temperature: 0.9,
                max_tokens: 150
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error('❌ OpenAI error:', data.error);
            return res.status(500).json({ error: data.error.message });
        }

        const message = data.choices[0].message.content;
        console.log('✅ OpenAI response:', message);
        res.json({ message: message });

    } catch (error) {
        console.error('❌ Server Error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ElevenLabs TTS endpoint
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

        // Select voice
        let VOICE_ID;
        if (voiceType === 'setup') {
            VOICE_ID = 'ErXwobaYiN019PkySvjV'; // Antoni - American male
        } else {
            VOICE_ID = 'JSWO6cw2AyFE324d5kEr'; // Your custom female voice
        }
        
        console.log('🔊 Using voice ID:', VOICE_ID);
        console.log('🔑 API Key present:', process.env.ELEVENLABS_API_KEY ? 'YES' : 'NO');

        const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
        console.log('📡 Calling:', elevenLabsUrl);

        const response = await fetch(elevenLabsUrl, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': process.env.ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.8,
                    style: 0.5,
                    use_speaker_boost: true
                }
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
        console.error('❌ Full error:', error);
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
    console.log(`🎤 Setup voice: ErXwobaYiN019PkySvjV (Antoni)`);
    console.log(`🎤 OS1 voice: JSWO6cw2AyFE324d5kEr (Your custom voice)`);
    console.log('='.repeat(50));
});
