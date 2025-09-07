const express = require('express');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.json());

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
    const subject = `New Lead ${name ? `from ${name}` : ''}`.trim();
    const text = `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\n\n${message}`;
    await transporter.sendMail({
      from: `"Lakeshore CRM" <${SMTP_USER}>`,
      to: TO_EMAIL || SMTP_USER,
      subject,
      text,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ ok: false, error: 'Email failed' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`CRM server on port ${PORT}`));

// --- SMTP DEBUG (temporary) ---
app.get('/debug-smtp', async (_req, res) => {
  try {
    await transporter.verify(); // checks host/port/auth with Gmail
    res.json({ ok: true, message: 'SMTP verified' });
  } catch (e) {
    res.status(500).json({
      ok: false,
      code: e && e.code,
      command: e && e.command,
      responseCode: e && e.responseCode,
      error: (e && (e.response || e.message || String(e)))
    });
  }
});

// Improve /notify error logging to Render logs
const layer = app._router?.stack?.find(l => l.route && l.route.path === '/notify');
if (layer) {
  const orig = layer.route.stack[0].handle;
  layer.route.stack[0].handle = async (req, res, next) => {
    try { await orig(req, res, next); }
    catch (err) {
      console.error('Email error details:', {
        code: err?.code, command: err?.command, responseCode: err?.responseCode, response: err?.response, message: err?.message
      });
      throw err;
    }
  };
}

// --- TEMP: show if env vars exist (no secrets printed)
app.get('/env-check', (_req, res) => {
  res.json({
    hasHost: !!process.env.SMTP_HOST,
    hasPort: !!process.env.SMTP_PORT,
    hasUser: !!process.env.SMTP_USER,
    hasPass: !!process.env.SMTP_PASS,
    hasTo:   !!process.env.TO_EMAIL
  });
});

// --- TEMP: verify SMTP credentials with Gmail
app.get('/debug-smtp', async (_req, res) => {
  try {
    await transporter.verify(); // checks host/port/auth
    res.json({ ok: true, message: 'SMTP verified' });
  } catch (e) {
    res.status(500).json({
      ok: false,
      code: e?.code,
      command: e?.command,
      responseCode: e?.responseCode,
      error: e?.response || e?.message || String(e)
    });
  }
});
