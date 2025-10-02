import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ---- STT
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio' });
    const tmpPath = path.join(__dirname, 'tmp.webm');
    fs.writeFileSync(tmpPath, req.file.buffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-1'
    });
    fs.unlinkSync(tmpPath);
    res.json({ text: transcription.text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ---- TTS helper (for onboarding interviewer voice)
app.post('/api/say', async (req, res) => {
  try {
    const { text, voice = 'alloy' } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Missing text' });
    const tts = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      format: 'mp3'
    });
    const audioArrayBuffer = await tts.arrayBuffer();
    res.json({ audioBase64: Buffer.from(audioArrayBuffer).toString('base64') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'TTS failed' });
  }
});

// ---- Respond (LLM → TTS)
app.post('/api/respond', async (req, res) => {
  try {
    const { history = [], userText, prefs } = req.body || {};

    const persona = `You are a calm, warm OS companion. Address the user as ${prefs?.name || 'friend'}. Tone: ${prefs?.tone || 'balanced'}. Social: ${prefs?.social || 'balanced'}. Mother note: ${prefs?.mother || 'not provided'} (handle gently; don't pry). Keep replies ≤120 words. Avoid imitating real people or copyrighted characters.`;

    const messages = [
      { role: 'system', content: persona },
      ...history,
      { role: 'user', content: userText }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.6
    });
    const replyText = completion.choices?.[0]?.message?.content?.trim() || '…';

    const voiceMap = { feminine: 'alloy', neutral: 'alloy', masculine: 'alloy' };
    const chosenVoice = voiceMap[prefs?.voice || 'neutral'] || 'alloy';

    const tts = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: chosenVoice,
      input: replyText,
      format: 'mp3'
    });
    const audioArrayBuffer = await tts.arrayBuffer();
    res.json({ replyText, audioBase64: Buffer.from(audioArrayBuffer).toString('base64') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Response failed' });
  }
});

// ---- Static files (production)
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
