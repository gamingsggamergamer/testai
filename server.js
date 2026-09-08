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

  users[username].credits -= 1;

  try {
    const userContent = [];
    if (message) userContent.push({ type: "text", text: message });
    if (image) userContent.push({ type: "image_url", image_url: { url: image } });

    const response = await openai.chat.completions.create({
      model: 'fable-5.1',
      messages: [{ role: 'user', content: userContent }]
    });

    const botMessage = response.choices[0].message.content;
    const thinkingProcess = "Analyzing Roblox Studio request...\nParsing Luau syntax constraints...\nGenerating clean code structure without comments...";

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
