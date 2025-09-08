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
