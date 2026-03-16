require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const Testimonial = require('./models/Testimonial');
const ContactMessage = require('./models/ContactMessage');
const AdminUser = require('./models/AdminUser');
const Showcase = require('./models/Showcase');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_in_production';


// ─────────────────────────────────────────────────────────
// CORS CONFIGURATION
// ─────────────────────────────────────────────────────────

const allowedOrigins = [
  "http://localhost:5173",
  "https://uthsavinvites.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: '10mb' }));

// Serve documentation
app.use('/docs', express.static('docs'));

// ─────────────────────────────────────────────────────────
// EMAIL CONFIGURATION
// ─────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


const sendInquiryAlert = async (msg) => {

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.NOTIFICATION_EMAIL) {
    console.log('ℹ️ Email notifications skipped (config missing)');
    return;
  }

  const mailOptions = {
    from: `"Uthsav Alerts" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFICATION_EMAIL,
    subject: `✨ New Inquiry: ${msg.name} (${msg.eventType || 'General'})`,
    html: `
      <div style="font-family: sans-serif; max-width:600px; padding:20px;">
        <h2 style="color:#D4AF37;">🎉 New Inquiry Received!</h2>
        <p><strong>Name:</strong> ${msg.name}</p>
        <p><strong>Phone:</strong> ${msg.phone}</p>
        <p><strong>Event:</strong> ${msg.eventType || 'Not specified'}</p>
        <p><strong>Date:</strong> ${msg.eventDate ? new Date(msg.eventDate).toLocaleDateString() : 'TBD'}</p>
        <p><strong>Message:</strong> ${msg.message || 'No message provided.'}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email alert sent`);
  } catch (err) {
    console.error('❌ Email failed:', err.message);
  }
};


// ─────────────────────────────────────────────────────────
// JWT AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────

const requireAuth = (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'Unauthorized — no token provided' });

  const token = authHeader.split(' ')[1];

  try {

    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();

  } catch (err) {

    return res.status(401).json({ error: 'Unauthorized — invalid or expired token' });

  }
};


// ─────────────────────────────────────────────────────────
// MONGODB CONNECTION
// ─────────────────────────────────────────────────────────

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });


// ─────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.send("Backend is running successfully");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});


// ─────────────────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {

  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  try {

    const admin = await AdminUser.findOne({ email: email.toLowerCase().trim() });

    if (!admin)
      return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await admin.comparePassword(password);

    if (!valid)
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: admin._id, email: admin.email, name: admin.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name
      }
    });

  } catch (err) {

    res.status(500).json({ error: err.message });

  }
});


app.get('/api/auth/me', requireAuth, async (req, res) => {

  try {

    const admin = await AdminUser.findById(req.admin.id).select('-password');

    if (!admin)
      return res.status(404).json({ error: 'Admin not found' });

    res.json({ admin });

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


// ─────────────────────────────────────────────────────────
// TESTIMONIAL ROUTES
// ─────────────────────────────────────────────────────────

app.get('/api/testimonials', async (req, res) => {

  try {

    const testimonials = await Testimonial.find().sort({ order: 1 });

    res.json(testimonials);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


app.post('/api/testimonials', requireAuth, async (req, res) => {

  try {

    const count = await Testimonial.countDocuments();

    const testimonial = new Testimonial({
      ...req.body,
      order: count
    });

    await testimonial.save();

    res.status(201).json(testimonial);

  } catch (err) {

    res.status(400).json({ error: err.message });

  }

});


// ─────────────────────────────────────────────────────────
// CONTACT FORM
// ─────────────────────────────────────────────────────────

app.post('/api/messages', async (req, res) => {

  try {

    const message = new ContactMessage(req.body);

    await message.save();

    sendInquiryAlert(message);

    res.status(201).json(message);

  } catch (err) {

    res.status(400).json({ error: err.message });

  }

});


// ─────────────────────────────────────────────────────────
// SHOWCASE ROUTES
// ─────────────────────────────────────────────────────────

app.get('/api/showcases/:category', async (req, res) => {

  try {

    const sc = await Showcase
      .find({ category: req.params.category })
      .sort({ order: 1 });

    res.json(sc);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});


// ─────────────────────────────────────────────────────────
// SERVER START
// ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
});