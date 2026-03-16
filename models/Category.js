const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    image: {
        type: String, // Unsplash URL or Base64
        required: true
    },
    heroImage: {
        type: String, // Larger hero image for collection page
        default: ''
    },
    subtitle: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    order: {
        type: Number,
        default: 0
    },
    visible: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
