const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/api/chat', async (req, res) => {
    console.log('Received chat request');
    
    try {
        const { messages } = req.body;

        if (!process.env.OPENAI_API_KEY) {
            console.error('No API key found');
            return res.status(500).json({ error: 'API key not configured' });
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Configured' : 'MISSING'}`);
});
