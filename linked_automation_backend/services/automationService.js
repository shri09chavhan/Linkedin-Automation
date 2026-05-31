const browserService = require("./browserService");
const linkedinService = require("./linkedinService");
const emailService = require("./emailService");
const resumeService = require("./resumeService");
const aiService = require("./aiService");
const statusService = require("./statusService");

const SEARCH_QUERIES = [
    { category: "Java Developer", query: "Java Developer C2C" },
    { category: "Business Analyst", query: "Business Analyst C2C" },
    { category: "Project Manager", query: "Project Manager C2C" },
    { category: "Data Analyst", query: "Data Analyst C2C" }
];

const decodePassword = (password) => {
    if (!password) return "";

    try {
        const decoded = Buffer.from(password, "base64").toString("utf8");
        const looksEncoded = Buffer.from(decoded, "utf8").toString("base64").replace(/=+$/, "") === password.replace(/=+$/, "");

        if (looksEncoded && decoded.trim()) {
            return decoded;
        }
    } catch {
    }

    return password;
};

const clickFirstVisible = async (page, selectors) => {
    for (const selector of selectors) {
        try {
            const locator = page.locator(selector).first();
            if (await locator.isVisible({ timeout: 2000 })) {
                await locator.click();
                return true;
            }
        } catch {
        }
    }

    return false;
};

const isLoggedIn = async (page) => {
    if (page.url().includes("/feed")) {
        return true;
    }

    return page.locator("input[placeholder='Search'], input[aria-label='Search'], nav[aria-label='Primary Navigation']").first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
};

const waitForManualLogin = async (page, timeoutMs) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (await isLoggedIn(page)) {
            return true;
        }

        await page.waitForTimeout(3000);
    }

    return false;
};

const loginToLinkedIn = async (page, email, rawPassword) => {
    const password = decodePassword(rawPassword);

    statusService.setStatus("login", "Checking existing LinkedIn session");
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    if (await isLoggedIn(page)) {
        console.log("[automationService] LinkedIn session is already logged in.");
        return true;
    }

    statusService.setStatus("login", "Opening LinkedIn login page");
    await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const usernameSelector = [
        "#username",
        'input[name="session_key"]',
        'input[autocomplete="username"]',
        'input[type="email"]'
    ].join(", ");

    const passwordSelector = [
        "#password",
        'input[name="session_password"]',
        'input[autocomplete="current-password"]',
        'input[type="password"]'
    ].join(", ");

    const usernameVisible = await page.locator(usernameSelector).first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!usernameVisible) {
        await clickFirstVisible(page, [
            'button:has-text("Sign in with email")',
            'a:has-text("Sign in with email")',
            'button:has-text("Use email")',
            'a:has-text("Use email")'
        ]);
    }

    statusService.setStatus("login", "Entering LinkedIn credentials");
    await page.waitForSelector(usernameSelector, { state: "visible", timeout: 30000 });
    await page.locator(usernameSelector).first().fill(email);
    console.log("[automationService] LinkedIn email entered.");

    await page.waitForSelector(passwordSelector, { state: "visible", timeout: 15000 });
    await page.locator(passwordSelector).first().fill(password);
    console.log("[automationService] LinkedIn password entered.");

    const submitClicked = await clickFirstVisible(page, [
        'button[type="submit"]',
        'button:has-text("Sign in")',
        'button:has-text("Sign In")'
    ]);

    if (!submitClicked) {
        await page.keyboard.press("Enter");
    }

    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    if (await isLoggedIn(page)) {
        console.log(`[automationService] LinkedIn login completed. URL: ${currentUrl}`);
        return true;
    }

    const needsManualStep = currentUrl.includes("/checkpoint") ||
        currentUrl.includes("/challenge") ||
        currentUrl.includes("/uas/login-submit") ||
        await page.getByText(/verification|security|checkpoint/i).first().isVisible({ timeout: 2000 }).catch(() => false);

    if (needsManualStep) {
        statusService.setStatus("manual_login", "LinkedIn needs verification. Finish it in the opened browser window.");
        const completed = await waitForManualLogin(page, Number(process.env.MANUAL_LOGIN_TIMEOUT_MS) || 180000);
        console.log(`[automationService] Manual login ${completed ? "completed" : "timed out"}. URL: ${page.url()}`);
        return completed;
    }

    console.log(`[automationService] LinkedIn login failed. URL: ${currentUrl}`);
    return false;
};

const createInitialSummary = () => ({
    success: false,
    totalSearchQueries: 0,
    totalPostsFound: 0,
    totalEmailsSent: 0,
    totalSkippedDuplicates: 0,
    aiEnabled: aiService.hasGemini(),
    queries: [],
    results: []
});

const runAutomation = async ({ linkedinEmail, linkedinPassword, settings = {} }) => {
    const summary = createInitialSummary();
    const seenEmails = new Set();
    let browser;

    try {
        statusService.startRun();
        console.log("[automationService] Starting LinkedIn automation run.");
        statusService.setStatus("ai", "Preparing AI search queries");
        const searchQueries = await aiService.buildSearchQueries(settings);
        summary.queries = searchQueries;
        summary.totalSearchQueries = searchQueries.length;

        statusService.setStatus("browser", "Opening browser");
        const launched = await browserService.launchBrowser();
        browser = launched.browser;

        const loggedIn = await loginToLinkedIn(launched.page, linkedinEmail, linkedinPassword);
        if (!loggedIn) {
            throw new Error("LinkedIn login failed. Check credentials or complete any LinkedIn checkpoint.");
        }

        for (const { category, query } of searchQueries) {
            statusService.setStatus("search", `Searching LinkedIn for ${query}`);
            console.log(`[automationService] Searching posts for "${query}".`);

            let posts = [];
            try {
                posts = await linkedinService.searchPosts(launched.page, query, category, settings);
            } catch (error) {
                console.error(`[automationService] Search failed for "${query}": ${error.message}`);
                summary.results.push({
                    status: "search_failed",
                    category,
                    query,
                    error: error.message
                });
                continue;
            }

            summary.totalPostsFound += posts.length;

            for (const post of posts) {
                const emailKey = post.recruiterEmail.toLowerCase();

                if (seenEmails.has(emailKey)) {
                    summary.totalSkippedDuplicates++;
                    console.log(`[automationService] Duplicate recruiter skipped: ${post.recruiterEmail}`);
                    summary.results.push({
                        status: "skipped_duplicate",
                        recruiterName: post.recruiterName,
                        recruiterEmail: post.recruiterEmail,
                        category: post.category,
                        postUrl: post.postUrl
                    });
                    continue;
                }

                seenEmails.add(emailKey);

                try {
                    statusService.setStatus("email", `Sending email to ${post.recruiterEmail}`);
                    
                    // Generate email body before sending (needed for both success and failure cases)
                    const emailBody = await emailService.buildEmailBody({
                        recruiterName: post.recruiterName,
                        category: post.category,
                        postText: post.postText,
                        experience: settings.experience,
                        location: settings.location,
                        replyTo: settings.verifiedEmail
                    });
                    
                    const resumePath = resumeService.customizeResume(post.postText, post.category);
                    const emailResult = await emailService.sendEmail({
                        to: post.recruiterEmail,
                        recruiterName: post.recruiterName,
                        category: post.category,
                        postText: post.postText,
                        resumePath,
                        experience: settings.experience,
                        location: settings.location,
                        replyTo: settings.verifiedEmail
                    });

                    summary.totalEmailsSent++;
                    summary.results.push({
                        status: "email_sent",
                        recruiterName: post.recruiterName,
                        recruiterEmail: post.recruiterEmail,
                        category: post.category,
                        postUrl: post.postUrl,
                        messageId: emailResult.messageId,
                        postText: post.postText,
                        emailBody: emailBody
                    });
                } catch (error) {
                    console.error(`[automationService] Email failed for ${post.recruiterEmail}: ${error.message}`);
                    
                    // Try to generate email body for manual sending even if automatic send failed
                    let emailBody = "";
                    try {
                        emailBody = await emailService.buildEmailBody({
                            recruiterName: post.recruiterName,
                            category: post.category,
                            postText: post.postText,
                            experience: settings.experience,
                            location: settings.location,
                            replyTo: settings.verifiedEmail
                        });
                    } catch (bodyError) {
                        console.error(`[automationService] Failed to generate email body: ${bodyError.message}`);
                    }
                    
                    summary.results.push({
                        status: "email_failed",
                        recruiterName: post.recruiterName,
                        recruiterEmail: post.recruiterEmail,
                        category: post.category,
                        postUrl: post.postUrl,
                        error: error.message,
                        emailBody: emailBody
                    });
                }
            }
        }

        summary.success = true;
        statusService.finishRun(`Finished. Sent ${summary.totalEmailsSent} emails from ${summary.totalPostsFound} posts.`);
        console.log("[automationService] Automation run finished.");
    } catch (error) {
        console.error(`[automationService] Fatal error: ${error.message}`);
        summary.error = error.message;
        statusService.failRun(error.message);
    } finally {
        if (browser) {
            await browser.close().catch((error) => {
                console.warn(`[automationService] Browser close failed: ${error.message}`);
            });
            console.log("[automationService] Browser closed.");
        }

        console.log(
            `[automationService] Summary: searches=${summary.totalSearchQueries}, posts=${summary.totalPostsFound}, ` +
            `sent=${summary.totalEmailsSent}, duplicates=${summary.totalSkippedDuplicates}`
        );
    }

    return summary;
};

module.exports = {
    runAutomation,
    SEARCH_QUERIES
};
