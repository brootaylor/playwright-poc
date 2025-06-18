const { test, expect } = require('@playwright/test');
const DataLayerTracker = require('../modules/dataLayerTracker');

// Grouping all tests related to the DataLayerTracker behaviour
test.describe('DataLayerTracker behaviour', () => {
  test('preserve dataLayer across navigation and back', async ({ page }) => {
    const tracker = new DataLayerTracker(page);

    // Set up test input (you can change these URLs per test case)
    const originUrl = 'https://brootaylor.com';
    const destinationUrl = 'https://brootaylor.com/about';

    // Start on any arbitrary page
    await page.goto(originUrl);
    await tracker.init();

    // Simulate the click that pushes to dataLayer and navigates
    // In this case, we want to click the link with the text "I'm Bruce"
    const bruceLink = page.getByRole('link', { name: "I'm Bruce" });
    await expect(bruceLink).toBeVisible(); // Ensure the link exists before clicking
    await bruceLink.click(); // Perform the actual navigation
    await tracker.afterNavigationEvent(); // <-- reinjects push interceptor post-navigation

    // Optional: verify you've reached the destination
    await expect(page).toHaveURL(destinationUrl);

    // Now simulate "Back" button
    await page.goBack();
    await tracker.afterNavigationEvent(); // <-- re-hook interception after browser back nav

    // Restore any push events that were captured from the origin page
    await tracker.restoreCurrentPageDataLayer();

    // Read the restored dataLayer
    const restored = await page.evaluate(() => {
      return Array.isArray(window.dataLayer) ? window.dataLayer : [];
    });
    console.log('Restored dataLayer after going back:', restored);

    // Assertion: example — check for a specific event pushed before navigation
    const hasExpectedEvent = restored.some(item => item.event === 'anExampleEvent');

    // Log dataLayer contents if assertion fails (useful for debugging)
    if (!hasExpectedEvent) {
      console.warn('⚠️ Expected event "anExampleEvent" not found in restored dataLayer:', restored);
    }

    expect(hasExpectedEvent).toBe(true);
  });

  test('pushes "promoViewed" when promo block is visible', async ({ page }) => {
    const tracker = new DataLayerTracker(page);

    // Go to a page with a promotional banner or block
    await page.goto('https://brootaylor.com/projects');
    await tracker.init();

    // Check whether the promo block exists before continuing
    const promoBlock = page.locator('.promo-banner');
    const promoExists = await promoBlock.count();

    if (promoExists === 0) {
      console.warn('⚠️ Skipping test — .promo-banner not found on page.');
      test.skip();
      return;
    }

    // Wait for the promo block to become visible
    await expect(promoBlock).toBeVisible();

    // Simulate some time for the event to be pushed (if pushed on visibility)
    await page.waitForTimeout(500); // Or ideally wait for a specific condition/event

    // Read what was pushed to the dataLayer
    const pushedEvents = await page.evaluate(() => window.dataLayer || []);
    console.log('dataLayer after promo view:', pushedEvents);

    // Check for a fictional "promoViewed" event
    const sawPromoViewed = pushedEvents.some(event => event.event === 'promoViewed');
    expect(sawPromoViewed).toBe(true);
  });
});
