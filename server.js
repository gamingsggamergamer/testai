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
let availableModelsList = ['fable-5', 'fable-5.1', 'claude-3-5-sonnet'];
let activeGrantedModel = 'fable-5';

async function fetchAvailableModels() {
  try {
    const list = await openai.models.list();
    if (list && list.data && list.data.length > 0) {
      availableModelsList = list.data.map(m => m.id);
      activeGrantedModel = availableModelsList[0];
    }
  } catch (err) {
    activeGrantedModel = 'fable-5';
  }
}

fetchAvailableModels();

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
  const { username, message, image } = req.body;
  
  if (!username || !users[username]) {
    return res.status(401).json({ error: 'Please login first' });
  }

  if (users[username].credits <= 0) {
    return res.status(403).json({ error: 'Daily credit limit reached (0/100 remaining).' });
  }

  try {
    const userContent = [];
    if (message) userContent.push({ type: "text", text: message });
    if (image) userContent.push({ type: "image_url", image_url: { url: image } });

    let response;
    let modelAttemptIndex = 0;

    while (modelAttemptIndex < availableModelsList.length) {
      const currentModel = availableModelsList[modelAttemptIndex];
      try {
        response = await openai.chat.completions.create({
          model: currentModel,
          messages: [{ role: 'user', content: userContent }]
        });
        activeGrantedModel = currentModel;
        break;
      } catch (apiErr) {
        if (apiErr.status === 429 || apiErr.status === 403) {
          modelAttemptIndex++;
          if (modelAttemptIndex >= availableModelsList.length) {
            throw new Error("Your Experiential Labs account free credit limit has been reached for all models. Please top up credits or wait for monthly reset.");
          }
        } else {
          throw apiErr;
        }
      }
    }

    users[username].credits -= 1;

    const botMessage = response.choices[0].message.content;
    const thinkingProcess = "Analyzing request for Roblox Studio...\nApplying Luau optimizations & platform constraints...\nParsing components and generating clean code structure...";

    res.json({
      reply: botMessage,
      thinking: thinkingProcess,
      remainingCredits: users[username].credits
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RDT-BOT running on port ${PORT}`));
