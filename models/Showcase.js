const mongoose = require('mongoose');

const ShowcaseSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String, // Base64 or URL
        required: true
    },
    link: {
        type: String,
        default: '#'
    },
    order: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Showcase', ShowcaseSchema);
