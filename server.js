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
            VOICE_ID = 'ErXwobaYiN019PkySvjV'; // Antoni - Setup male voice
        } else if (voiceType === 'male') {
            VOICE_ID = 'TxGEqnHWrfWFTfGW9XjX'; // Josh - Male companion
        } else {
            VOICE_ID = 'JSWO6cw2AyFE324d5kEr'; // Your custom female voice
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
