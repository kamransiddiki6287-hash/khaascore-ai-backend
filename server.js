const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

app.post('/api/chat', async (req, res) => {
  try {
    const { modelName, contents, generationConfig, systemInstruction } = req.body;
    
    // यह लाइन मशीन को बता रही है कि चाबी 'सीक्रेट तिजोरी' (Render) से उठानी है
    const apiKey = process.env.MASTER_KEY; 

    if (!apiKey) {
      return res.status(500).json({ error: "API Key नहीं मिली! कृपया सर्वर पर MASTER_KEY सेट करें।" });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction, contents, generationConfig })
    });

    if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).send(errText);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    response.body.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KhaasCore Backend running on port ${PORT}`));

