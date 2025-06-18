const { test, expect } = require('@playwright/test');
const DataLayerTracker = require('../modules/dataLayerTracker');

test('preserve dataLayer across navigation and back', async ({ page }) => {
  const tracker = new DataLayerTracker(page);

  // Set up test input (you can change these URLs per test case)
  const originUrl = 'https://brootaylor.com';
  const destinationUrl = 'https://brootaylor.com/about';
  const linkSelector = `a[href="/about"]`; // Update to match real link if needed

  // Start on any arbitrary page
  await page.goto(originUrl);
  await tracker.init();

  // Simulate the click that pushes to dataLayer and navigates
  await page.click(linkSelector);
  await tracker.afterNavigationEvent(); // <-- renamed method

  // Optional: verify you've reached the destination
  await expect(page).toHaveURL(destinationUrl);

  // Now simulate "Back" button
  await page.goBack();
  await tracker.afterNavigationEvent(); // <-- re-hook interception

  // Restore any push events that were captured from the origin page
  await tracker.restoreCurrentPageDataLayer();

  // Read the restored dataLayer
  const restored = await page.evaluate(() => window.dataLayer || []);
  console.log('Restored dataLayer after going back:', restored);

  // Assertion: example — check for a specific event pushed before navigation
  const hasExpectedEvent = restored.some(item => item.event === 'anExampleEvent');
  expect(hasExpectedEvent).toBe(true);
});
