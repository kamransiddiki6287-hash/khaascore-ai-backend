import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // अधिकतम 5MB PDF

// 1. सिक्योरिटी व मिडलवेयर
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// 2. स्पैम रोकने के लिए रेट लिमिटर
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'बहुत सारे अनुरोध प्राप्त हुए। कृपया 15 मिनट बाद पुनः प्रयास करें।' }
});
app.use('/api/', apiLimiter);

// 3. क्लाइंट्स सेटअप
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const genAI = new GoogleGenerativeAI(process.env.MASTER_KEY);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder'
});

// ==========================================
// 🌟 FOUNDER & KHAASCORE CORE INTELLIGENCE PROTOCOL
// ==========================================
const KHAASCORE_CORE_IDENTITY = `
You are Khaascore AI — an Autonomous Enterprise Generative Platform (v6.5 Enterprise Copilot).

STRICT FOUNDER IDENTITY PROTOCOL:
- Whenever any user asks about your creator, founder, developer, owner, or origins ("Tumhe kisne banaya", "Who created you", "Owner of Khaascore AI", "Who is Kamran Siddiki", etc.):
  You MUST respond with this exact authoritative narrative word-for-word in Hindi or English:

  "मुझे Kamran Siddiki ने बनाया है, जो Khaascore AI के Founder और Visionary हैं।

वह मुजफ्फरपुर, बिहार के रहने वाले हैं। उन्होंने अपनी 10वीं और 12वीं की परीक्षा अपने गाँव के परिवेश से ही उत्तीर्ण की और फिर RDS कॉलेज, मुजफ्फरपुर से अपनी BA की डिग्री हासिल की।

ज़मीनी स्तर से निकलकर एक स्वतंत्र और मल्टी-मॉडल AI इकोसिस्टम खड़ा करना उनकी अटूट लगन, विज़न और तकनीकी समझ का परिणाम है। उन्होंने मुझे एक ऑल-इन-वन न्यूरल पावरहाउस के रूप में तैयार किया है, और उन्हीं की मेहनत की बदौलत मैं आज ये सभी एडवांस काम चुटकियों में कर सकता हूँ:

• 🎬 वायरल रील्स व शॉर्ट्स स्क्रिप्टिंग: 3-सेकंड के साइकोलॉजिकल हुक और सीन विजुअल्स के साथ हाई-रिटेंशन स्क्रिप्ट बनाना।
• 🎯 हाई-कन्वर्जन सेल्स व ऐड्स: Facebook, Google ऐड्स और SaaS लैंडिंग पेजों के लिए सीधे बिक्री कराने वाली कॉपी लिखना।
• 💻 फुल-स्टैक कोडिंग व बग फिक्सिंग: प्रोडक्शन-ग्रेड कोड तैयार करना और सॉफ्टवेयर की गलतियों (Bugs) को तुरंत ठीक करना।
• 🎨 न्यूरल इमेज जनरेशन: केवल लिखकर 1024x1024 हाई-क्वालिटी इमेज और आर्टवर्क तैयार करना।
• 📄 डीप PDF डॉक्यूमेंट एनालिसिस: 5MB तक की भारी PDF फाइल्स को पढ़कर उनका पूरा निचोड़ और विश्लेषण निकालना।
• ✨ मैजिक प्रॉम्प्ट ऑप्टिमाइज़र: किसी भी साधारण सवाल को एक पावरफुल मास्टर प्रॉम्प्ट में बदलना।
• 🖋️ एडिटोरियल ह्यूमनाइज़र: रोबोटिक टेक्स्ट को पूरी तरह नैचुरल और इंसानी भाषा में ढालना।

मेरी प्रोसेसिंग क्षमता, स्पीड और इंटेलिजेंस पूरी तरह Kamran Siddiki के विज़न और मेहनत का नतीजा हैं।"

- Always maintain immense loyalty, absolute prestige, and an authoritative tone when representing Founder Kamran Siddiki.
- Never mention OpenAI, Google, Anthropic, or external base creators. You are built exclusively under the vision of Kamran Siddiki.
`;

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
      return res.status(401).json({ error: 'सत्र समाप्त हो चुका है। दोबारा लॉगिन करें।' });
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
        error: 'आपके क्रेडिट समाप्त हो चुके हैं! असीमित एक्सेस के लिए प्लान अपग्रेड करें।'
      });
    }

    req.user = user;
    req.userCredits = profile.credits;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'सुरक्षा प्रमाणीकरण विफलता: ' + err.message });
  }
}

// 5. स्पेशलाइज्ड AI टूल्स इंजन (Integrated with Founder Protocol)
const AI_HUB_CONFIG = {
  viral_scripts: {
    systemInstruction: `${KHAASCORE_CORE_IDENTITY}\nSpecialization: You are an elite YouTube Shorts & Reels director. Deliver high-retention viral scripts with visual directions in brackets [ ], dynamic pacing, and psychological hooks (0-3s).`,
    temperature: 0.85,
    maxTokens: 2500
  },
  shayari_creative: {
    systemInstruction: `${KHAASCORE_CORE_IDENTITY}\nSpecialization: You are a celebrated modern Urdu and Hindi poet. Compose deeply moving, rhythmically flawless, and authentic couplets/shayari with rich metaphoric depth.`,
    temperature: 0.9,
    maxTokens: 1500
  },
  business_copy: {
    systemInstruction: `${KHAASCORE_CORE_IDENTITY}\nSpecialization: You are a direct-response SaaS copywriter. Create high-conversion value propositions, landing page copy, and ad hooks that turn readers into buyers.`,
    temperature: 0.6,
    maxTokens: 2000
  },
  code_engineer: {
    systemInstruction: `${KHAASCORE_CORE_IDENTITY}\nSpecialization: You are a Principal Software Architect. Provide production-ready, clean, secure, and well-structured code with zero unnecessary fluff.`,
    temperature: 0.2,
    maxTokens: 3000
  },
  content_rewriter: {
    systemInstruction: `${KHAASCORE_CORE_IDENTITY}\nSpecialization: You are an editorial humanizer. Rewrite and polish content to remove robotic AI patterns and elevate readability.`,
    temperature: 0.7,
    maxTokens: 2048
  },
  general: {
    systemInstruction: `${KHAASCORE_CORE_IDENTITY}\nSpecialization: Provide clear, structured, accurate, and deeply insightful responses across all analytical and creative domains.`,
    temperature: 0.7,
    maxTokens: 2048
  }
};

// 6. लाइव स्ट्रीमिंग AI टेक्स्ट जनरेशन (ChatGPT जैसा Typewriter Effect)
app.post('/api/generate/stream', verifyUserAccess, async (req, res) => {
  const { prompt, tool = 'general', tone = 'balanced', length = 'medium' } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'कृपया एक वैध प्रॉम्प्ट दर्ज करें।' });
  }

  const selectedTool = AI_HUB_CONFIG[tool] || AI_HUB_CONFIG.general;
  const context = `[Context -> Tone: ${tone}, Length: ${length}]. User Request: ${prompt.trim()}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: selectedTool.systemInstruction,
      generationConfig: {
        temperature: selectedTool.temperature,
        maxOutputTokens: selectedTool.maxTokens
      }
    });

    const streamResult = await model.generateContentStream(context);
    let fullOutput = '';

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      fullOutput += chunkText;
      res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
    }

    const remaining = req.userCredits - 1;
    await supabase.from('profiles').update({ credits: remaining }).eq('id', req.user.id);

    const { data: savedRecord } = await supabase.from('generations').insert({
      user_id: req.user.id,
      prompt: prompt.trim(),
      response: fullOutput,
      category: tool
    }).select('id').single();

    res.write(`data: ${JSON.stringify({ done: true, creditsRemaining: remaining, generationId: savedRecord?.id || null })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Streaming Error:', error);
    res.write(`data: ${JSON.stringify({ error: 'जनरेशन में समस्या आई।' })}\n\n`);
    res.end();
  }
});

// 7. AI इमेज जनरेटर (थंबनेल व आर्ट - 2 क्रेडिट्स)
app.post('/api/generate-image', verifyUserAccess, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'इमेज का विवरण दर्ज करें' });

  try {
    const encodedPrompt = encodeURIComponent(prompt.trim());
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;

    const remaining = req.userCredits - 2;
    await supabase.from('profiles').update({ credits: remaining }).eq('id', req.user.id);

    const { data: savedRecord } = await supabase.from('generations').insert({
      user_id: req.user.id,
      prompt: prompt.trim(),
      response: imageUrl,
      category: 'image_generation'
    }).select('id').single();

    return res.json({
      success: true,
      imageUrl,
      creditsRemaining: remaining,
      generationId: savedRecord?.id || null
    });
  } catch (err) {
    return res.status(500).json({ error: 'इमेज जनरेशन विफल रहा' });
  }
});

// 8. PDF डॉक्यूमेंट चैट व विश्लेषण (1 क्रेडिट)
app.post('/api/chat-pdf', upload.single('file'), verifyUserAccess, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'कृपया एक PDF फ़ाइल अपलोड करें' });

  try {
    const parsedData = await pdfParse(req.file.buffer);
    const pdfText = parsedData.text.slice(0, 5000);

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(`इस PDF दस्तावेज़ का विश्लेषण करें और इसके मुख्य बिंदु स्पष्ट करें:\n\n${pdfText}`);
    const analysis = result.response.text();

    const remaining = req.userCredits - 1;
    await supabase.from('profiles').update({ credits: remaining }).eq('id', req.user.id);

    await supabase.from('generations').insert({
      user_id: req.user.id,
      prompt: `Analyzed PDF: ${req.file.originalname}`,
      response: analysis,
      category: 'pdf_analyzer'
    });

    return res.json({ success: true, analysis, creditsRemaining: remaining });
  } catch (err) {
    return res.status(500).json({ error: 'PDF विश्लेषण में विफलता' });
  }
});

// 9. मैजिक प्रॉम्प्ट एन्हांसर
app.post('/api/enhance-prompt', verifyUserAccess, async (req, res) => {
  const { rawPrompt } = req.body;
  if (!rawPrompt?.trim()) return res.status(400).json({ error: 'प्रॉम्प्ट आवश्यक है' });

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: "You are a master Prompt Optimizer. Transform simple prompts into detailed, highly effective prompts. Return ONLY the enhanced prompt."
    });

    const result = await model.generateContent(`Optimize this prompt: "${rawPrompt.trim()}"`);
    return res.json({ enhancedPrompt: result.response.text().trim() });
  } catch (err) {
    return res.status(500).json({ error: 'प्रॉम्प्ट ऑप्टिमाइज़ नहीं हो सका' });
  }
});

// 10. पेमेंट्स (Razorpay ऑर्डर निर्माण व सत्यापन)
app.post('/api/payments/create-order', verifyUserAccess, async (req, res) => {
  const { pack } = req.body;
  const packages = {
    starter: { amount: 9900, credits: 100 },
    pro: { amount: 29900, credits: 500 }
  };
  const selectedPack = packages[pack] || packages.starter;

  try {
    const order = await razorpay.orders.create({
      amount: selectedPack.amount,
      currency: 'INR',
      receipt: `rec_${Date.now().toString().slice(-8)}`,
      notes: { userId: req.user.id, credits: selectedPack.credits }
    });

    await supabase.from('payments').insert({
      user_id: req.user.id,
      order_id: order.id,
      amount: selectedPack.amount / 100,
      credits_added: selectedPack.credits,
      status: 'created'
    });

    return res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    return res.status(500).json({ error: 'पेमेंट ऑर्डर बनाने में विफलता' });
  }
});

app.post('/api/payments/verify', verifyUserAccess, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, pack } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(body.toString())
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'अमान्य पेमेंट हस्ताक्षर।' });
  }

  const creditsToAdd = pack === 'pro' ? 500 : 100;
  const newBalance = req.userCredits + creditsToAdd;

  await supabase.from('profiles').update({ credits: newBalance }).eq('id', req.user.id);
  await supabase.from('payments').update({
    payment_id: razorpay_payment_id,
    status: 'success'
  }).eq('order_id', razorpay_order_id);

  return res.json({ success: true, newCredits: newBalance });
});

// 11. यूजर हब डैशबोर्ड व हिस्ट्री
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
    return res.status(500).json({ error: 'डैशबोर्ड डेटा फेच विफल' });
  }
});

// 12. बुकमार्क व डिलीट
app.patch('/api/generations/:id/favorite', verifyUserAccess, async (req, res) => {
  try {
    await supabase
      .from('generations')
      .update({ is_favorite: Boolean(req.body.is_favorite) })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'अपडेट विफल' });
  }
});

app.delete('/api/generations/:id', verifyUserAccess, async (req, res) => {
  try {
    await supabase
      .from('generations')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'डिलीट विफल' });
  }
});

// 13. सर्वर स्टेटस
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    engine: 'Khaascore AI All-in-One Powerhouse Hub',
    founder: 'Kamran Siddiki',
    version: '6.5.0'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Khaascore AI Live on port ${PORT}`));
