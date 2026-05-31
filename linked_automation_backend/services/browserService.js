const { chromium } = require("playwright");
const path = require("path");

const launchBrowser = async () => {
    const userDataDir = path.join(__dirname, "..", ".browser-profile");
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: process.env.HEADLESS === "true",
        slowMo: Number(process.env.SLOW_MO) || 100,
        viewport: { width: 1366, height: 820 }
    });
    const page = context.pages()[0] || await context.newPage();

    return {
        browser: context,
        context,
        page
    };
};

module.exports = {
    launchBrowser
};
