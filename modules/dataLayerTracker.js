// modules/dataLayerTracker.js

/**
 * A Playwright helper class that:
 * - Intercepts all dataLayer.push() calls in the browser context
 * - Stores pushed events per full URL (origin + pathname + search)
 * - Allows re-injection of those events when navigating back
 */
class DataLayerTracker {
  constructor(page) {
    this.page = page;

    /**
     * Maps full URLs to arrays of dataLayer events
     * e.g., {
     *   "https://example.com/page1?ref=abc": [ { event: "click" }, ... ]
     * }
     */
    this.dataLayerHistory = {};
  }

  /**
   * Call this once after navigating to your first page.
   * It sets up the tracking infrastructure:
   * - Exposes a capture function to browser context
   * - Injects a wrapper for dataLayer.push
   */
  async init() {
    await this.page.exposeFunction('capturePush', (event) => {
      const url = this._getCurrentPageUrl();
      if (!this.dataLayerHistory[url]) {
        this.dataLayerHistory[url] = [];
      }
      this.dataLayerHistory[url].push(event);
    });

    await this.injectPushInterceptor();
  }

  /**
   * Injects a wrapper function for dataLayer.push inside the browser.
   * Ensures it doesn't double-wrap.
   */
  async injectPushInterceptor() {
    await this.page.evaluate(() => {
      if (!window.dataLayer || !Array.isArray(window.dataLayer)) {
        window.dataLayer = [];
      }

      const originalPush = window.dataLayer.push;

      if (!originalPush._intercepted) {
        const wrappedPush = function () {
          window.capturePush(...arguments);
          return originalPush.apply(this, arguments);
        };
        wrappedPush._intercepted = true;
        window.dataLayer.push = wrappedPush;
      }
    });
  }

  /**
   * Call this after any navigation (click, goBack, etc.).
   * It waits for the DOM and re-applies the dataLayer interception.
   */
  async afterNavigationEvent() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.injectPushInterceptor();
  }

  /**
   * Call this after navigating *back* to a page.
   * It looks up the full URL, and re-pushes all events that were captured on that URL.
   */
  async restoreCurrentPageDataLayer() {
    const url = this._getCurrentPageUrl();
    const pushes = this.dataLayerHistory[url] || [];

    await this.page.evaluate((storedPushes) => {
      if (!window.dataLayer || !Array.isArray(window.dataLayer)) {
        window.dataLayer = [];
      }
      storedPushes.forEach(event => window.dataLayer.push(event));
    }, pushes);
  }

  /**
   * Returns the full URL of the current page — including origin, pathname, and query string.
   * Ensures each visited URL is uniquely identified in the history map.
   */
  _getCurrentPageUrl() {
    const url = this.page.url(); // Full URL like "https://example.com/page1?foo=bar"
    return url;
  }
}

module.exports = DataLayerTracker;
