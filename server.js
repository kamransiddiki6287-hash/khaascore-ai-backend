import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const app = express();

// सिक्योरिटी और क्रॉस-ओरिजिन सेटअप
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// स्पैम रोकने के लिए रेट लिमिटर (15 मिनट में अधिकतम 60 रिक्वेस्ट प्रति IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'बहुत सारे अनुरोध प्राप्त हुए। कृपया 15 मिनट बाद पुनः प्रयास करें।' }
});
app.use('/api/', apiLimiter);

// Supabase एडमिन क्लाइंट
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Google Gemini क्लाइंट
const genAI = new GoogleGenerativeAI(process.env.MASTER_KEY);

// प्रमाणीकरण और क्रेडिट वेरिफिकेशन मिडलवेयर
async function verifyUserAndCredits(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'अनधिकृत: कृपया पहले लॉगिन करें।' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'सत्र समाप्त हो चुका है, दोबारा लॉगिन करें।' });
    }

    // डेटाबेस से वर्तमान क्रेडिट निकालें
    const { data: profile, error: dbError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    if (dbError || !profile) {
      return res.status(500).json({ error: 'यूजर प्रोफाइल लोड करने में विफल।' });
    }

    if (profile.credits <= 0) {
      return res.status(403).json({
        outOfCredits: true,
        error: 'आपके क्रेडिट समाप्त हो चुके हैं। अधिक जनरेशन के लिए प्लान अपग्रेड करें।'
      });
    }

    req.user = user;
    req.currentCredits = profile.credits;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'सुरक्षा प्रमाणीकरण त्रुटि: ' + err.message });
  }
}

// 1. AI जनरेशन एंडपॉइंट
app.post('/api/generate', verifyUserAndCredits, async (req, res) => {
  const { prompt, mode = 'general' } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'कृपया एक वैध और अर्थपूर्ण प्रॉम्प्ट दर्ज करें।' });
  }

  if (prompt.trim().length > 3000) {
    return res.status(400).json({ error: 'प्रॉम्प्ट बहुत लंबा है। अधिकतम 3000 अक्षरों की अनुमति है।' });
  }

  try {
    // प्रोफेशनल सिस्टम इंस्ट्रक्शन
    const systemInstructions = {
      general: "You are Khaascore AI, a world-class creative and analytical assistant. Provide structured, accurate, and engaging answers with clean formatting.",
      creative: "You are an elite copywriter and scriptwriter for YouTube Shorts, Reels, and viral marketing. Focus on hooks, pacing, and emotional punch.",
      business: "You are a senior business consultant. Provide strategic, crisp, and professional advice with clear execution steps."
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstructions[mode] || systemInstructions.general
    });

    const result = await model.generateContent(prompt.trim());
    const generatedText = result.response.text();

    // 1 क्रेडिट डिडक्ट करें
    const remainingCredits = req.currentCredits - 1;
    await supabase
      .from('profiles')
      .update({ credits: remainingCredits })
      .eq('id', req.user.id);

    return res.status(200).json({
      success: true,
      output: generatedText,
      creditsRemaining: remainingCredits
    });
  } catch (err) {
    console.error('Generation Error:', err);
    return res.status(500).json({ error: 'AI इंजन से संपर्क करने में समस्या आई। कृपया पुनः प्रयास करें।' });
  }
});

// 2. यूजर क्रेडिट स्टेटस एंडपॉइंट
app.get('/api/user/credits', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'टोकन मौजूद नहीं है' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'अमान्य यूजर' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    return res.json({ credits: profile?.credits ?? 0, email: user.email });
  } catch (err) {
    return res.status(500).json({ error: 'डेटा फेच विफल' });
  }
});

// 3. हेल्थ चेक रूट
app.get('/', (req, res) => {
  res.send('Khaascore AI High-Performance Engine is Active and Healthy.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Khaascore AI Backend running on port ${PORT}`);
});
