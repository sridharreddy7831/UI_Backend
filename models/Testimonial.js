const mongoose = require('mongoose');

const TestimonialSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    occasion: { type: String, trim: true, default: '' },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    description: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: '' },
    emoji: { type: String, default: '💍' },
    order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Testimonial', TestimonialSchema);
