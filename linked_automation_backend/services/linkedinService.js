const POST_WAIT_MS = 2000;

const isWithin24Hours = (timeText) => {
    if (!timeText) return false;

    const text = timeText.trim().toLowerCase();

    if (text === "now" || text === "just now") return true;
    if (/^\d+\s*m(in)?s?/.test(text)) return true;

    const hourMatch = text.match(/^(\d+)\s*h(our)?s?/);
    if (hourMatch) return Number(hourMatch[1]) <= 23;

    const dayMatch = text.match(/^(\d+)\s*d(ay)?s?/);
    if (dayMatch) return Number(dayMatch[1]) <= 1;

    return false;
};

const extractEmailFromText = (text) => {
    if (!text) return null;

    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
};

const getFirstText = async (root, selectors) => {
    for (const selector of selectors) {
        try {
            const element = await root.$(selector);
            if (!element) continue;

            const text = (await element.innerText()).trim();
            if (text) return text;
        } catch {
        }
    }

    return "";
};

const getPostUrl = async (card, fallbackUrl) => {
    const selectors = [
        "a.app-aware-link[href*='/posts/']",
        "a.app-aware-link[href*='activity']",
        "a[href*='/posts/']",
        "a[href*='activity']",
        "a.search-result__result-link"
    ];

    for (const selector of selectors) {
        try {
            const element = await card.$(selector);
            if (!element) continue;

            const href = await element.getAttribute("href");
            if (href) return href.split("?")[0];
        } catch {
        }
    }

    return fallbackUrl;
};

const getPostTimeText = async (card) => {
    const selectors = [
        "time",
        "span.search-result__time-badge",
        ".update-components-actor__sub-description",
        ".feed-shared-actor__sub-description"
    ];

    for (const selector of selectors) {
        try {
            const element = await card.$(selector);
            if (!element) continue;

            const ariaLabel = await element.getAttribute("aria-label");
            const text = ariaLabel || await element.innerText();
            if (text && text.trim()) return text.trim();
        } catch {
        }
    }

    return "";
};

const expandPostText = async (card) => {
    const selectors = [
        'button:has-text("see more")',
        'button:has-text("See more")',
        'span:has-text("see more")'
    ];

    for (const selector of selectors) {
        try {
            const button = await card.$(selector);
            if (button) {
                await button.click({ timeout: 1000 }).catch(() => {});
                return;
            }
        } catch {
        }
    }
};

const extractPostFromCard = async (page, card, category, settings) => {
    await expandPostText(card);

    const timeText = await getPostTimeText(card);
    if (settings.last24Hours && !isWithin24Hours(timeText)) {
        return null;
    }

    const recruiterName = await getFirstText(card, [
        ".update-components-actor__name span[aria-hidden='true']",
        ".feed-shared-actor__name span[aria-hidden='true']",
        ".entity-result__title-text a span[aria-hidden='true']",
        ".app-aware-link span[aria-hidden='true']"
    ]) || "Unknown recruiter";

    const postText = await getFirstText(card, [
        ".feed-shared-update-v2__description",
        ".update-components-text",
        ".feed-shared-inline-show-more-text",
        ".search-result__snippets",
        "span.break-words"
    ]);

    const recruiterEmail = extractEmailFromText(postText);
    if (!recruiterEmail) {
        console.log(`[linkedinService] No email found for post by ${recruiterName}.`);
        return null;
    }

    if (settings.remoteJobs) {
        const lowerText = postText.toLowerCase();
        const hasRemoteSignal = lowerText.includes("remote") || lowerText.includes("hybrid") || lowerText.includes("wfh");

        if (!hasRemoteSignal) {
            return null;
        }
    }

    if (settings.contractRoles) {
        const lowerText = postText.toLowerCase();
        const hasContractSignal = lowerText.includes("c2c") || lowerText.includes("contract") || lowerText.includes("corp to corp");

        if (!hasContractSignal) {
            return null;
        }
    }

    if (settings.immediateHiring) {
        const lowerText = postText.toLowerCase();
        const hasImmediateSignal = lowerText.includes("immediate") || lowerText.includes("urgent") || lowerText.includes("asap") || lowerText.includes("quick hire");

        if (!hasImmediateSignal) {
            return null;
        }
    }

    const postUrl = await getPostUrl(card, page.url());

    return {
        recruiterName,
        recruiterEmail,
        postUrl,
        postText,
        category,
        timeText
    };
};

const searchPosts = async (page, query, category, settings = {}) => {
    const results = [];
    const maxPosts = Number(settings.maxPostsPerQuery) || 10;
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodedQuery}&f_TPR=r86400&sortBy=date_posted`;

    console.log(`[linkedinService] Opening LinkedIn Posts search: ${query}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(POST_WAIT_MS);

    const postCardSelector = [
        "li.reusable-search__result-container",
        ".feed-shared-update-v2",
        ".update-components-actor"
    ].join(", ");

    const hasCards = await page.locator(postCardSelector).first().isVisible({ timeout: 15000 }).catch(() => false);
    if (!hasCards) {
        console.warn(`[linkedinService] No posts found for "${query}".`);
        return results;
    }

    let previousCount = 0;

    for (let scrollAttempt = 0; scrollAttempt < 5 && results.length < maxPosts; scrollAttempt++) {
        const cards = await page.$$(postCardSelector);
        console.log(`[linkedinService] Parsing ${cards.length} visible cards for "${query}".`);

        for (let index = previousCount; index < cards.length && results.length < maxPosts; index++) {
            try {
                const post = await extractPostFromCard(page, cards[index], category, settings);
                if (post) {
                    results.push(post);
                    console.log(`[linkedinService] Collected ${results.length}/${maxPosts}: ${post.recruiterEmail}`);
                }
            } catch (error) {
                console.warn(`[linkedinService] Could not parse post card ${index}: ${error.message}`);
            }
        }

        previousCount = cards.length;

        if (results.length >= maxPosts) break;

        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await page.waitForTimeout(POST_WAIT_MS);

        const newCount = (await page.$$(postCardSelector)).length;
        if (newCount <= previousCount) break;
    }

    console.log(`[linkedinService] Finished "${query}". Actionable posts: ${results.length}.`);
    return results;
};

module.exports = {
    searchPosts,
    isWithin24Hours,
    extractEmailFromText
};
