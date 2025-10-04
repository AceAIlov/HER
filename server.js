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
    console.log('Received chat request');
    
    try {
        const { messages } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            console.error('No OpenAI API key found');
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        console.log('Calling OpenAI...');

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
        console.log('OpenAI response received');
        
        if (data.error) {
            console.error('OpenAI error:', data.error);
            return res.status(500).json({ error: data.error.message });
        }

        const message = data.choices[0].message.content;
        console.log('Sending response:', message);
        res.json({ message: message });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// ElevenLabs TTS endpoint with YOUR custom voice
app.post('/api/tts', async (req, res) => {
    console.log('Received TTS request');
    
    try {
        const { text } = req.body;

        if (!process.env.ELEVENLABS_API_KEY) {
            console.error('No ElevenLabs API key found');
            return res.status(500).json({ error: 'ElevenLabs API key not configured' });
        }

        // YOUR CUSTOM VOICE ID
        const VOICE_ID = 'JSWO6cw2AyFE324d5kEr';
        
        console.log('Calling ElevenLabs TTS with your custom voice...');

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
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

        if (!response.ok) {
            const errorText = await response.text();
            console.error('ElevenLabs error:', errorText);
            throw new Error('ElevenLabs API error: ' + errorText);
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Audio generated with your voice, size:', audioBuffer.byteLength);

        // Convert ArrayBuffer to base64
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        res.json({ audio: audioBase64 });

    } catch (error) {
        console.error('❌ TTS Error:', error);
        res.status(500).json({ error: error.message || 'TTS generation failed' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Configured' : 'MISSING'}`);
    console.log(`✅ ElevenLabs API Key: ${process.env.ELEVENLABS_API_KEY ? 'Configured' : 'MISSING'}`);
    console.log(`🎤 Using custom voice ID: JSWO6cw2AyFE324d5kEr`);
});
