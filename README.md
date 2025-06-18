# Playwright POC

Just getting my head around running some test scenarios using Playwright. Specifically when mimicking the clicking of a browser back button in a browser.

'Real' browsers use something called `bfcache` *(aka 'Back-Forward Cache')* and Playwright doesn't quite get this right when attempting to mimic a browser back button being clicked. So, any events one would like to view (in the console) from a link clicked on the page you just came from &mdash; this test script is an attempt at mimicking the user's experience in a native browser.