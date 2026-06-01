const express = require('express');
const router = express.Router();
const rsvpController = require('../controllers/rsvp.controller');
const { validateCreateInvitation, validateSubmitRSVP } = require('../validations/rsvp.validation');

// Create Invitation
router.post('/invitations', validateCreateInvitation, rsvpController.createInvitation);

// Get Invitation by Slug
router.get('/invitations/slug/:slug', rsvpController.getInvitationBySlug);

// Get Invitation by ID or invitationId
router.get('/invitations/:id', rsvpController.getInvitationById);

// Submit RSVP Response
router.post('/respond', validateSubmitRSVP, rsvpController.submitRSVP);

// Get RSVP Responses for an invitation
router.get('/responses/:invitationId', rsvpController.getResponses);

// Get RSVP Summary for an invitation
router.get('/summary/:invitationId', rsvpController.getRSVPSummary);

module.exports = router;
