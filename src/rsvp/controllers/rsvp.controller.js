const rsvpService = require('../services/rsvp.service');

const createInvitation = async (req, res) => {
    try {
        const invitation = await rsvpService.createInvitation(req.body);
        return res.status(201).json({
            success: true,
            message: 'Invitation created successfully',
            data: invitation
        });
    } catch (error) {
        return res.status(error.code === 11000 ? 409 : 500).json({
            success: false,
            message: error.message || 'Failed to create invitation'
        });
    }
};

const getInvitationBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const invitation = await rsvpService.getInvitationBySlug(slug);
        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: `Invitation with slug '${slug}' not found`
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Invitation retrieved successfully',
            data: invitation
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve invitation'
        });
    }
};

const getInvitationById = async (req, res) => {
    try {
        const { id } = req.params;
        const invitation = await rsvpService.getInvitationById(id);
        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: `Invitation with ID '${id}' not found`
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Invitation retrieved successfully',
            data: invitation
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to retrieve invitation'
        });
    }
};

const submitRSVP = async (req, res) => {
    try {
        const rsvp = await rsvpService.submitRSVP(req.body);
        return res.status(201).json({
            success: true,
            message: 'RSVP response submitted successfully',
            data: rsvp
        });
    } catch (error) {
        const status = error.message.includes('not found') ? 400 : 500;
        return res.status(status).json({
            success: false,
            message: error.message || 'Failed to submit RSVP response'
        });
    }
};

const getResponses = async (req, res) => {
    try {
        const { invitationId } = req.params;
        const responses = await rsvpService.getResponses(invitationId);
        return res.status(200).json({
            success: true,
            message: 'RSVP responses retrieved successfully',
            data: responses
        });
    } catch (error) {
        const status = error.message.includes('not found') ? 404 : 500;
        return res.status(status).json({
            success: false,
            message: error.message || 'Failed to retrieve RSVP responses'
        });
    }
};

const getRSVPSummary = async (req, res) => {
    try {
        const { invitationId } = req.params;
        const summary = await rsvpService.getRSVPSummary(invitationId);
        return res.status(200).json({
            success: true,
            message: 'RSVP summary retrieved successfully',
            data: summary
        });
    } catch (error) {
        const status = error.message.includes('not found') ? 404 : 500;
        return res.status(status).json({
            success: false,
            message: error.message || 'Failed to retrieve RSVP summary'
        });
    }
};

module.exports = {
    createInvitation,
    getInvitationBySlug,
    getInvitationById,
    submitRSVP,
    getResponses,
    getRSVPSummary
};
