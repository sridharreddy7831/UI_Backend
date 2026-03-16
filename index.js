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

// ─── CORS Configuration ────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, Postman, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// ─── Email Configuration ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // true for 465, false for 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendInquiryAlert = async (msg) => {
    // Only send if configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.NOTIFICATION_EMAIL) {
        console.log('ℹ️ Email notifications skipped (config missing)');
        return;
    }

    const mailOptions = {
        from: `"Uthsav Alerts" <${process.env.SMTP_USER}>`,
        to: process.env.NOTIFICATION_EMAIL,
        subject: `✨ New Inquiry: ${msg.name} (${msg.eventType || 'General'})`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #D4AF37; margin-bottom: 20px;">🎉 New Inquiry Received!</h2>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px;">
                    <p><strong>Name:</strong> ${msg.name}</p>
                    <p><strong>Phone:</strong> ${msg.phone}</p>
                    <p><strong>Event:</strong> ${msg.eventType || 'Not specified'}</p>
                    <p><strong>Date:</strong> ${msg.eventDate ? new Date(msg.eventDate).toLocaleDateString() : 'TBD'}</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 15px 0;">
                    <p><strong>Message:</strong></p>
                    <p style="white-space: pre-wrap; font-style: italic;">${msg.message || 'No message provided.'}</p>
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #888;">
                    🚀 View this inquiry in your <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin" style="color: #D4AF37;">Admin Dashboard</a>.
                </p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Email alert sent to ${process.env.NOTIFICATION_EMAIL}`);
    } catch (err) {
        console.error('❌ Failed to send email alert:', err.message);
    }
};

// ─── JWT Auth Middleware ─────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized — no token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
    }
};

// ─── MongoDB Connection ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected — uthsav_invites'))
    .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// ─── Default Testimonials seed ───────────────────────────────────────────────
const DEFAULT_TESTIMONIALS = [
    { name: 'Priya & Arjun', occasion: 'Wedding Invitation', rating: 5, description: 'Uthsav captured the essence of our wedding perfectly. The digital invitation had guests in awe before they even arrived. Absolutely magical!', avatarUrl: 'https://images.unsplash.com/photo-1604881991720-f91add269bed?w=400&auto=format&fit=crop&q=80', emoji: '💍', order: 0 },
    { name: 'Meena Krishnan', occasion: 'Baby Shower Invitation', rating: 5, description: 'The baby shower invitation was stunning — soft, warm, and so interactive! Everyone was sharing it on WhatsApp. Highly recommend!', avatarUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&auto=format&fit=crop&q=80', emoji: '🍼', order: 1 },
    { name: 'Ravi & Sunita', occasion: 'Housewarming Ceremony', rating: 5, description: 'Our housewarming invite had a beautiful 3D walkthrough of our new home. Guests loved it and it set the perfect mood for the celebration.', avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80', emoji: '🏡', order: 2 },
    { name: 'Ananya Sharma', occasion: 'Birthday Celebration', rating: 4.5, description: "My daughter's 1st birthday invitation was a dream! The animations, music, and photos all blended seamlessly. Worth every penny.", avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', emoji: '🎂', order: 3 },
];

mongoose.connection.once('open', async () => {
    // Seed default testimonials if empty
    const count = await Testimonial.countDocuments();
    if (count === 0) {
        await Testimonial.insertMany(DEFAULT_TESTIMONIALS);
        console.log('🌱 Seeded default testimonials');
    }

    // Seed default admin users if none exist
    const adminCount = await AdminUser.countDocuments();
    if (adminCount <= 1) { // checking if only default exists or none
        const users = [
            { name: 'Uthsav Admin', email: 'admin@uthsav.com', password: 'uthsav2024' },
            { name: 'Sridhar', email: 'sridhar@uthsav.com', password: 'Majeeda@2121' },
            { name: 'Nikkitha', email: 'nikkitha@uthsav.com', password: 'Majeeda@2121' }
        ];

        for (const u of users) {
           const exists = await AdminUser.findOne({ email: u.email });
           if (!exists) {
               await AdminUser.create(u);
               console.log(`🔐 Admin account created: ${u.name} (${u.email})`);
           }
        }
    }

    // Seed initial showcases if none exist
    const scCount = await Showcase.countDocuments();
    if (scCount === 0) {
        const initial = [
            { category: 'wedding-invitations', name: "Anjali & Vikram", description: "A royal Rajasthani wedding theme with intricate mandap designs and 3D walkthroughs.", image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=600&auto=format&fit=crop&q=80" },
            { category: 'wedding-invitations', name: "The Grand Telugu Wedding", description: "Cinematic traditional Telugu wedding with floral transitions and live music.", image: "https://images.unsplash.com/photo-1595801202811-799d632007dc?w=600&auto=format&fit=crop&q=80" },
            { category: 'housewarming-invitations', name: "The Villa Launch", description: "Sleek and modern housewarming invite with interactive 3D floor plans.", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80" },
            { category: 'housewarming-invitations', name: "Griha Pravesh @ Skyline", description: "Elegant and traditional invitation for a high-rise apartment ceremony.", image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&auto=format&fit=crop&q=80" },
            { category: 'birthday-invitations', name: "Zoe's 1st Birthday", description: "Wild one theme with balloon pops and interactive animal animations.", image: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80" },
            { category: 'birthday-invitations', name: "The Sweet 16 Bash", description: "Trendy glam design with neon effects and Spotify integration.", image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80" },
            { category: 'baby-shower-invitations', name: "Welcome Baby Boy", description: "Cloud theme with soft blue gradients and interactive nursery mobile.", image: "https://images.unsplash.com/photo-1515488126937-2309f7831d4d?w=600&auto=format&fit=crop&q=80" },
            { category: 'baby-shower-invitations', name: "Princess Baby Shower", description: "Elegant and whimsical invitation with castle and tiara animations.", image: "https://images.unsplash.com/photo-1492238407425-63852077e6f8?w=600&auto=format&fit=crop&q=80" },
            { category: 'engagement-invitations', name: "Eternal Promise", description: "Minimalist engagement invite with sunset theme and timeline feature.", image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&auto=format&fit=crop&q=80" },
            { category: 'engagement-invitations', name: "Engagement of Rohan", description: "Grand and luxurious invitation with animated ring box reveal.", image: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=600&auto=format&fit=crop&q=80" }
        ];
        await Showcase.insertMany(initial);
        console.log('🚀 Seeded initial showcases');
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK ROUTE
// ═══════════════════════════════════════════════════════════════════════════

app.get("/", (req, res) => {
  res.send("Backend is running successfully");
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTH ROUTES (public)
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email and password are required' });

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

        res.json({ token, admin: { id: admin._id, email: admin.email, name: admin.name } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/me — verify token and return current admin info
app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const admin = await AdminUser.findById(req.admin.id).select('-password');
        if (!admin) return res.status(404).json({ error: 'Admin not found' });
        res.json({ admin });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/change-password — change admin password
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
        return res.status(400).json({ error: 'Both current and new password are required' });
    if (newPassword.length < 6)
        return res.status(400).json({ error: 'New password must be at least 6 characters' });

    try {
        const admin = await AdminUser.findById(req.admin.id);
        const valid = await admin.comparePassword(currentPassword);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

        admin.password = newPassword;
        await admin.save();
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// TESTIMONIALS ROUTES (protected — admin only for write ops)
// ═══════════════════════════════════════════════════════════════════════════

// GET all testimonials (public — used by frontend)
app.get('/api/testimonials', async (req, res) => {
    try {
        const testimonials = await Testimonial.find().sort({ order: 1, createdAt: 1 });
        res.json(testimonials);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create testimonial (protected)
app.post('/api/testimonials', requireAuth, async (req, res) => {
    try {
        const count = await Testimonial.countDocuments();
        const testimonial = new Testimonial({ ...req.body, order: count });
        await testimonial.save();
        res.status(201).json(testimonial);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update testimonial (protected)
app.put('/api/testimonials/:id', requireAuth, async (req, res) => {
    try {
        const testimonial = await Testimonial.findByIdAndUpdate(
            req.params.id, req.body, { new: true, runValidators: true }
        );
        if (!testimonial) return res.status(404).json({ error: 'Not found' });
        res.json(testimonial);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE testimonial (protected)
app.delete('/api/testimonials/:id', requireAuth, async (req, res) => {
    try {
        const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
        if (!testimonial) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST reset testimonials (protected)
app.post('/api/testimonials/reset', requireAuth, async (req, res) => {
    try {
        await Testimonial.deleteMany({});
        const inserted = await Testimonial.insertMany(DEFAULT_TESTIMONIALS);
        res.json(inserted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT MESSAGES ROUTES (protected for read/delete, public for submit)
// ═══════════════════════════════════════════════════════════════════════════

// GET all messages (protected)
app.get('/api/messages', requireAuth, async (req, res) => {
    try {
        const messages = await ContactMessage.find().sort({ createdAt: -1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create message (public — from contact form)
app.post('/api/messages', async (req, res) => {
    try {
        const message = new ContactMessage(req.body);
        await message.save();
        
        // 🔥 Trigger email alert asynchronously
        sendInquiryAlert(message);
        
        res.status(201).json(message);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH mark as read (protected)
app.patch('/api/messages/:id/read', requireAuth, async (req, res) => {
    try {
        const message = await ContactMessage.findByIdAndUpdate(
            req.params.id, { read: true }, { new: true }
        );
        if (!message) return res.status(404).json({ error: 'Not found' });
        res.json(message);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE message (protected)
app.delete('/api/messages/:id', requireAuth, async (req, res) => {
    try {
        const message = await ContactMessage.findByIdAndDelete(req.params.id);
        if (!message) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE all messages (protected)
app.delete('/api/messages', requireAuth, async (req, res) => {
    try {
        await ContactMessage.deleteMany({});
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// SHOWCASE ROUTES (protected — dynamic collection portfolio)
// ═══════════════════════════════════════════════════════════════════════════

// GET showcases for a specific category (public)
app.get('/api/showcases/:category', async (req, res) => {
    try {
        const sc = await Showcase.find({ category: req.params.category }).sort({ order: 1, createdAt: -1 });
        res.json(sc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all showcases (protected — for admin)
app.get('/api/showcases', requireAuth, async (req, res) => {
    try {
        const sc = await Showcase.find().sort({ category: 1, order: 1 });
        res.json(sc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create showcase (protected)
app.post('/api/showcases', requireAuth, async (req, res) => {
    try {
        const count = await Showcase.countDocuments({ category: req.body.category });
        const sc = new Showcase({ ...req.body, order: count });
        await sc.save();
        res.status(201).json(sc);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT update showcase (protected)
app.put('/api/showcases/:id', requireAuth, async (req, res) => {
    try {
        const sc = await Showcase.findByIdAndUpdate(
            req.params.id, req.body, { new: true, runValidators: true }
        );
        if (!sc) return res.status(404).json({ error: 'Not found' });
        res.json(sc);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE showcase (protected)
app.delete('/api/showcases/:id', requireAuth, async (req, res) => {
    try {
        const sc = await Showcase.findByIdAndDelete(req.params.id);
        if (!sc) return res.status(404).json({ error: 'Not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Health check ─────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.listen(PORT, () => {
    console.log(`🚀 API server running at http://localhost:${PORT}`);
});
