const express = require('express');
const cors = require('cors');

const app = express();

// CORS और JSON इनेबल करें
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// होम रूट (चेक करने के लिए)
app.get('/', (req, res) => {
  res.send('KhaasCore AI Backend is Live and Running!');
});

// मुख्य AI चैट एंडपॉइंट (/api/chat)
app.post('/api/chat', async (req, res) => {
  try {
    const { modelName = 'gemini-2.5-flash', contents, systemInstruction, generationConfig } = req.body;

    const apiKey = process.env.MASTER_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'MASTER_KEY Render में सेट नहीं है।' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const payload = {
      contents,
      generationConfig: generationConfig || { temperature: 0.75 }
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).send(errText);
    }

    // लाइव स्ट्रीमिंग हेडर
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // डेटा को सीधे वेबसाइट तक स्ट्रीम करें
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`KhaasCore Server running on port ${PORT}`);
});
