const mongoose = require('mongoose');

const InvitationSchema = new mongoose.Schema({
    invitationId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    eventType: {
        type: String,
        required: true,
        trim: true
    },
    eventDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Explicitly add indexes for createdAt and updatedAt
InvitationSchema.index({ createdAt: 1 });
InvitationSchema.index({ updatedAt: 1 });

module.exports = mongoose.model('Invitation', InvitationSchema);
