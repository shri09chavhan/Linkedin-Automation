const fs = require("fs");
const path = require("path");
const aiService = require("./aiService");

const SENDER_EMAIL = process.env.EMAIL_USER || "shree09chauhan@gmail.com";
const SENDER_NAME = process.env.SENDER_NAME || "Shreehari Chauhan";
const EMAIL_FROM = process.env.EMAIL_FROM || "LinkedIn Automation <onboarding@resend.dev>";
const CC_RECIPIENTS = (process.env.EMAIL_CC || "").split(",").map((email) => email.trim()).filter(Boolean);

const isEmailConfigured = () => Boolean(process.env.RESEND_API_KEY && EMAIL_FROM);

const sendRawEmail = async ({ to, cc = [], subject, text, attachments = [], replyTo }) => {
    if (!isEmailConfigured()) {
        throw new Error("Resend is not configured. Add RESEND_API_KEY and EMAIL_FROM to .env.");
    }

    let response;

    try {
        response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: EMAIL_FROM,
                to: Array.isArray(to) ? to : [to],
                cc: cc.length ? cc : undefined,
                reply_to: replyTo || SENDER_EMAIL,
                subject,
                text,
                attachments: attachments.length ? attachments : undefined
            })
        });
    } catch {
        throw new Error("Could not reach Resend. Check internet connection, firewall, VPN, or try again.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = data.message || data.error || JSON.stringify(data);
        throw new Error(`Resend send failed: ${response.status} ${message}`);
    }

    return data;
};

const buildEmailBody = async ({ recruiterName, category, postText, experience, location, replyTo }) => {
    const firstName = recruiterName && recruiterName !== "Unknown recruiter"
        ? recruiterName.split(/\s+/)[0]
        : "Recruiter";

    return aiService.draftEmail({
        recruiterName: firstName,
        category,
        postText,
        senderName: SENDER_NAME,
        senderEmail: replyTo || SENDER_EMAIL,
        experience,
        location
    });
};

const sendVerificationCode = async ({ to, code }) => {
    if (!to) {
        throw new Error("Email is required.");
    }

    return sendRawEmail({
        to,
        subject: "LinkedIn Automation verification code",
        text: `Your LinkedIn Automation verification code is ${code}.\n\nThis code expires in 10 minutes.`,
        replyTo: SENDER_EMAIL
    });
};

const sendEmail = async ({ to, recruiterName, category, postText, resumePath, experience, location, replyTo }) => {
    if (!to) {
        throw new Error("Recipient email is required.");
    }

    if (!resumePath || !fs.existsSync(resumePath)) {
        throw new Error(`Resume file not found: ${resumePath}`);
    }

    const body = await buildEmailBody({ recruiterName, category, postText, experience, location, replyTo });
    const attachmentContent = fs.readFileSync(resumePath).toString("base64");

    console.log(`[emailService] Sending Resend email to ${to}.`);
    const result = await sendRawEmail({
        to,
        cc: CC_RECIPIENTS,
        subject: `Application for ${category} Opportunity`,
        text: body,
        replyTo: replyTo || SENDER_EMAIL,
        attachments: [
            {
                filename: path.basename(resumePath),
                content: attachmentContent
            }
        ]
    });
    console.log(`[emailService] Email sent to ${to}. Message ID: ${result.id}`);

    return {
        messageId: result.id
    };
};

module.exports = {
    sendEmail,
    sendVerificationCode,
    buildEmailBody,
    isEmailConfigured,
    SENDER_EMAIL,
    SENDER_NAME,
    EMAIL_FROM,
    CC_RECIPIENTS
};
