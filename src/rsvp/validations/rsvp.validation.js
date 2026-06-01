const validateCreateInvitation = (req, res, next) => {
    const { title, slug, eventType, eventDate } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Title is required'
        });
    }

    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Slug is required'
        });
    }

    // Slug format: lowercase letters, numbers, hyphens
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug.trim())) {
        return res.status(400).json({
            success: false,
            message: 'Invalid slug format. It should be lowercase letters, numbers, and hyphens only (e.g. sri-weds-lakshmi)'
        });
    }

    if (!eventType || typeof eventType !== 'string' || eventType.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Event type is required'
        });
    }

    if (!eventDate) {
        return res.status(400).json({
            success: false,
            message: 'Event date is required'
        });
    }

    const parsedDate = new Date(eventDate);
    if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
            success: false,
            message: 'Invalid event date format. Use a valid date (e.g. YYYY-MM-DD)'
        });
    }

    // Pass cleaned values
    req.body.title = title.trim();
    req.body.slug = slug.trim().toLowerCase();
    req.body.eventType = eventType.trim();
    req.body.eventDate = parsedDate;

    next();
};

const validateSubmitRSVP = (req, res, next) => {
    const { invitationId, guestName, phone, email, status, attendingCount, message } = req.body;

    if (!invitationId || typeof invitationId !== 'string' || invitationId.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Invitation ID is required'
        });
    }

    if (!guestName || typeof guestName !== 'string' || guestName.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Guest name is required'
        });
    }

    if (!status || typeof status !== 'string' || status.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Status is required'
        });
    }

    const allowedStatuses = ['accepted', 'declined', 'maybe'];
    const cleanedStatus = status.trim().toLowerCase();
    if (!allowedStatuses.includes(cleanedStatus)) {
        return res.status(400).json({
            success: false,
            message: 'Status must be one of: accepted, declined, maybe'
        });
    }

    // Validate email if provided
    if (email && typeof email === 'string' && email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }
    }

    // Validate attendingCount
    let cleanedAttendingCount = 0;
    if (cleanedStatus !== 'declined') {
        if (attendingCount !== undefined && attendingCount !== null) {
            const parsedCount = parseInt(attendingCount, 10);
            if (isNaN(parsedCount) || parsedCount < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Attending count must be a non-negative number'
                });
            }
            cleanedAttendingCount = parsedCount;
        } else {
            cleanedAttendingCount = 1; // Default to 1 if attending
        }
    } else {
        cleanedAttendingCount = 0; // Forced to 0 if declined
    }

    // Clean inputs
    req.body.invitationId = invitationId.trim();
    req.body.guestName = guestName.trim();
    req.body.status = cleanedStatus;
    req.body.phone = phone ? phone.trim() : '';
    req.body.email = email ? email.trim() : '';
    req.body.attendingCount = cleanedAttendingCount;
    req.body.message = message ? message.trim() : '';

    next();
};

module.exports = {
    validateCreateInvitation,
    validateSubmitRSVP
};
