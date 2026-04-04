require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// 🔒 SECURITY: Escape user-controlled strings before injecting into HTML contexts
const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

const Testimonial = require('./models/Testimonial');
const ContactMessage = require('./models/ContactMessage');
const AdminUser = require('./models/AdminUser');
const Showcase = require('./models/Showcase');
const Category = require('./models/Category');

const app = express();
const PORT = process.env.PORT || 4000;

// Serve local uploads if Cloudinary is not configured
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🔒 SECURITY: Enforce JWT_SECRET from environment (REQUIRED)
if (!process.env.JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET environment variable is REQUIRED');
  console.error('Generate one with: node -e "require(\'crypto\').randomBytes(64).toString(\'hex\')"');
  process.exit(1);
}
// 🔒 SECURITY: Reject weak JWT secrets (common mistake in dev → production bleed)
if (process.env.JWT_SECRET.length < 32) {
  console.error('❌ CRITICAL: JWT_SECRET is too short (minimum 32 characters required)');
  console.error('A short secret can be brute-forced. Generate a proper one:');
  console.error('  node -e "require(\'crypto\').randomBytes(64).toString(\'hex\')"');
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
const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://uthsavinvites.vercel.app",
  "https://uthsavinvites.in",
  "https://www.uthsavinvites.in"
];

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? [...new Set([...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()), ...defaultOrigins])]
  : defaultOrigins;

// Log origin count only, not the full list (avoid leaking allowed domains in logs)
console.log(`🌐 CORS configured for ${allowedOrigins.length} allowed origins`);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no Origin header (same-origin, curl, Postman, health checks)
    // These are NOT cross-origin requests and don't need CORS validation
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // 🔒 SECURITY: Log only the rejected origin, not the allowed list
    console.warn(`⚠️ CORS rejected origin: ${origin}`);
    return callback(new Error('CORS policy violation'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600,
  preflightContinue: false
}));

app.use(express.json({ limit: '2mb' })); // 🔒 Reduced payload limit (10mb → 2mb) — Base64 images should use cloud storage

// ─────────────────────────────────────────────────────────
// 🔒 GLOBAL RATE LIMITER
// ─────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' },
  skip: (req) => process.env.NODE_ENV === 'development'
});
app.use(globalLimiter);

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
    // 🔒 BUG FIX: Expired tokens → 401 (client should re-login). Tampered/invalid tokens → 403 (Forbidden).
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(isExpired ? 401 : 403).json({ 
      error: isExpired ? 'Session expired. Please log in again.' : 'Forbidden',
      code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
};

// Stricter limiter for the public contact form — prevents spam floods
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many inquiries submitted. Please try again later.', code: 'RATE_LIMITED' },
  keyGenerator: (req) => req.ip
});



// ─────────────────────────────────────────────────────────
// ☁️  IMAGE UPLOAD (Cloudinary)
// ─────────────────────────────────────────────────────────

// Multer: memory storage, images only, 5MB cap
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

const cloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log('☁️  Cloudinary configured for image uploads');
} else {
  console.warn('⚠️  Cloudinary not configured — set CLOUDINARY_* env vars to enable image uploads');
}

// POST /api/uploads/image — upload a showcase image to Cloudinary or local storage
app.post('/api/uploads/image', requireAuth, uploadMiddleware.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided', code: 'NO_FILE' });
  }

  if (cloudinaryConfigured) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'uthsav/showcases', resource_type: 'image' },
          (error, result) => { if (error) reject(error); else resolve(result); }
        );
        stream.end(req.file.buffer);
      });
      res.json({ url: result.secure_url, publicId: result.public_id });
    } catch (err) {
      console.error('❌ Cloudinary upload failed:', err.message);
      res.status(500).json({ error: 'Image upload failed. Please try again.', code: 'UPLOAD_FAILED' });
    }
  } else {
    // Local File Storage Fallback
    try {
      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const fileName = `img_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname) || '.jpg'}`;
      const filePath = path.join(uploadDir, fileName);
      
      fs.writeFileSync(filePath, req.file.buffer);
      
      const protocol = req.protocol;
      const host = req.get('host');
      const url = `${protocol}://${host}/uploads/${fileName}`;
      
      console.log(`✅ Image uploaded locally: ${fileName}`);
      res.json({ url: url, publicId: fileName });
    } catch (err) {
      console.error('❌ Local upload failed:', err.message);
      res.status(500).json({ error: 'Image upload failed locally. Please try again.', code: 'UPLOAD_FAILED' });
    }
  }
});

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

  // 🔒 SECURITY: All user-controlled fields are HTML-escaped to prevent XSS via email clients
  const mailOptions = {
    from: `"Uthsav Alerts" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFICATION_EMAIL,
    subject: `✨ New Inquiry: ${escapeHtml(msg.name)} (${escapeHtml(msg.eventType || 'General')})`,
    html: `
      <div style="font-family: sans-serif; max-width:600px; padding:20px; border:1px solid #eee; border-radius:8px;">
        <h2 style="color:#D4AF37; margin-top:0;">🎉 New Inquiry Received!</h2>
        <table style="width:100%; border-collapse:collapse;">
          <tr><td style="padding:8px 0; font-weight:bold; width:80px;">Name:</td><td>${escapeHtml(msg.name)}</td></tr>
          <tr><td style="padding:8px 0; font-weight:bold;">Phone:</td><td>${escapeHtml(msg.phone)}</td></tr>
          <tr><td style="padding:8px 0; font-weight:bold;">Email:</td><td>${escapeHtml(msg.email || 'Not provided')}</td></tr>
          <tr><td style="padding:8px 0; font-weight:bold;">Event:</td><td>${escapeHtml(msg.eventType || 'Not specified')}</td></tr>
          <tr><td style="padding:8px 0; font-weight:bold;">Date:</td><td>${escapeHtml(msg.eventDate ? new Date(msg.eventDate).toLocaleDateString() : 'TBD')}</td></tr>
          <tr><td style="padding:8px 0; font-weight:bold; vertical-align:top;">Message:</td><td>${escapeHtml(msg.message || 'No message provided.')}</td></tr>
        </table>
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


// 🔒 SECURITY FIX: Docs are internal — require auth before serving
app.use('/docs', requireAuth, express.static('docs'));


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
// CATEGORY ROUTES
// ─────────────────────────────────────────────────────────

// GET all categories (public)
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ order: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET category by slug (public)
app.get('/api/categories/:slug', async (req, res, next) => {
  try {
    // Avoid intercepting the seed route
    if (req.params.slug === 'seed') return next();
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create category (admin)
app.post('/api/categories', requireAuth, async (req, res) => {
  try {
    // 🔒 FIX: Whitelist fields — prevent mass assignment attacks
    const { title, slug, image, heroImage, subtitle, description } = req.body;
    if (!title || !slug || !image) {
      return res.status(400).json({ error: 'title, slug, and image are required', code: 'MISSING_FIELDS' });
    }
    const count = await Category.countDocuments();
    const category = new Category({ title, slug, image, heroImage, subtitle, description, order: count });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update category (admin)
app.put('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    // 🔒 FIX: Whitelist update fields
    const { title, slug, image, heroImage, subtitle, description, visible } = req.body;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { title, slug, image, heroImage, subtitle, description, visible },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE category (admin)
app.delete('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST seed default categories (admin)
app.post('/api/categories/seed', requireAuth, async (req, res) => {
  try {
    const existing = await Category.countDocuments();
    if (existing > 0) return res.status(400).json({ error: 'Categories already exist. Delete them first to re-seed.' });

    const defaults = [
      { title: 'Wedding Invitations', slug: 'wedding-invitations', image: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=800&auto=format&fit=crop&q=80', heroImage: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=1600&auto=format&fit=crop&q=80', subtitle: 'Eternal Bonds, Divine Designs', description: 'Bespoke digital invitations that capture the luxury, tradition, and emotion of your special day.', order: 0 },
      { title: 'Housewarming Invitations', slug: 'housewarming-invitations', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&auto=format&fit=crop&q=80', heroImage: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&auto=format&fit=crop&q=80', subtitle: 'New Beginnings, Warm Welcomes', description: 'Celebrate your new home with invitations that reflect comfort, style, and the joy of new beginnings.', order: 1 },
      { title: 'Birthday Invitations', slug: 'birthday-invitations', image: 'https://images.unsplash.com/photo-1464349172961-60fb65f28450?w=800&auto=format&fit=crop&q=80', heroImage: 'https://images.unsplash.com/photo-1464349172961-60fb65f28450?w=1600&auto=format&fit=crop&q=80', subtitle: 'Joyful Celebrations, Lifetime Memories', description: 'From first birthdays to grand anniversaries, our invitations set the perfect mood.', order: 2 },
      { title: 'Baby Shower Invitations', slug: 'baby-shower-invitations', image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop&q=80', heroImage: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1600&auto=format&fit=crop&q=80', subtitle: 'Little Miracles, Big Joy', description: 'Soft, elegant, and heartwarming designs to announce the arrival of your little one.', order: 3 },
      { title: 'Engagement Invitations', slug: 'engagement-invitations', image: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&auto=format&fit=crop&q=80', heroImage: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=1600&auto=format&fit=crop&q=80', subtitle: 'The Promise of Forever', description: 'Announce your commitment with sophisticated invitations that celebrate your unique love story.', order: 4 },
      { title: 'Naming Ceremony', slug: 'naming-ceremony', image: 'https://images.unsplash.com/photo-1544126592-807daf21565b?w=800&auto=format&fit=crop&q=80', heroImage: 'https://images.unsplash.com/photo-1544126592-807daf21565b?w=1600&auto=format&fit=crop&q=80', subtitle: 'Blessings and Names', description: 'Divine and traditional designs for the sacred naming ceremony of your newborn.', order: 5 },
    ];
    const created = await Category.insertMany(defaults);
    res.status(201).json(created);
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
    // 🔒 FIX: Whitelist fields — prevent mass assignment
    const { name, occasion, rating, description, avatarUrl, emoji } = req.body;
    if (!name || !description) {
      return res.status(400).json({ error: 'name and description are required', code: 'MISSING_FIELDS' });
    }
    const count = await Testimonial.countDocuments();
    const testimonial = new Testimonial({ name, occasion, rating, description, avatarUrl, emoji, order: count });
    await testimonial.save();
    res.status(201).json(testimonial);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/testimonials/:id', requireAuth, async (req, res) => {
  try {
    // 🔒 FIX: Whitelist update fields
    const { name, occasion, rating, description, avatarUrl, emoji } = req.body;
    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { name, occasion, rating, description, avatarUrl, emoji },
      { new: true, runValidators: true }
    );
    if (!testimonial) return res.status(404).json({ error: 'Not found' });
    res.json(testimonial);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/testimonials/:id', requireAuth, async (req, res) => {
  try {
    // 🐛 BUG FIX: Check result — don't silently succeed on non-existent IDs
    const result = await Testimonial.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Testimonial not found', code: 'NOT_FOUND' });
    res.json({ message: 'Deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/testimonials/reset', requireAuth, async (req, res) => {
  try {
    await Testimonial.deleteMany({});
    const defaults = [
      { name: 'Priya & Arjun', occasion: 'Wedding Invitation', rating: 5, description: 'Absolutely stunning! Our guests were amazed by the digital invitation. The 3D effects and music made it so special.', emoji: '💍', order: 0 },
      { name: 'Sneha & Rahul', occasion: 'Engagement Ceremony', rating: 5, description: 'The team understood our vision perfectly. The invitation was elegant and received so many compliments.', emoji: '💐', order: 1 },
      { name: 'Lakshmi Family', occasion: 'Housewarming Ceremony', rating: 5, description: 'Beautiful design for our griha pravesham. Traditional yet modern, exactly what we wanted!', emoji: '🏡', order: 2 },
      { name: 'Ananya & Vikram', occasion: 'Baby Shower Invitation', rating: 5, description: 'The cutest baby shower invitation! Loved the animations and the pastel theme. Truly magical.', emoji: '🍼', order: 3 },
    ];
    const created = await Testimonial.insertMany(defaults);
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────
// CONTACT MESSAGES
// ─────────────────────────────────────────────────────────

app.post('/api/messages', contactLimiter, async (req, res) => {
  try {
    // 🔒 FIX: Strict input validation + regex checks before touching the database
    const { name, phone, email, eventType, eventDate, message: msg } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return res.status(400).json({ error: 'Name is required', code: 'MISSING_NAME' });
    }
    if (name.length > 100) {
      return res.status(400).json({ error: 'Name is too long', code: 'INVALID_NAME' });
    }
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone number is required', code: 'MISSING_PHONE' });
    }
    // 🔒 FIX: Regex validation — only digits, spaces, +, -, (), 7–20 chars
    const phoneRegex = /^\+?[\d\s\-().]{7,20}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({ error: 'Invalid phone number format', code: 'INVALID_PHONE' });
    }
    // 🔒 FIX: Email regex validation (not just length)
    if (email && typeof email === 'string' && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(email.trim()) || email.length > 254) {
        return res.status(400).json({ error: 'Invalid email address', code: 'INVALID_EMAIL' });
      }
    }
    // 🔒 FIX: Whitelist fields — don't pass raw req.body to the model
    const message = new ContactMessage({
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : '',
      eventType: typeof eventType === 'string' ? eventType.slice(0, 100) : '',
      eventDate: typeof eventDate === 'string' ? eventDate.slice(0, 20) : '',
      message: typeof msg === 'string' ? msg.slice(0, 2000) : '',
    });
    await message.save();
    // 🔒 BUG FIX: Awaited and isolated — email failure no longer blocks or silently drops
    await sendInquiryAlert(message).catch(err => console.error('Email alert failed (non-critical):', err.message));
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/messages', requireAuth, async (req, res) => {
  try {
    // ⚡ FIX: Paginate + lean() to avoid hydrating full Mongoose docs into memory
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const skip  = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      ContactMessage.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ContactMessage.countDocuments()
    ]);
    // Keep response as a plain array so existing frontend works; add headers for future pagination UI
    res.set('X-Total-Count', total);
    res.set('X-Page', page);
    res.set('X-Pages', Math.ceil(total / limit));
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/messages/:id', requireAuth, async (req, res) => {
  try {
    // 🐛 BUG FIX: Validate the document was actually found and deleted
    const result = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Message not found', code: 'NOT_FOUND' });
    res.json({ message: 'Deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/messages/:id/read', requireAuth, async (req, res) => {
  try {
    const msg = await ContactMessage.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!msg) return res.status(404).json({ error: 'Not found' });
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/messages', requireAuth, async (req, res) => {
  try {
    await ContactMessage.deleteMany({});
    res.json({ message: 'All messages deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────
// SHOWCASE ROUTES
// ─────────────────────────────────────────────────────────

app.get('/api/showcases', requireAuth, async (req, res) => {
  try {
    const showcases = await Showcase.find().sort({ order: 1 });
    res.json(showcases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/showcases/:category', async (req, res) => {
  try {
    const sc = await Showcase.find({ category: req.params.category }).sort({ order: 1 });
    res.json(sc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/showcases', requireAuth, async (req, res) => {
  try {
    // 🔒 FIX: Whitelist fields — prevent mass assignment
    const { name, description, image, link, category } = req.body;
    if (!name || !description || !category) {
      return res.status(400).json({ error: 'name, description, and category are required', code: 'MISSING_FIELDS' });
    }
    // 🔒 FIX: Reject Base64 blobs — use /api/uploads/image to get a Cloudinary URL first
    if (image && image.startsWith('data:')) {
      return res.status(400).json({
        error: 'Base64 images are not accepted. Upload via POST /api/uploads/image first to get a URL.',
        code: 'BASE64_NOT_ALLOWED'
      });
    }
    const count = await Showcase.countDocuments({ category });
    const showcase = new Showcase({ name, description, image, link, category, order: count });
    await showcase.save();
    res.status(201).json(showcase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/showcases/:id', requireAuth, async (req, res) => {
  try {
    // 🔒 FIX: Whitelist update fields
    const { name, description, image, link, category } = req.body;
    if (image && image.startsWith('data:')) {
      return res.status(400).json({
        error: 'Base64 images are not accepted. Upload via POST /api/uploads/image first.',
        code: 'BASE64_NOT_ALLOWED'
      });
    }
    const showcase = await Showcase.findByIdAndUpdate(
      req.params.id,
      { name, description, image, link, category },
      { new: true, runValidators: true }
    );
    if (!showcase) return res.status(404).json({ error: 'Not found' });
    res.json(showcase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/showcases/:id', requireAuth, async (req, res) => {
  try {
    // 🐛 BUG FIX: Validate the document was actually found and deleted
    const result = await Showcase.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Showcase not found', code: 'NOT_FOUND' });
    res.json({ message: 'Deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────
// CHANGE PASSWORD ROUTE (was in frontend lib/data.js but missing from backend)
// ─────────────────────────────────────────────────────────
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required', code: 'MISSING_FIELDS' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters', code: 'WEAK_PASSWORD' });
    }
    const admin = await AdminUser.findById(req.admin.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    const valid = await admin.comparePassword(currentPassword);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect', code: 'WRONG_PASSWORD' });

    admin.password = newPassword; // pre-save hook in AdminUser.js will hash it
    await admin.save();
    console.log(`✅ Password changed for: ${admin.email}`);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('❌ Change password error:', err.message);
    res.status(500).json({ error: 'Server error', code: 'SERVER_ERROR' });
  }
});

// ─────────────────────────────────────────────────────────
// 404 CATCH-ALL & GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────

// Catch all unmatched routes — prevents raw Express errors leaking
// 🔒 FIX: Do NOT echo back req.method/req.path — leaks internal routing structure
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// Global error handler — catches any unhandled throw from route handlers
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  // Don't expose internal error details to clients
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'SERVER_ERROR'
  });
});

// ─────────────────────────────────────────────────────────
// SERVER START
// ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
});