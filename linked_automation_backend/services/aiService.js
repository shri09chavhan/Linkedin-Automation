const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);

const extractJson = (text) => {
    const clean = text.replace(/```json|```/g, "").trim();
    const first = clean.indexOf("{");
    const last = clean.lastIndexOf("}");

    if (first === -1 || last === -1) {
        throw new Error("Gemini returned non JSON text.");
    }

    return JSON.parse(clean.slice(first, last + 1));
};

const askGemini = async (prompt) => {
    if (!hasGemini()) {
        throw new Error("GEMINI_API_KEY is not set.");
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json"
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error("Gemini returned an empty response.");
    }

    return extractJson(text);
};

const buildSearchQueries = async (settings) => {
    const role = settings.jobRole || "Java Developer";
    const location = settings.location || "Remote";
    const intentParts = ["recruiter posts with email addresses"];

    if (settings.contractRoles) {
        intentParts.push("C2C or contract hiring");
    }

    if (settings.immediateHiring) {
        intentParts.push("immediate hiring or urgent requirement");
    }

    const intent = intentParts.join(", ");
    const fallbackTerms = [
        `${role} ${location} recruiter email`,
        `${role} hiring recruiter email`
    ];

    if (settings.contractRoles) {
        fallbackTerms.push(`${role} C2C hiring`);
    }

    if (settings.immediateHiring) {
        fallbackTerms.push(`${role} immediate requirement`);
    }

    const fallback = fallbackTerms.slice(0, 4).map((query) => ({
        category: role,
        query
    }));

    if (!hasGemini()) {
        return fallback;
    }

    try {
        const result = await askGemini(`Return JSON only. Build 4 LinkedIn content search queries for finding recent recruiter posts with email addresses.
Profile:
Role: ${role}
Experience: ${settings.experience || "Not specified"}
Location: ${location}
Target: ${intent}
Return this shape: {"queries":[{"category":"short category","query":"linkedin search phrase"}]}`);

        if (!Array.isArray(result.queries) || result.queries.length === 0) {
            return fallback;
        }

        return result.queries
            .filter((item) => item.category && item.query)
            .slice(0, 6);
    } catch (error) {
        console.warn(`[aiService] Search query generation failed: ${error.message}`);
        return fallback;
    }
};

const draftEmail = async ({ recruiterName, category, postText, senderName, senderEmail, experience, location }) => {
    const firstName = recruiterName && recruiterName !== "Unknown recruiter"
        ? recruiterName.split(/\s+/)[0]
        : "Recruiter";

    const fallback = `Dear ${firstName},

I hope you are doing well. I came across your recent LinkedIn post regarding a ${category} opportunity and wanted to express my interest.

I am a ${category} professional with ${experience || "relevant"} experience and a strong interest in roles aligned with ${location || "your requirement"}. Based on the opportunity you shared, I believe my background could be a good fit.

Please find my resume attached for your consideration. I would be happy to discuss the role and share any additional details you need.

Thank you for your time. I look forward to hearing from you.

Best regards,
${senderName}
${senderEmail}`;

    if (!hasGemini()) {
        return fallback;
    }

    try {
        const result = await askGemini(`Return JSON only. Write a concise professional job application email body.
Rules:
- No invented certifications, employers, visa status, compensation, or availability.
- Keep it under 170 words.
- Use plain text only.
Inputs:
Recruiter name: ${recruiterName || "Unknown recruiter"}
Role/category: ${category}
Experience: ${experience || "Not specified"}
Location preference: ${location || "Not specified"}
Sender name: ${senderName}
Sender email: ${senderEmail}
LinkedIn post text: ${postText || ""}
Return this shape: {"body":"email body"}`);

        return result.body || fallback;
    } catch (error) {
        console.warn(`[aiService] Email draft failed: ${error.message}`);
        return fallback;
    }
};

module.exports = {
    buildSearchQueries,
    draftEmail,
    hasGemini
};
