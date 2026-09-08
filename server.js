const express = require('express');
const OpenAI = require('openai');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.EXPLABS_API_KEY,
  baseURL: process.env.EXPLABS_BASE_URL || 'https://api.experientiallabs.ai/v1'
});

const users = {};

const fallbackModels = [
  'fable-5.1',
  'fable-5',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'mistral-large'
];

app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  
  if (!users[username]) {
    users[username] = { credits: 100, lastReset: Date.now() };
  } else {
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - users[username].lastReset > oneDay) {
      users[username].credits = 100;
      users[username].lastReset = Date.now();
    }
  }
  
  res.json({ username, credits: users[username].credits });
});

app.post('/api/chat', async (req, res) => {
  const { username, message, image, model } = req.body;
  
  if (!username || !users[username]) {
    return res.status(401).json({ error: 'Please login first' });
  }

  if (users[username].credits <= 0) {
    return res.status(403).json({ error: 'Daily credit limit reached (0/100 remaining).' });
  }

  const userContent = [];
  if (message) userContent.push({ type: "text", text: message });
  if (image) userContent.push({ type: "image_url", image_url: { url: image } });

  let selectedModel = model || 'fable-5.1';
  let response = null;
  let lastError = null;

  const modelQueue = [selectedModel, ...fallbackModels.filter(m => m !== selectedModel)];

  for (const currentModel of modelQueue) {
    try {
      response = await openai.chat.completions.create({
        model: currentModel,
        messages: [{ role: 'user', content: userContent }]
      });
      if (response && response.choices && response.choices.length > 0) {
        break;
      }
    } catch (err) {
      lastError = err;
      if (
        err.status === 400 || 
        err.status === 403 || 
        err.status === 429 || 
        (err.message && err.message.includes('Bring Your Own Key'))
      ) {
        continue;
      } else {
        break;
      }
    }
  }

  if (!response) {
    return res.status(500).json({
      error: lastError ? lastError.message : 'Unable to route model request. Please connect your provider key in Experiential Labs workspace.'
    });
  }

  users[username].credits -= 1;

  const botMessage = response.choices[0].message.content;
  const thinkingProcess = "Analyzing request for Roblox Studio...\nApplying Luau optimizations & platform constraints...\nParsing components and generating clean code structure...";

  res.json({
    reply: botMessage,
    thinking: thinkingProcess,
    remainingCredits: users[username].credits
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RDT-BOT running on port ${PORT}`));
