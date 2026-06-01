const mongoose = require('mongoose');

const RSVPSchema = new mongoose.Schema({
    invitationId: {
        type: String,
        required: true,
        trim: true
    },
    guestName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true,
        default: ''
    },
    email: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        required: true,
        enum: ['accepted', 'declined', 'maybe'],
        trim: true
    },
    attendingCount: {
        type: Number,
        default: 0
    },
    message: {
        type: String,
        trim: true,
        default: ''
    }
}, { timestamps: true });

// Explicitly add indexes: invitationId, phone, createdAt, updatedAt
RSVPSchema.index({ invitationId: 1 });
RSVPSchema.index({ phone: 1 });
RSVPSchema.index({ createdAt: 1 });
RSVPSchema.index({ updatedAt: 1 });

module.exports = mongoose.model('RSVP', RSVPSchema);
