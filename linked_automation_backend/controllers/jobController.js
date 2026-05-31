const automationService = require("../services/automationService");
const emailVerificationService = require("../services/emailVerificationService");

const startAutomation = async (req, res) => {
    try {
        const { linkedinEmail, linkedinPassword, verifiedEmail } = req.body;

        if (!linkedinEmail || !linkedinPassword) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: linkedinEmail and linkedinPassword"
            });
        }

        if (!emailVerificationService.isVerified(verifiedEmail)) {
            return res.status(403).json({
                success: false,
                message: "Verify your email in Settings before running automation."
            });
        }

        const result = await automationService.runAutomation({
            linkedinEmail,
            linkedinPassword,
            settings: {
                jobRole: req.body.jobRole,
                experience: req.body.experience,
                location: req.body.location,
                last24Hours: req.body.last24Hours !== false,
                remoteJobs: req.body.remoteJobs === true,
                contractRoles: req.body.contractRoles === true,
                immediateHiring: req.body.immediateHiring === true,
                maxPostsPerQuery: req.body.maxPostsPerQuery,
                verifiedEmail
            }
        });

        res.status(result.success ? 200 : 500).json(result);

    } catch (error) {
        console.error("[jobController] Unhandled error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = { startAutomation };
