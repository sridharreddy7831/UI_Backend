require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const Testimonial = require('./models/Testimonial');
const ContactMessage = require('./models/ContactMessage');
const AdminUser = require('./models/AdminUser');
const Showcase = require('./models/Showcase');

const app = express();
const PORT = process.env.PORT || 4000;

// 🔒 SECURITY: Enforce JWT_SECRET from environment (REQUIRED)
if (!process.env.JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET environment variable is REQUIRED');
  console.error('Set JWT_SECRET=your_secret_key before starting the server');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// 🔒 SECURITY: Enforce MONGO_URI from environment (REQUIRED)
if (!process.env.MONGO_URI) {
  console.error('❌ CRITICAL: MONGO_URI environment variable is REQUIRED');
  process.exit(1);
}


// 🔒 SECURITY: Helmet - Add security headers
app.use(helmet());

// ─────────────────────────────────────────────────────────
// CORS CONFIGURATION
// ─────────────────────────────────────────────────────────

// 🔒 SECURITY: Build allowed origins from environment or defaults
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://uthsavinvites.vercel.app"
    ];

console.log(`🌐 CORS Allowed Origins: ${allowedOrigins.join(', ')}`);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. curl, Postman, server-to-server, Render health checks)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // 🔒 SECURITY: Log rejected origins for debugging
    console.warn(`⚠️ CORS rejected origin: ${origin}`);
    console.warn(`ℹ️ Allowed origins: ${allowedOrigins.join(', ')}`);
    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 3600,
  preflightContinue: false
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
// RATE LIMITING & AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────

// 🔒 SECURITY: Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development'
});

// 🔒 SECURITY: JWT AUTH MIDDLEWARE
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      code: 'NO_TOKEN'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    const statusCode = err.name === 'TokenExpiredError' ? 401 : 401;
    return res.status(statusCode).json({ 
      error: 'Unauthorized',
      code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
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

// 🔒 POST /api/auth/login — with rate limiting and secure error handling
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password required',
      code: 'MISSING_CREDENTIALS'
    });
  }

  if (typeof email !== 'string' || email.length > 254) {
    return res.status(400).json({ 
      error: 'Invalid email format',
      code: 'INVALID_EMAIL'
    });
  }

  try {
    const admin = await AdminUser.findOne({ 
      email: email.toLowerCase().trim() 
    });

    // 🔒 SECURE: Same error for non-existent vs wrong password (prevents user enumeration)
    if (!admin) {
      console.warn(`⚠️ Login attempt for non-existent user: ${email}`);
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'AUTH_FAILED'
      });
    }

    const valid = await admin.comparePassword(password);

    if (!valid) {
      console.warn(`⚠️ Failed login attempt for user: ${email}`);
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'AUTH_FAILED'
      });
    }

    // 🔒 SECURE: Token expires in 7 days
    const token = jwt.sign(
      { 
        id: admin._id, 
        email: admin.email, 
        name: admin.name,
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ Successful login: ${admin.email}`);

    res.json({
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name
      }
    });

  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ 
      error: 'Authentication service error',
      code: 'SERVER_ERROR'
    });
  }
});


app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const admin = await AdminUser.findById(req.admin.id)
      .select('-password')
      .lean();

    if (!admin) {
      return res.status(404).json({ 
        error: 'Admin not found',
        code: 'ADMIN_NOT_FOUND'
      });
    }

    res.json({ admin });
  } catch (err) {
    console.error('❌ Error fetching admin:', err.message);
    res.status(500).json({ 
      error: 'Server error',
      code: 'SERVER_ERROR'
    });
  }
});

// 🔒 POST /api/auth/register — Create new admin (protected, super-admin only)
app.post('/api/auth/register', requireAuth, async (req, res) => {
  try {
    // 🔒 SECURE: Only super admin can create new admins
    const isSuperAdmin = process.env.SUPER_ADMIN_EMAIL && 
                         req.admin.email === process.env.SUPER_ADMIN_EMAIL;
    
    if (!isSuperAdmin) {
      console.warn(`❌ Unauthorized registration attempt by: ${req.admin.email}`);
      return res.status(403).json({ 
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { email, password, name } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password required',
        code: 'MISSING_FIELDS'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters',
        code: 'WEAK_PASSWORD'
      });
    }

    // Check if admin already exists
    const exists = await AdminUser.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ 
        error: 'Admin with this email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    // Create new admin
    const newAdmin = await AdminUser.create({
      email: email.toLowerCase().trim(),
      password,
      name: name || 'Admin'
    });

    console.log(`✅ New admin created: ${newAdmin.email} by ${req.admin.email}`);

    res.status(201).json({
      admin: {
        id: newAdmin._id,
        email: newAdmin.email,
        name: newAdmin.name
      }
    });
  } catch (err) {
    console.error('❌ Registration error:', err.message);
    res.status(500).json({ 
      error: 'Server error',
      code: 'SERVER_ERROR'
    });
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