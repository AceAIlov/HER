const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Chat endpoint - Using modern Responses API
app.post('/api/chat', async (req, res) => {
    console.log('📨 Received chat request');
    
    try {
        const { messages } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            console.error('❌ No OpenAI API key found');
            return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        console.log('🤖 Calling OpenAI Responses API with gpt-4o-mini...');

        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                input: messages.map(m => ({
                    role: m.role,
                    content: [{ type: 'text', text: m.content }]
                })),
                temperature: 0.7,
                max_output_tokens: 256
            })
        });

        console.log('📊 OpenAI Status:', response.status);

        const data = await response.json();
        console.log('📦 OpenAI Response:', JSON.stringify(data, null, 2));
        
        if (data.error) {
            console.error('❌ OpenAI error:', data.error);
            
            if (data.error.code === 'insufficient_quota') {
                return res.status(500).json({ 
                    error: 'OpenAI API quota exceeded. Please add credits at https://platform.openai.com/account/billing' 
                });
            }
            
            if (data.error.code === 'invalid_api_key') {
                return res.status(500).json({ 
                    error: 'Invalid OpenAI API key. Please check your key at https://platform.openai.com/api-keys' 
                });
            }
            
            return res.status(500).json({ error: data.error.message || 'OpenAI API error' });
        }

        // Extract output from Responses API format
        const output =
            data.output_text ??
            (data.output?.[0]?.content?.find(c => c.type === 'output_text')?.text) ??
            data;
        
        if (typeof output !== 'string') {
            console.error('❌ Unexpected Responses API shape:', data);
            return res.status(500).json({ error: 'Invalid response from OpenAI' });
        }

        console.log('✅ OpenAI response:', output);
        res.json({ message: output });

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

        // Select voice based on type
        let VOICE_ID;
        if (voiceType === 'setup') {
            VOICE_ID = 'GCH5LqLr0x1cLZVr5T10';
        } else if (voiceType === 'male') {
            VOICE_ID = 'GCH5LqLr0x1cLZVr5T10';
        } else {
            VOICE_ID = 'JSWO6cw2AyFE324d5kEr';
        }
        
        console.log('🔊 Using voice ID:', VOICE_ID);

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
    console.log(`🤖 Using model: gpt-4o-mini (modern Responses API)`);
    console.log(`🎤 Setup voice: GCH5LqLr0x1cLZVr5T10`);
    console.log(`🎤 Male companion: GCH5LqLr0x1cLZVr5T10`);
    console.log(`🎤 Female companion: JSWO6cw2AyFE324d5kEr`);
    console.log('='.repeat(50));
});
