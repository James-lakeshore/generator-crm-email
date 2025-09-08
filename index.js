const express = require('express');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.json());

// Optional shared-secret: only enforce if SECRET_TOKEN is set
app.use((req, res, next) => {
  if (process.env.SECRET_TOKEN && req.path === '/notify') {
    const sent = req.header('x-secret-token');
    if (sent !== process.env.SECRET_TOKEN) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }
  next();
});

// Health check
app.get('/', (_req, res) => res.send('CRM server OK'));

// Email route
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, TO_EMAIL } = process.env;
const transporter = nodemailer.createTransport({
  host: SMTP_HOST || 'smtp.gmail.com',
  port: Number(SMTP_PORT || 587),
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

app.post('/notify', async (req, res) => {
  try {
    const { name = '', email = '', phone = '', message = '' } = req.body || {};
    const subject = `New Lead${name ? ` from ${name}` : ''}`.trim();
    const text = `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${message}`;
    await transporter.sendMail({
      from: `"Lakeshore CRM" <${SMTP_USER}>`,
      to: TO_EMAIL || SMTP_USER,
      subject,
      text,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Email error:', err?.message || err);
    res.status(500).json({ ok: false, error: 'Email failed' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`CRM server on port ${PORT}`));
const rateLimit = require('express-rate-limit');
app.use('/notify', rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 10,               // 10 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false
}));
const rateLimit = require('express-rate-limit');
app.use('/notify', rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // 10 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false
}));

// --- Rate limit /notify (protect against bursts) ---
try {
  const rateLimit = require('express-rate-limit');
  app.use('/notify', rateLimit({
    windowMs: 60 * 1000,   // 1 minute
    max: 10,               // 10 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false
  }));
  console.log('Rate limit enabled on /notify');
} catch (e) {
  console.log('Rate limit not applied:', e && e.message);
}

// --- Tally payload normalizer for /notify ---
function normalizeTallyPayload(body) {
  if (body && body.data && Array.isArray(body.data.fields)) {
    const fields = body.data.fields;
    const pick = (...labels) => {
      const lower = labels.map(l => String(l).toLowerCase());
      const hit = fields.find(f => lower.includes(String(f.label || '').toLowerCase()));
      return hit?.value ?? '';
    };
    const name = pick('Name', 'Full name');
    const email = pick('Email');
    const phone = pick('Phone', 'Phone number');
    const message = pick('Message', 'Long text', 'Comments', 'Notes', 'Inquiry');
    return { name, email, phone, message };
  }
  return null;
}

// Wrap the existing /notify handler so we can rewrite req.body if it's a Tally webhook
const notifyLayer = app._router?.stack?.find(l => l.route && l.route.path === '/notify');
if (notifyLayer) {
  const original = notifyLayer.route.stack[0].handle;
  notifyLayer.route.stack[0].handle = async (req, res, next) => {
    try {
      if (req.method === 'POST' && req.is('application/json')) {
        const norm = normalizeTallyPayload(req.body);
        if (norm) req.body = norm;  // now your existing handler sees {name,email,phone,message}
      }
    } catch {}
    return original(req, res, next);
  };
}
