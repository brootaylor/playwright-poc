// dataLayerTracker.js
// ---------------------------------
// To be used by the Playwright test suite
// An attempt anyway :-)

class DataLayerTracker {
    constructor(page) {
        this.page = page; // Meant to represent the current Playwright (Node-based) browser tab/page
        this.dataLayerHistory = {}; // Empty object to store captured `dataLayer.push()` values
    }

    /**
     * - Exposing a Node callback (`capturePush`) to the browser context
     * - Injecting a wrapper around `dataLayer.push` in the browser
     */
    async init() {
        await this.page.exposeFunction('capturePush', (event) => {
            const url = this._getPagePathname(); // Grab only the pathname of the URL

            if (!this.dataLayerHistory[url]) {
                this.dataLayerHistory[url] = [];
            }

            this.dataLayerHistory[url].push(event); // Save each push for this page
            console.log(`[GTM Tracker] Captured dataLayer.push on ${url}`, event); // Logging what data is captured
        });

        // Inject the actual push interceptor into the browser context
        await this.injectPushInterceptor();
    }

    /**
     * Injects a wrapper for `window.dataLayer.push` that:
     * - Makes sure the dataLayer is already defined
     * - Sends each pushed value back to the Node (aka Playwright) context via `capturePush`
     * - Prevents double-wrapping ==> Only want capture logic to run ONCE per actual push. Much like a real browser would :-)
     */
    async injectPushInterceptor() {
        await this.page.evaluate(() => {
            // Create the dataLayer array if it doesn't already exist
            if (!window.dataLayer || !Array.isArray(window.dataLayer)) {
                window.dataLayer = [];
            }

            // Saving a reference to the original `push()` method before we overwrite it
            const originalPush = window.dataLayer.push;

            // Only wrap once — trying to avoid breaking repeated calls... as this wouldn't do :-(
            if (!originalPush._intercepted) {
                const wrappedPush = function () {
                    try {
                        // Send pushed data back to the Playwright context
                        window.capturePush(...arguments);
                    } catch (err) {
                        console.warn('[GTM Tracker] Failed to call capturePush:', err);
                    }

                    // Applying the original push logic
                    return originalPush.apply(this, arguments);
                };

                // Mark this push as intercepted to avoid double-wrapping.
                wrappedPush._intercepted = true;
                window.dataLayer.push = wrappedPush;
            }
        });
    }

    /**
     * Called after every navigation event. For example, events like - (clicking a link, using `page.goBack()` or maybe `page.goto()`)
     * It trys to ensure:
     * - Page has finished loading
     * - The push interceptor (aka `injectPushInterceptor`) is reinjected - (since new pages typically replace the context).... and we don't want that!
     */
    async afterNavigationEvent() {
        // Wait for DOM to be ready
        await this.page.waitForLoadState('domcontentloaded');

        // Reinject the interceptor - (As JS context is usually reset on a navigation event)
        await this.injectPushInterceptor();
    }

    /**
     * After navigating back to a previously visited page, then this needs to happen:
     * - Look up the pushes previously captured for that page
     * - Re-push them to the live dataLayer
     * - This mimics the effect of `bfcache` (aka 'Back-Forward Cache') restoring the memory state in 'real' browsers.
     */
    async restoreCurrentPageDataLayer() {
        const url = this._getPagePathname(); // Pathname of the current page
        const pushes = this.dataLayerHistory[url] || [];

        // Re-populate the page's dataLayer with its previously recorded pushes
        await this.page.evaluate((storedPushes) => {
            if (!window.dataLayer || !Array.isArray(window.dataLayer)) {
                window.dataLayer = [];
            }

            // Replay each captured event as if it had just been pushed
            storedPushes.forEach(event => window.dataLayer.push(event));
        }, pushes);
    }

    /**
     * Small utility method to extract only the pathname from the current page URL
     * - Helps keep URL handling consistent and avoids potential URL constructor pitfalls
     */
    _getPagePathname() {
        try {
            return new URL(this.page.url()).pathname;
        } catch {
            // fallback in case page.url() returns a malformed string
            return '/';
        }
    }
}

module.exports = DataLayerTracker;
