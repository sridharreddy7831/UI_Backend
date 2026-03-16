const mongoose = require('mongoose');

const ContactMessageSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    eventType: { type: String, trim: true, default: '' },
    eventDate: { type: String, default: '' },
    message: { type: String, trim: true, default: '' },
    read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('ContactMessage', ContactMessageSchema);
