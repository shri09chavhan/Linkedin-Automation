const crypto = require("crypto");
const emailService = require("./emailService");

const codes = new Map();
const verifiedEmails = new Set();

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const createCode = () => String(crypto.randomInt(100000, 999999));

const requestCode = async (email) => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
        throw new Error("Enter a valid email address.");
    }

    const code = createCode();

    await emailService.sendVerificationCode({
        to: normalizedEmail,
        code
    });

    codes.set(normalizedEmail, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000
    });

    return {
        success: true,
        message: "Verification code sent."
    };
};

const verifyCode = (email, code) => {
    const normalizedEmail = normalizeEmail(email);
    const record = codes.get(normalizedEmail);

    if (!record) {
        throw new Error("Request a verification code first.");
    }

    if (Date.now() > record.expiresAt) {
        codes.delete(normalizedEmail);
        throw new Error("Verification code expired.");
    }

    if (String(code).trim() !== record.code) {
        throw new Error("Verification code is incorrect.");
    }

    codes.delete(normalizedEmail);
    verifiedEmails.add(normalizedEmail);

    return {
        success: true,
        message: "Email verified."
    };
};

const isVerified = (email) => verifiedEmails.has(normalizeEmail(email));

module.exports = {
    requestCode,
    verifyCode,
    isVerified
};
