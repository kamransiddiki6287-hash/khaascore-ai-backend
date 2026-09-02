import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const app = express();

// सिक्योरिटी कॉन्फ़िगरेशन
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// स्पैम और डीडॉस सुरक्षा
const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'सुरक्षा सीमा पार: कृपया 10 मिनट बाद प्रयास करें।' }
});
app.use('/api/', apiLimiter);

// कोर क्लाइंट्स
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const genAI = new GoogleGenerativeAI(process.env.MASTER_KEY);

// ऑथेंटिकेशन और क्रेडिट गार्ड
async function verifyUserAccess(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'अनधिकृत: कृपया पहले लॉगिन करें।' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      return res.status(401).json({ error: 'अमान्य सेशन। कृपया पुनः लॉगिन करें।' });
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    if (profErr || !profile) {
      return res.status(500).json({ error: 'यूज़र प्रोफ़ाइल लोड करने में असमर्थ।' });
    }

    if (profile.credits <= 0) {
      return res.status(403).json({
        outOfCredits: true,
        error: 'क्रेडिट समाप्त! असीमित एक्सेस के लिए अपना प्लान अपग्रेड करें।'
      });
    }

    req.user = user;
    req.userCredits = profile.credits;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'इंटरनल ऑथेंटिकेशन विफलता: ' + err.message });
  }
}

// AI हब कॉन्फ़िगरेशन (स्पेशलाइज्ड पर्सोना और पैरामीटर्स)
const AI_HUB_CONFIG = {
  viral_scripts: {
    systemInstruction: "You are an elite YouTube Shorts and Instagram Reels strategist. Create high-retention scripts containing: 1. A psychology-based hook (0-3s), 2. Fast-paced body with visual directions in brackets, 3. Strong call to action. Keep language natural, punchy, and cinematic.",
    temperature: 0.85,
    maxTokens: 2500
  },
  shayari_creative: {
    systemInstruction: "You are a celebrated modern Urdu and Hindi poet. Compose original, deeply moving, and rhythmically coherent shayari/couplets. Maintain elegance, rich vocabulary, and profound metaphoric depth.",
    temperature: 0.9,
    maxTokens: 1500
  },
  business_copy: {
    systemInstruction: "You are a high-level SaaS copywriter and brand marketer. Deliver conversion-focused headlines, ad copy, value propositions, and landing page frameworks using direct, persuasive language.",
    temperature: 0.6,
    maxTokens: 2000
  },
  code_engineer: {
    systemInstruction: "You are a Principal Software Architect. Provide clean, robust, modern, and production-grade code solutions with zero fluff. Explain architecture concisely and write error-free code blocks.",
    temperature: 0.3,
    maxTokens: 3000
  },
  content_rewriter: {
    systemInstruction: "You are a professional content editor. Rewrite, polish, and humanize the provided text to eliminate robotic patterns, improve flow, and make it engaging and crystal-clear.",
    temperature: 0.7,
    maxTokens: 2048
  },
  general: {
    systemInstruction: "You are Khaascore AI, a state-of-the-art multi-modal intelligence hub. Provide highly accurate, beautifully formatted, and structured responses.",
    temperature: 0.7,
    maxTokens: 2048
  }
};

// 1. मल्टी-AI हब जनरेशन रूट
app.post('/api/generate', verifyUserAccess, async (req, res) => {
  const { prompt, tool = 'general' } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'कृपया प्रॉम्प्ट टेक्स्ट प्रदान करें।' });
  }

  const selectedTool = AI_HUB_CONFIG[tool] || AI_HUB_CONFIG.general;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: selectedTool.systemInstruction,
      generationConfig: {
        temperature: selectedTool.temperature,
        maxOutputTokens: selectedTool.maxTokens
      }
    });

    const result = await model.generateContent(prompt.trim());
    const generatedText = result.response.text();

    // क्रेडिट डिडक्शन
    const remaining = req.userCredits - 1;
    await supabase
      .from('profiles')
      .update({ credits: remaining })
      .eq('id', req.user.id);

    // हिस्ट्री लॉगिंग
    await supabase.from('generations').insert({
      user_id: req.user.id,
      prompt: prompt.trim(),
      response: generatedText,
      category: tool
    });

    return res.status(200).json({
      success: true,
      output: generatedText,
      creditsRemaining: remaining,
      toolUsed: tool
    });
  } catch (error) {
    console.error('Hub Engine Error:', error);
    return res.status(500).json({ error: 'AI प्रोसेसिंग विफल रही। आपका कोई क्रेडिट नहीं काटा गया है।' });
  }
});

// 2. यूजर हब डैशबोर्ड डेटा (क्रेडिट्स और रीसेंट टूल्स हिस्ट्री)
app.get('/api/user/hub-data', verifyUserAccess, async (req, res) => {
  try {
    const { data: history } = await supabase
      .from('generations')
      .select('id, prompt, response, category, is_favorite, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(15);

    return res.json({
      user: {
        email: req.user.email,
        credits: req.userCredits
      },
      history: history || []
    });
  } catch (err) {
    return res.status(500).json({ error: 'डैशबोर्ड डेटा लोड नहीं हो सका।' });
  }
});

// 3. हेल्थ चेक
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    platform: 'Khaascore AI Enterprise Hub',
    version: '2.0.0'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Khaascore AI Hub is live on port ${PORT}`));
