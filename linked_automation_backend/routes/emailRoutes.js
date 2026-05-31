const express = require("express");
const emailVerificationService = require("../services/emailVerificationService");

const router = express.Router();

router.post("/send-code", async (req, res) => {
    try {
        const result = await emailVerificationService.requestCode(req.body.email);
        res.json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/verify-code", (req, res) => {
    try {
        const result = emailVerificationService.verifyCode(req.body.email, req.body.code);
        res.json(result);
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
