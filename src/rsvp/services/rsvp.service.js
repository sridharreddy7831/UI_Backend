const mongoose = require('mongoose');
const Invitation = require('../models/Invitation');
const RSVP = require('../models/RSVP');

/**
 * Generate the next auto-incrementing invitationId (e.g. INV1001)
 */
async function generateNextInvitationId() {
    const lastInvitation = await Invitation.findOne({}, {}, { sort: { invitationId: -1 } });
    let nextNumber = 1001;
    if (lastInvitation && lastInvitation.invitationId) {
        const match = lastInvitation.invitationId.match(/^INV(\d+)$/);
        if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
        }
    }
    return `INV${nextNumber}`;
}

/**
 * Create a new invitation with retries for robust unique invitationId generation
 */
async function createInvitation(data) {
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
        try {
            const nextId = await generateNextInvitationId();
            const invitation = new Invitation({
                ...data,
                invitationId: nextId
            });
            return await invitation.save();
        } catch (error) {
            attempts++;
            // MongoDB duplicate key error code is 11000
            if (error.code === 11000 && error.message.includes('invitationId') && attempts < maxAttempts) {
                console.warn(`Retry attempt ${attempts} for invitationId creation due to duplicate key collision.`);
                continue;
            }
            throw error;
        }
    }
}

/**
 * Retrieve invitation details by slug
 */
async function getInvitationBySlug(slug) {
    return await Invitation.findOne({ slug, isActive: true });
}

/**
 * Retrieve invitation details by invitationId or ObjectId
 */
async function getInvitationById(id) {
    let query = { invitationId: id };
    if (mongoose.Types.ObjectId.isValid(id)) {
        query = {
            $or: [
                { invitationId: id },
                { _id: id }
            ]
        };
    }
    return await Invitation.findOne(query);
}

/**
 * Submit guest RSVP response
 */
async function submitRSVP(data) {
    const { invitationId } = data;
    const invitation = await Invitation.findOne({ invitationId, isActive: true });
    if (!invitation) {
        throw new Error(`Active invitation with ID '${invitationId}' not found`);
    }

    const rsvp = new RSVP(data);
    return await rsvp.save();
}

/**
 * Retrieve all RSVP responses for an invitation
 */
async function getResponses(invitationId) {
    // Check if invitation exists first
    const invitation = await Invitation.findOne({ invitationId });
    if (!invitation) {
        throw new Error(`Invitation with ID '${invitationId}' not found`);
    }

    return await RSVP.find({ invitationId }).sort({ createdAt: -1 });
}

/**
 * Calculate RSVP response statistics using aggregation
 */
async function getRSVPSummary(invitationId) {
    const invitation = await Invitation.findOne({ invitationId });
    if (!invitation) {
        throw new Error(`Invitation with ID '${invitationId}' not found`);
    }

    const results = await RSVP.aggregate([
        { $match: { invitationId } },
        {
            $group: {
                _id: null,
                accepted: {
                    $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
                },
                declined: {
                    $sum: { $cond: [{ $eq: ['$status', 'declined'] }, 1, 0] }
                },
                maybe: {
                    $sum: { $cond: [{ $eq: ['$status', 'maybe'] }, 1, 0] }
                },
                totalResponses: { $sum: 1 },
                totalAttending: { $sum: '$attendingCount' }
            }
        }
    ]);

    if (results.length === 0) {
        return {
            accepted: 0,
            declined: 0,
            maybe: 0,
            totalResponses: 0,
            totalAttending: 0
        };
    }

    const { _id, ...summary } = results[0];
    return summary;
}

module.exports = {
    createInvitation,
    getInvitationBySlug,
    getInvitationById,
    submitRSVP,
    getResponses,
    getRSVPSummary
};
