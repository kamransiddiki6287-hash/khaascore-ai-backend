import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const app = express();

// 1. एंटरप्राइज सिक्योरिटी हेडर्स
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// 2. ऑटोमैटिक थ्रॉटलिंग और स्पैम प्रोटेक्शन
const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'बहुत सारे अनुरोध! सुरक्षा कारणों से 10 मिनट के लिए सिस्टम लॉक किया गया है।' }
});
app.use('/api/', apiLimiter);

// 3. कोर क्लाइंट्स
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const genAI = new GoogleGenerativeAI(process.env.MASTER_KEY);

// 4. ऑथेंटिकेशन और क्रेडिट वेरिफिकेशन गार्ड
async function verifyUserAccess(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'अनधिकृत: कृपया पहले लॉगिन करें।' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      return res.status(401).json({ error: 'अमान्य सेशन टोकन। कृपया पुनः लॉगिन करें।' });
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
        error: 'आपके सभी फ्री क्रेडिट समाप्त हो चुके हैं! असीमित जनरेशन के लिए प्लान अपग्रेड करें।'
      });
    }

    req.user = user;
    req.userCredits = profile.credits;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'इंटरनल ऑथेंटिकेशन विफलता: ' + err.message });
  }
}

// 5. अल्ट्रा-एडवांस्ड स्पेशलाइज्ड AI टूल्स इंजन
const AI_HUB_CONFIG = {
  viral_scripts: {
    systemInstruction: "You are an elite viral video director and retention engineer for YouTube Shorts and Instagram Reels. Structure every script into: 1. Catchy Hook (0-3s, pattern interrupt), 2. Story Body (Visual actions in brackets [ ], dynamic pacing), 3. Emotional Punchline, 4. Strategic CTA. Write in high-energy, relatable language.",
    temperature: 0.85,
    maxTokens: 2500
  },
  shayari_creative: {
    systemInstruction: "You are a legendary Urdu and Hindi poet and lyricist. Craft original, deeply emotional, rhythmically flawless couplets and poetry with classical depth, modern relatability, and rich metaphoric texture.",
    temperature: 0.9,
    maxTokens: 1500
  },
  business_copy: {
    systemInstruction: "You are a high-conversion direct-response SaaS copywriter. Create razor-sharp value propositions, ad hooks, landing page wireframe text, and marketing emails designed to convert visitors into paid customers.",
    temperature: 0.6,
    maxTokens: 2000
  },
  code_engineer: {
    systemInstruction: "You are a Principal Software Architect. Provide production-ready, highly optimized, secure, and bug-free code solutions. Include brief architectural context and modular examples.",
    temperature: 0.2,
    maxTokens: 3000
  },
  content_rewriter: {
    systemInstruction: "You are an expert humanizer and editorial proofreader. Eliminate AI robotic phrasing, enhance flow, improve readability, and deliver authentic, engaging writing.",
    temperature: 0.7,
    maxTokens: 2048
  },
  general: {
    systemInstruction: "You are Khaascore AI, a premier multi-modal intelligent assistant. Provide clear, structured, accurate, and deeply insightful responses.",
    temperature: 0.7,
    maxTokens: 2048
  }
};

// 6. मुख्य AI जनरेशन एंडपॉइंट (टोन और लेंथ सपोर्ट के साथ)
app.post('/api/generate', verifyUserAccess, async (req, res) => {
  const { prompt, tool = 'general', tone = 'balanced', length = 'medium' } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'कृपया एक वैध प्रॉम्प्ट दर्ज करें।' });
  }

  const selectedTool = AI_HUB_CONFIG[tool] || AI_HUB_CONFIG.general;

  // टोन और लेंथ के मुताबिक अतिरिक्त निर्देश
  const customContext = `[Context Settings -> Tone: ${tone}, Target Length: ${length}]. User Query: `;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: selectedTool.systemInstruction,
      generationConfig: {
        temperature: selectedTool.temperature,
        maxOutputTokens: selectedTool.maxTokens
      }
    });

    const result = await model.generateContent(customContext + prompt.trim());
    const generatedText = result.response.text();

    // क्रेडिट डिडक्शन
    const remaining = req.userCredits - 1;
    await supabase
      .from('profiles')
      .update({ credits: remaining })
      .eq('id', req.user.id);

    // जनरेशन हिस्ट्री सेव करना
    const { data: savedRecord } = await supabase
      .from('generations')
      .insert({
        user_id: req.user.id,
        prompt: prompt.trim(),
        response: generatedText,
        category: tool
      })
      .select('id')
      .single();

    return res.status(200).json({
      success: true,
      generationId: savedRecord?.id || null,
      output: generatedText,
      creditsRemaining: remaining,
      toolUsed: tool
    });
  } catch (error) {
    console.error('Generation Error:', error);
    return res.status(500).json({ error: 'AI इंजन से संपर्क विफल रहा। आपका कोई क्रेडिट नहीं काटा गया।' });
  }
});

// 7. प्रॉम्प्ट एन्हांसर एंडपॉइंट (मुफ़्त में प्रॉम्प्ट को 10x बेहतर बनाएँ)
app.post('/api/enhance-prompt', verifyUserAccess, async (req, res) => {
  const { rawPrompt } = req.body;
  if (!rawPrompt?.trim()) return res.status(400).json({ error: 'प्रॉम्प्ट खाली नहीं हो सकता' });

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: "You are a master Prompt Optimizer. Transform weak user input into an ultra-detailed, professional, high-output prompt with rich context and constraints. Return ONLY the enhanced prompt."
    });

    const result = await model.generateContent(`Supercharge this prompt: "${rawPrompt.trim()}"`);
    return res.json({ enhancedPrompt: result.response.text().trim() });
  } catch (err) {
    return res.status(500).json({ error: 'प्रॉम्प्ट ऑप्टिमाइज़ेशन विफल' });
  }
});

// 8. यूजर डैशबोर्ड, हिस्ट्री व क्रेडिट्स
app.get('/api/user/dashboard', verifyUserAccess, async (req, res) => {
  try {
    const { data: history } = await supabase
      .from('generations')
      .select('id, prompt, response, category, is_favorite, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    return res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        credits: req.userCredits
      },
      generations: history || []
    });
  } catch (err) {
    return res.status(500).json({ error: 'डैशबोर्ड डेटा लोड करने में असमर्थ।' });
  }
});

// 9. फेवरेट/बुकमार्क टॉगल एंडपॉइंट
app.patch('/api/generations/:id/favorite', verifyUserAccess, async (req, res) => {
  const { id } = req.params;
  const { is_favorite } = req.body;

  try {
    await supabase
      .from('generations')
      .update({ is_favorite: Boolean(is_favorite) })
      .eq('id', id)
      .eq('user_id', req.user.id);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'बुकमार्क स्टेटस अपडेट विफल' });
  }
});

// 10. हिस्ट्री डिलीट एंडपॉइंट
app.delete('/api/generations/:id', verifyUserAccess, async (req, res) => {
  const { id } = req.params;

  try {
    await supabase
      .from('generations')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    return res.json({ success: true, message: 'रिकॉर्ड हटा दिया गया' });
  } catch (err) {
    return res.status(500).json({ error: 'रिकॉर्ड डिलीट करने में विफलता' });
  }
});

// 11. हेल्थ चेक
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    engine: 'Khaascore AI Enterprise Hub Core',
    version: '3.0.0'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Khaascore AI Ultra Server running on port ${PORT}`));
