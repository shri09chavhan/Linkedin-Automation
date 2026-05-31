const path = require("path");

const DEFAULT_RESUME_PATH = path.join(__dirname, "..", "resumes", "demo_resume.pdf");

const customizeResume = (postText, category) => {
    console.log(`[resumeService] customizeResume placeholder called for category: ${category}`);
    console.log(`[resumeService] Post text length: ${postText ? postText.length : 0}`);

    return DEFAULT_RESUME_PATH;
};

module.exports = {
    customizeResume,
    DEFAULT_RESUME_PATH
};
