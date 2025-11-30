/**
 * Twitter/X Reply Scraper using Puppeteer (Browser Automation)
 * Falls back to web scraping when API can't get replies older than 7 days.
 * 
 * ⚠️  WARNING: Web scraping may violate Twitter's Terms of Service.
 * Use at your own risk. Consider Twitter Academic Research tier for legal access.
 */

import puppeteer from 'puppeteer';
import { existsSync } from 'fs';

class TwitterScraper {
    constructor(options = {}) {
        this.headless = options.headless !== false;
        this.slowMo = options.slowMo || 500; // Delay between actions (ms)
        this.cookies = options.cookies || null; // Optional cookies for authentication
    }

    extractTweetId(url) {
        if (url.includes('/status/')) {
            return url.split('/status/')[1].split('?')[0];
        }
        return url;
    }

    async getRepliesViaScraping(tweetUrl, maxReplies = 500) {
        console.log('\n   🌐 Starting browser automation to scrape replies...');
        console.log('   ⚠️  WARNING: This may violate Twitter\'s Terms of Service!');
        console.log('   💡 Consider Twitter Academic Research tier for legal access');

        const replies = [];
        let browser = null;

        try {
            // Try to find Chrome/Chromium executable
            let executablePath = null;
            
            // Method 1: Try to find via Windows registry or where command
            try {
                const { execSync } = await import('child_process');
                // Try to find Chrome via where command (Windows)
                try {
                    const chromePath = execSync('where chrome', { encoding: 'utf8', stdio: 'pipe' }).trim();
                    if (chromePath && existsSync(chromePath)) {
                        executablePath = chromePath;
                        console.log(`   🔍 Found Chrome via 'where' command: ${chromePath}`);
                    }
                } catch (e) {
                    // where command failed, continue
                }
            } catch (e) {
                // execSync not available, continue to path search
            }
            
            // Method 2: Search common installation paths
            if (!executablePath) {
                const possiblePaths = [
                    // Windows common paths
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    process.env.LOCALAPPDATA ? process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe' : null,
                    process.env.PROGRAMFILES ? process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe' : null,
                    process.env['PROGRAMFILES(X86)'] ? process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe' : null,
                    // User-specific paths
                    process.env.USERPROFILE ? process.env.USERPROFILE + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe' : null,
                    // Edge (Chromium-based) - can also work
                    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                    process.env.LOCALAPPDATA ? process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe' : null,
                    process.env.PROGRAMFILES ? process.env.PROGRAMFILES + '\\Microsoft\\Edge\\Application\\msedge.exe' : null,
                ].filter(path => path !== null);
                
                // Try to find existing Chrome/Edge
                for (const path of possiblePaths) {
                    try {
                        if (existsSync(path)) {
                            executablePath = path;
                            console.log(`   🔍 Found browser: ${path}`);
                            break;
                        }
                    } catch (e) {
                        // Continue to next path
                    }
                }
            }
            
            // Method 3: Try to read from Windows registry (if still not found)
            if (!executablePath) {
                try {
                    const { execSync } = await import('child_process');
                    // Try to get Chrome path from registry
                    try {
                        const regPath = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve', { 
                            encoding: 'utf8', 
                            stdio: 'pipe' 
                        });
                        const match = regPath.match(/REG_SZ\s+(.+)/);
                        if (match && match[1]) {
                            const chromeExe = match[1].trim();
                            if (existsSync(chromeExe)) {
                                executablePath = chromeExe;
                                console.log(`   🔍 Found Chrome via registry: ${chromeExe}`);
                            }
                        }
                    } catch (e) {
                        // Registry query failed, continue
                    }
                } catch (e) {
                    // execSync not available
                }
            }
            
            if (!executablePath) {
                console.log('   ⚠️  Chrome not found in common locations, will try bundled Chromium');
            }
            
            // Launch browser with fallback options
            // For debugging replies, use non-headless mode to see what's happening
            const launchOptions = {
                headless: false, // Changed to false to see what's happening with replies
                slowMo: this.slowMo,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1920,1080'
                ]
            };
            
            // Use system Chrome if found, otherwise let Puppeteer use bundled
            if (executablePath) {
                launchOptions.executablePath = executablePath;
                console.log(`   🚀 Attempting to launch Chrome from: ${executablePath}`);
            } else {
                console.log('   🚀 Attempting to launch bundled Chromium...');
            }
            
            try {
                browser = await puppeteer.launch(launchOptions);
                console.log('   ✅ Browser launched successfully!');
            } catch (launchError) {
                console.log(`   ❌ Launch failed: ${launchError.message}`);
                
                // If launch fails with system Chrome, try without executablePath (use bundled)
                if (executablePath && (launchError.message.includes('Chrome') || launchError.message.includes('browser') || launchError.message.includes('executable'))) {
                    console.log('   ⚠️  Failed to launch system Chrome, trying bundled Chromium...');
                    delete launchOptions.executablePath;
                    try {
                        browser = await puppeteer.launch(launchOptions);
                        console.log('   ✅ Bundled Chromium launched successfully!');
                    } catch (bundledError) {
                        // Try one more time with old headless mode
                        console.log('   ⚠️  Bundled Chromium also failed, trying old headless mode...');
                        launchOptions.headless = true; // Old headless mode
                        try {
                            browser = await puppeteer.launch(launchOptions);
                            console.log('   ✅ Browser launched with old headless mode!');
                        } catch (oldHeadlessError) {
                            // Last resort: show detailed error
                            console.log('   ❌ All launch attempts failed');
                            console.log(`   📋 System Chrome error: ${launchError.message}`);
                            console.log(`   📋 Bundled error: ${bundledError.message}`);
                            console.log(`   📋 Old headless error: ${oldHeadlessError.message}`);
                            console.log('\n   💡 SOLUTIONS:');
                            console.log('      1. Make sure Chrome is installed: https://www.google.com/chrome/');
                            console.log('      2. Try running: install-chrome.bat');
                            console.log('      3. Or in CMD: npx puppeteer browsers install chrome');
                            console.log('      4. Or: npm run install-chrome');
                            throw new Error(`Browser launch failed. System Chrome: ${launchError.message.substring(0, 100)}`);
                        }
                    }
                } else {
                    // Error not related to Chrome path, throw it
                    throw launchError;
                }
            }

            const page = await browser.newPage();
            
            // Set realistic viewport and user agent
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );
            
            // Set cookies if provided (for authentication)
            if (this.cookies && Array.isArray(this.cookies)) {
                try {
                    await page.setCookie(...this.cookies);
                    console.log('   🔐 Cookies set for authentication');
                } catch (e) {
                    console.log(`   ⚠️  Could not set cookies: ${e.message}`);
                }
            }

            // Navigate to the tweet
            console.log(`   📍 Navigating to tweet: ${tweetUrl}`);
            await page.goto(tweetUrl, { 
                waitUntil: 'networkidle2', 
                timeout: 60000 // Increased timeout
            });
            
            // Try to wait for page to be fully interactive
            await page.waitForFunction(
                () => document.readyState === 'complete',
                { timeout: 10000 }
            ).catch(() => {});
            
            // Check for and close login/registration modal if it appears
            console.log('   🔍 Checking for login modal...');
            try {
                const modalClosed = await page.evaluate(() => {
                    // Look for common modal close buttons
                    const closeSelectors = [
                        '[data-testid="app-bar-close"]',
                        '[aria-label="Close"]',
                        'button[aria-label*="Close"]',
                        'div[role="button"][aria-label*="Close"]',
                        'svg[viewBox="0 0 24 24"]', // Common close icon
                    ];
                    
                    // Also look for modal backdrop and close it
                    const modals = document.querySelectorAll('[role="dialog"], [data-testid*="modal"], [data-testid*="sheet"]');
                    for (const modal of modals) {
                        // Look for close button inside modal
                        const closeBtn = modal.querySelector('button[aria-label*="Close"], button[aria-label*="закрыть"], [data-testid="app-bar-close"]');
                        if (closeBtn) {
                            closeBtn.click();
                            return true;
                        }
                        // Try clicking on X icon
                        const xIcon = modal.querySelector('svg[viewBox="0 0 24 24"]');
                        if (xIcon) {
                            const clickable = xIcon.closest('button') || xIcon.closest('div[role="button"]');
                            if (clickable) {
                                clickable.click();
                                return true;
                            }
                        }
                    }
                    
                    // Try clicking outside modal (on backdrop)
                    const backdrop = document.querySelector('[role="dialog"]')?.parentElement;
                    if (backdrop && backdrop.style) {
                        // Click on backdrop to close
                        backdrop.click();
                        return true;
                    }
                    
                    return false;
                });
                
                if (modalClosed) {
                    console.log('   ✅ Closed login/registration modal');
                    await page.waitForTimeout(2000);
                } else {
                    // Check if modal is still there
                    const hasModal = await page.evaluate(() => {
                        return !!document.querySelector('[role="dialog"], [data-testid*="modal"]');
                    });
                    if (hasModal) {
                        console.log('   ⚠️  Login modal detected but could not close automatically');
                        console.log('   💡 You may need to log in manually in the browser window');
                        console.log('   💡 Or add cookies/session for authentication');
                    }
                }
            } catch (e) {
                console.log(`   ⚠️  Error checking for modal: ${e.message}`);
            }
            
            // Wait for page to fully load and check for replies section
            console.log('   ⏳ Waiting for page to load...');
            await page.waitForTimeout(5000); // Give more time for initial load
            
            // Check if replies are already visible
            const initialCheck = await page.evaluate(() => {
                const articles = document.querySelectorAll('article');
                const replyCount = Array.from(articles).filter(a => {
                    const text = a.textContent || '';
                    return text.includes('Replying to') || 
                           (a.querySelector('[data-testid="reply"]') && articles.length > 1);
                }).length;
                return {
                    totalArticles: articles.length,
                    potentialReplies: replyCount,
                    replyButtonText: document.querySelector('[data-testid="reply"]')?.closest('div')?.textContent || ''
                };
            });
            console.log(`   📊 Initial check: ${initialCheck.totalArticles} articles, ${initialCheck.potentialReplies} potential replies`);
            
            // If only 1 article found, we need to click on reply count to load replies
            if (initialCheck.totalArticles <= 1) {
                console.log('   🔍 Only original tweet found, trying to load replies...');
                
                // Try to find and click on reply count (e.g., "3 replies" or just "3")
                const replyCountClicked = await page.evaluate(() => {
                    // First, find the reply button
                    const replyButton = document.querySelector('[data-testid="reply"]');
                    if (!replyButton) {
                        console.log('No reply button found');
                        return false;
                    }
                    
                    // Look for the count near the reply button
                    let container = replyButton.closest('div');
                    for (let level = 0; level < 10 && container; level++) {
                        const text = container.textContent || '';
                        // Look for number pattern near reply
                        const numberMatch = text.match(/(\d+)\s*(repl|replies|ответ|ответов)/i);
                        if (numberMatch) {
                            // Found reply count, try to click on the container or a link inside
                            const link = container.querySelector('a');
                            if (link) {
                                link.click();
                                console.log('Clicked on reply count link');
                                return true;
                            }
                            // Try clicking the container if it's clickable
                            if (container.getAttribute('role') === 'button' || container.tagName === 'BUTTON') {
                                container.click();
                                console.log('Clicked on reply count container');
                                return true;
                            }
                        }
                        container = container.parentElement;
                    }
                    
                    // If no count found, just click on reply button's parent link/button
                    let clickable = replyButton.closest('a[href*="/status/"]') || 
                                  replyButton.closest('div[role="button"]') ||
                                  replyButton.closest('button');
                    if (clickable) {
                        clickable.click();
                        console.log('Clicked on reply button parent');
                        return true;
                    }
                    
                    // Last resort: click reply button itself
                    replyButton.click();
                    console.log('Clicked on reply button directly');
                    return true;
                });
                
                if (replyCountClicked) {
                    console.log('   ✅ Clicked on reply count/button, waiting for replies to load...');
                    console.log('   💡 Browser window is open - you can see what\'s happening');
                    
                    // Wait longer and try multiple times
                    for (let waitAttempt = 0; waitAttempt < 5; waitAttempt++) {
                        await page.waitForTimeout(2000);
                        
                        const articleCount = await page.evaluate(() => {
                            return document.querySelectorAll('article').length;
                        });
                        
                        console.log(`   ⏳ Wait attempt ${waitAttempt + 1}: ${articleCount} articles found`);
                        
                        if (articleCount > 1) {
                            console.log('   ✅ Replies loaded!');
                            break;
                        }
                    }
                    
                    // Try scrolling down a bit to trigger lazy loading
                    await page.evaluate(() => {
                        window.scrollBy(0, 300);
                    });
                    await page.waitForTimeout(2000);
                    
                    // Check again if replies loaded
                    const afterClickCheck = await page.evaluate(() => {
                        return document.querySelectorAll('article').length;
                    });
                    console.log(`   📊 After click and scroll: ${afterClickCheck} articles found`);
                } else {
                    console.log('   ⚠️  Could not find reply count button, trying alternative methods...');
                }
            }

            // Try multiple ways to find and click "Show replies" or load replies
            try {
                let clicked = false;
                
                // Method 1: Look for "Show replies" text button using evaluate
                const clickedResult = await page.evaluate(() => {
                    // Look for all clickable elements
                    const elements = document.querySelectorAll('div[role="button"], button, a, span');
                    for (const el of elements) {
                        const text = el.textContent?.toLowerCase() || '';
                        if ((text.includes('show') && text.includes('repl')) || 
                            (text.includes('show replies')) ||
                            (text === 'show') ||
                            (text.includes('view replies'))) {
                            el.click();
                            return true;
                        }
                    }
                    return false;
                });
                
                if (clickedResult) {
                    console.log('   🔍 Found "Show replies" button, clicking...');
                    await page.waitForTimeout(5000); // Wait longer for replies to load
                    clicked = true;
                }
                
                // Method 1b: Try clicking on reply count number directly
                if (!clicked) {
                    const replyCountClick = await page.evaluate(() => {
                        // Find reply button and look for count nearby
                        const replyButton = document.querySelector('[data-testid="reply"]');
                        if (replyButton) {
                            // Look for number in the same container
                            let container = replyButton.closest('div');
                            for (let i = 0; i < 5 && container; i++) {
                                const text = container.textContent || '';
                                // Look for pattern like "3" or "3 replies"
                                if (text.match(/^\d+$/) || text.match(/\d+\s*repl/i)) {
                                    // Find clickable element
                                    const clickable = container.querySelector('a, div[role="button"], button') || container;
                                    if (clickable) {
                                        clickable.click();
                                        return true;
                                    }
                                }
                                container = container.parentElement;
                            }
                            
                            // If no count found, just click the reply button's parent
                            const parent = replyButton.closest('a') || replyButton.closest('div[role="button"]');
                            if (parent) {
                                parent.click();
                                return true;
                            }
                        }
                        return false;
                    });
                    
                    if (replyCountClick) {
                        console.log('   🔍 Clicked on reply count/button area');
                        await page.waitForTimeout(5000);
                        clicked = true;
                    }
                }
                
                // Method 2: Try clicking on reply count or reply-related links
                if (!clicked) {
                    const replyLinks = await page.$$('a[href*="/status/"]');
                    for (const link of replyLinks.slice(0, 10)) { // Check first 10 links
                        try {
                            const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', link);
                            const href = await page.evaluate(el => el.getAttribute('href') || '', link);
                            if ((text.includes('repl') || text.includes('show')) && href.includes('/status/')) {
                                console.log('   🔍 Found reply link, clicking...');
                                await link.click();
                                await page.waitForTimeout(3000);
                                clicked = true;
                                break;
                            }
                        } catch (e) {
                            // Continue to next link
                        }
                    }
                }
                
                // Method 3: Try clicking on any element near reply indicators
                if (!clicked) {
                    try {
                        const replyIndicators = await page.$$('[data-testid="reply"], [aria-label*="Reply"], [aria-label*="repl"]');
                        for (const indicator of replyIndicators.slice(0, 5)) {
                            try {
                                const parent = await page.evaluateHandle(el => {
                                    let current = el;
                                    for (let i = 0; i < 5 && current; i++) {
                                        if (current.getAttribute('role') === 'button' || 
                                            current.tagName === 'BUTTON' ||
                                            current.tagName === 'A') {
                                            return current;
                                        }
                                        current = current.parentElement;
                                    }
                                    return null;
                                }, indicator);
                                
                                if (parent && parent.asElement()) {
                                    await parent.asElement().click();
                                    await page.waitForTimeout(2000);
                                    clicked = true;
                                    break;
                                }
                            } catch (e) {
                                // Continue
                            }
                        }
                    } catch (e) {
                        // Continue
                    }
                }
                
                // Method 2: Try clicking on reply count or any reply-related element
                if (!clicked) {
                    try {
                        const replyElements = await page.$$('a[href*="/status/"]');
                        for (const elem of replyElements.slice(0, 5)) { // Check first 5 links
                            const href = await page.evaluate(el => el.getAttribute('href'), elem);
                            if (href && href.includes('/status/')) {
                                const text = await page.evaluate(el => el.textContent, elem);
                                if (text && (text.includes('repl') || text.includes('Show'))) {
                                    console.log('   🔍 Found reply link, clicking...');
                                    await elem.click();
                                    await page.waitForTimeout(3000);
                                    clicked = true;
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        // Continue
                    }
                }
                
                // Method 4: Try clicking on reply count number
                if (!clicked) {
                    try {
                        const replyCountClicked = await page.evaluate(() => {
                            // Look for reply count (usually shows "3 replies" or just "3")
                            const allElements = document.querySelectorAll('*');
                            for (const el of allElements) {
                                const text = el.textContent || '';
                                // Look for pattern like "3 replies" or just number near reply icon
                                if ((text.match(/^\d+\s*repl/i) || text.match(/repl.*\d+/i)) && 
                                    el.closest('article') && 
                                    (el.tagName === 'SPAN' || el.tagName === 'DIV')) {
                                    el.click();
                                    return true;
                                }
                            }
                            return false;
                        });
                        if (replyCountClicked) {
                            console.log('   🔍 Clicked on reply count');
                            await page.waitForTimeout(3000);
                            clicked = true;
                        }
                    } catch (e) {
                        // Continue
                    }
                }
                
                // Method 5: Scroll down to trigger lazy loading of replies
                if (!clicked) {
                    console.log('   📜 Scrolling to trigger replies loading...');
                    await page.evaluate(() => {
                        window.scrollBy(0, 500);
                    });
                    await page.waitForTimeout(2000);
                }
            } catch (e) {
                console.log(`   ⚠️  Could not find "Show replies" button: ${e.message}`);
                // Continue anyway - replies might already be visible
            }

            // Before scrolling, check if replies loaded after clicking
            const articlesAfterClick = await page.evaluate(() => {
                return document.querySelectorAll('article').length;
            });
            console.log(`   📊 Articles after initial click attempts: ${articlesAfterClick}`);
            
            // If still only 1 article, try one more aggressive approach
            if (articlesAfterClick <= 1) {
                console.log('   🔍 Still only 1 article, trying to navigate to replies section...');
                // Try to find and click on any element that might load replies
                await page.evaluate(() => {
                    // Look for any link or button that might lead to replies
                    const allLinks = document.querySelectorAll('a[href*="/status/"]');
                    for (const link of allLinks) {
                        const href = link.getAttribute('href');
                        const text = link.textContent || '';
                        // If it's a reply link (not the main tweet)
                        if (href && href.includes('/status/') && !href.includes(window.location.pathname.split('/status/')[1])) {
                            // This might be a reply, but we want to see all replies
                            // Instead, look for "Show replies" or reply count
                        }
                    }
                    
                    // Try clicking on the reply icon area more aggressively
                    const replyIcon = document.querySelector('[data-testid="reply"]');
                    if (replyIcon) {
                        // Try multiple parent levels
                        let current = replyIcon;
                        for (let i = 0; i < 10 && current; i++) {
                            if (current.tagName === 'A' || current.getAttribute('role') === 'button') {
                                current.click();
                                break;
                            }
                            current = current.parentElement;
                        }
                    }
                });
                await page.waitForTimeout(3000);
            }
            
            // Scroll to load replies
            console.log('   📜 Scrolling to load replies...');
            let scrollAttempts = 0;
            const maxScrolls = 100; // Increased for old tweets that might need more scrolling
            let lastHeight = 0;
            let noChangeCount = 0;
            const seenIds = new Set();
            let lastReplyCount = 0;

            while (scrollAttempts < maxScrolls && replies.length < maxReplies) {
                // Scroll down smoothly - try different scroll amounts
                // Get window height from browser context
                const windowHeight = await page.evaluate(() => window.innerHeight);
                const scrollAmount = scrollAttempts < 10 ? windowHeight * 0.5 : windowHeight;
                await page.evaluate((amount) => {
                    window.scrollBy(0, amount);
                }, scrollAmount);
                
                // Wait longer for old tweets that might load slower
                await page.waitForTimeout(3000); // Increased wait time

                // Extract replies from current page
                const currentReplies = await this.extractRepliesFromPage(page);
                
                if (currentReplies.length > 0) {
                    console.log(`   🔍 Found ${currentReplies.length} replies in current view...`);
                    // Log first reply for debugging
                    if (currentReplies[0]) {
                        console.log(`   📝 Sample reply: @${currentReplies[0].username}: "${currentReplies[0].reply_text?.substring(0, 50)}..."`);
                    }
                } else {
                    console.log(`   🔍 No replies found in current view (scroll attempt ${scrollAttempts})...`);
                }
                
                // Add new replies (avoid duplicates)
                let newCount = 0;
                for (const reply of currentReplies) {
                    // Use tweet ID if available, otherwise use text hash
                    const replyId = reply.reply_tweet_id || 
                                   (reply.reply_text ? reply.reply_text.substring(0, 100) + reply.username : null);
                    if (replyId && !seenIds.has(replyId)) {
                        replies.push(reply);
                        seenIds.add(replyId);
                        newCount++;
                    }
                }
                
                if (newCount > 0) {
                    console.log(`   ✅ Added ${newCount} new replies (Total: ${replies.length})`);
                    lastReplyCount = replies.length;
                    noChangeCount = 0; // Reset counter when we find new replies
                } else {
                    noChangeCount++;
                }

                // Check if we're still loading new content
                const currentHeight = await page.evaluate(() => document.body.scrollHeight);
                if (currentHeight === lastHeight && newCount === 0) {
                    noChangeCount++;
                    if (noChangeCount >= 5) { // Increased threshold
                        console.log(`   ✅ No more replies loading. Found ${replies.length} replies so far.`);
                        break;
                    }
                } else {
                    if (newCount === 0) {
                        noChangeCount++;
                    }
                }

                lastHeight = currentHeight;
                scrollAttempts++;

                if (scrollAttempts % 10 === 0) {
                    console.log(`   ... Scrolled ${scrollAttempts} times, found ${replies.length} replies...`);
                }
                
                // If we haven't found any replies after many scrolls, try different approach
                if (scrollAttempts === 20 && replies.length === 0) {
                    console.log('   ⚠️  No replies found after 20 scrolls. Trying alternative approach...');
                    // Try clicking on "Show more replies" or similar
                    try {
                        const showMoreButtons = await page.$$('div[role="button"], button, a');
                        for (const btn of showMoreButtons.slice(0, 10)) {
                            const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', btn);
                            if (text.includes('show') || text.includes('more') || text.includes('repl')) {
                                await btn.click();
                                await page.waitForTimeout(2000);
                                break;
                            }
                        }
                    } catch (e) {
                        // Continue
                    }
                }
            }

            console.log(`   ✅ Scraping complete! Found ${replies.length} replies`);
            
            if (replies.length === 0) {
                console.log('   ⚠️  No replies found. Running detailed diagnostics...');
                
                // Try to get comprehensive debug info
                try {
                    const debugInfo = await page.evaluate(() => {
                        const articles = document.querySelectorAll('article');
                        const allText = document.body.textContent || '';
                        
                        // Analyze each article
                        const articleAnalysis = Array.from(articles).map((article, index) => {
                            const text = article.textContent || '';
                            const links = Array.from(article.querySelectorAll('a[href*="/status/"]')).map(l => l.getAttribute('href'));
                            const hasReplyingTo = text.includes('Replying to');
                            const hasReplyButton = !!article.querySelector('[data-testid="reply"]');
                            
                            return {
                                index,
                                hasReplyingTo,
                                hasReplyButton,
                                textPreview: text.substring(0, 80),
                                statusLinks: links,
                                isLikelyReply: hasReplyingTo || (index > 0 && !text.includes('Show this thread'))
                            };
                        });
                        
                        return {
                            totalArticles: articles.length,
                            hasReplyingTo: allText.includes('Replying to'),
                            hasReplyButton: !!document.querySelector('[data-testid="reply"]'),
                            articleAnalysis: articleAnalysis,
                            url: window.location.href
                        };
                    });
                    
                    console.log(`   🔍 Detailed analysis:`);
                    console.log(`      - Total articles: ${debugInfo.totalArticles}`);
                    console.log(`      - Has "Replying to" text: ${debugInfo.hasReplyingTo}`);
                    console.log(`      - Has reply button: ${debugInfo.hasReplyButton}`);
                    console.log(`      - Current URL: ${debugInfo.url}`);
                    
                    if (debugInfo.articleAnalysis.length > 0) {
                        console.log(`   📋 Article breakdown:`);
                        debugInfo.articleAnalysis.forEach((article, i) => {
                            console.log(`      Article ${i}: hasReplyingTo=${article.hasReplyingTo}, isLikelyReply=${article.isLikelyReply}`);
                            console.log(`         Text: "${article.textPreview}..."`);
                        });
                    }
                    
                    // Save screenshot for debugging (optional)
                    if (debugInfo.totalArticles > 1) {
                        console.log('   💡 Found multiple articles but no replies extracted - checking selectors...');
                    }
                } catch (e) {
                    console.log(`   ⚠️  Debug info error: ${e.message}`);
                }
                
                console.log('\n   💡 Possible reasons:');
                console.log('      - Replies are not publicly visible');
                console.log('      - Twitter page structure changed');
                console.log('      - Replies need to be loaded differently for old tweets');
                console.log('      - Try checking the page manually in browser');
            }

        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.log('   ⚠️  Timeout while loading page. Some replies may be missing.');
                console.log('   💡 Try increasing timeout or check your internet connection');
            } else if (error.message.includes('Chrome') || error.message.includes('browser')) {
                console.log(`   ❌ Browser error: ${error.message}`);
                console.log('\n   💡 SOLUTIONS:');
                console.log('      1. Install Chrome manually: https://www.google.com/chrome/');
                console.log('      2. Run: install-chrome.bat (double-click the file)');
                console.log('      3. Or in CMD (not PowerShell): npx puppeteer browsers install chrome');
                console.log('      4. Or: npm run install-chrome');
            } else {
                console.log(`   ❌ Error during scraping: ${error.name}: ${error.message}`);
                console.log('   💡 Twitter may have changed their page structure or blocked the request');
                if (error.stack) {
                    console.log(`   📋 Error stack: ${error.stack.substring(0, 300)}...`);
                }
            }
        } finally {
            if (browser) {
                await browser.close();
            }
        }

        return replies.slice(0, maxReplies);
    }

    async extractRepliesFromPage(page) {
        const replies = [];

        try {
            // Wait for tweets to load - use longer timeout for old tweets
            await page.waitForSelector('article[data-testid="tweet"], [data-testid="tweet"], article[role="article"]', { timeout: 10000 }).catch(() => {});
            
            // First, let's check what's actually on the page
            const pageInfo = await page.evaluate(() => {
                const articles = document.querySelectorAll('article');
                const allText = document.body.textContent || '';
                return {
                    articleCount: articles.length,
                    hasReplyingTo: allText.includes('Replying to'),
                    hasReplyButton: !!document.querySelector('[data-testid="reply"]'),
                    sampleTexts: Array.from(articles).slice(0, 5).map(a => ({
                        text: a.textContent?.substring(0, 100),
                        hasReplyingTo: a.textContent?.includes('Replying to'),
                        links: Array.from(a.querySelectorAll('a[href*="/status/"]')).map(l => l.getAttribute('href'))
                    }))
                };
            });
            
            console.log(`   📊 Page analysis: ${pageInfo.articleCount} articles, has "Replying to": ${pageInfo.hasReplyingTo}`);
            if (pageInfo.sampleTexts.length > 0) {
                console.log(`   📝 First article text: "${pageInfo.sampleTexts[0]?.text?.substring(0, 80)}..."`);
            }

            // Extract all tweet articles using page.evaluate for better performance
            const tweetData = await page.evaluate(() => {
                const tweets = [];
                
                // Find all tweet articles - try multiple selectors for better compatibility
                const selectors = [
                    'article[data-testid="tweet"]',
                    'article[role="article"]',
                    '[data-testid="tweet"]',
                    'div[data-testid="cellInnerDiv"] article'
                ];
                
                let tweetElements = [];
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length >= 1) { // Changed: check for >= 1, not > 1
                        tweetElements = Array.from(elements);
                        break;
                    }
                }
                
                // If no elements found, try a broader search
                if (tweetElements.length === 0) {
                    tweetElements = Array.from(document.querySelectorAll('article'));
                }
                
                // Also try to find replies in different containers
                if (tweetElements.length <= 1) {
                    // Try looking in timeline or thread containers
                    const timelineArticles = document.querySelectorAll('[data-testid="cellInnerDiv"] article, [role="article"]');
                    if (timelineArticles.length > tweetElements.length) {
                        tweetElements = Array.from(timelineArticles);
                    }
                }
                
                console.log(`Found ${tweetElements.length} article elements`);
                
                // Get the original tweet URL to identify it
                const currentUrl = window.location.href;
                const originalTweetId = currentUrl.match(/\/status\/(\d+)/)?.[1];
                
                // Process all articles and identify which are replies
                tweetElements.forEach((element, index) => {
                    const elementText = element.textContent || '';
                    const hasReplyingTo = elementText.includes('Replying to');
                    
                    // Skip the first article if it's clearly the original tweet
                    // (no "Replying to", and it's the first one)
                    if (index === 0 && !hasReplyingTo) {
                        // Check if it contains the original tweet ID in a main link
                        if (originalTweetId) {
                            const mainLink = element.querySelector('a[href*="/status/' + originalTweetId + '"]');
                            if (mainLink && !mainLink.textContent?.includes('Replying to')) {
                                // This is the original tweet, skip it
                                console.log(`Skipping original tweet (index ${index})`);
                                return;
                            }
                        } else {
                            // No tweet ID, but first article without "Replying to" is likely original
                            console.log(`Skipping likely original tweet (index ${index}, no "Replying to")`);
                            return;
                        }
                    }
                    
                    // If it has "Replying to" OR it's not the first element, process it as a potential reply
                    if (hasReplyingTo || index > 0) {
                        console.log(`Processing potential reply (index ${index}, hasReplyingTo: ${hasReplyingTo})`);
                    } else {
                        // Skip if it's first and doesn't have "Replying to"
                        return;
                    }
                    
                    try {
                        // Extract username - look for links that match username pattern
                        // Try multiple methods to find username
                        let username = null;
                        let name = null;
                        
                        // Method 1: Look for @username links
                        const userLinks = element.querySelectorAll('a[href^="/"]');
                        for (const link of userLinks) {
                            const href = link.getAttribute('href');
                            if (href && href.startsWith('/') && !href.startsWith('/i/') && !href.includes('/status/') && !href.includes('/search')) {
                                const match = href.match(/^\/([^\/\?]+)/);
                                if (match && match[1] && !match[1].includes(' ') && match[1].length > 0 && match[1].length < 20) {
                                    username = match[1];
                                    // Try to get display name from nearby elements
                                    const nameSpan = link.querySelector('span') || 
                                                    link.parentElement?.querySelector('span') ||
                                                    link.nextElementSibling?.querySelector('span');
                                    if (nameSpan) {
                                        const nameText = nameSpan.textContent?.trim();
                                        if (nameText && nameText.length > 0 && nameText.length < 50 && nameText !== username) {
                                            name = nameText;
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                        
                        // Method 2: Look for @username in text
                        if (!username) {
                            const textContent = element.textContent || '';
                            const atMatch = textContent.match(/@(\w+)/);
                            if (atMatch && atMatch[1]) {
                                username = atMatch[1];
                            }
                        }
                        
                        // Method 3: Look for data attributes
                        if (!username) {
                            const userElement = element.querySelector('[data-testid="User-Name"]') || 
                                              element.querySelector('[data-testid="UserName"]');
                            if (userElement) {
                                const userLink = userElement.querySelector('a[href^="/"]');
                                if (userLink) {
                                    const href = userLink.getAttribute('href');
                                    const match = href?.match(/^\/([^\/\?]+)/);
                                    if (match && match[1]) {
                                        username = match[1];
                                    }
                                }
                            }
                        }
                        
                        if (!username) {
                            // Last resort: try to extract from any visible text
                            const allLinks = element.querySelectorAll('a');
                            for (const link of allLinks) {
                                const href = link.getAttribute('href');
                                if (href && href.match(/^\/[a-zA-Z0-9_]+$/)) {
                                    username = href.substring(1);
                                    break;
                                }
                            }
                        }
                        
                        if (!username) return; // Skip if no username found
                        
                        // Extract tweet text - try multiple selectors
                        let text = '';
                        const textSelectors = [
                            '[data-testid="tweetText"]',
                            'div[data-testid="tweetText"]',
                            'div[lang]',
                            '[lang]'
                        ];
                        
                        for (const selector of textSelectors) {
                            const textElem = element.querySelector(selector);
                            if (textElem) {
                                text = textElem.textContent || textElem.innerText || '';
                                if (text.trim().length > 0) break;
                            }
                        }
                        
                        // If still no text, try getting all text from the article
                        if (!text || text.length < 3) {
                            const allText = element.textContent || element.innerText || '';
                            // Remove username and engagement metrics
                            text = allText.split('\n').filter(line => {
                                return line.trim().length > 0 && 
                                       !line.includes('Reply') && 
                                       !line.includes('Retweet') &&
                                       !line.includes('Like') &&
                                       !line.includes('View') &&
                                       !line.includes('Share');
                            }).join(' ').trim();
                        }
                        
                        // More lenient text check - some replies might be short or just emojis
                        if (!text || text.trim().length < 1) {
                            console.log(`Skipping reply: no text found for username ${username}`);
                            return; // Skip only if completely empty
                        }
                        
                        console.log(`Found reply: @${username}: "${text.substring(0, 50)}..."`);
                        
                        // Extract tweet ID from any status link
                        let tweetId = null;
                        const statusLinks = element.querySelectorAll('a[href*="/status/"]');
                        for (const link of statusLinks) {
                            const href = link.getAttribute('href');
                            if (href && href.includes('/status/')) {
                                const match = href.match(/\/status\/(\d+)/);
                                if (match && match[1]) {
                                    tweetId = match[1];
                                    break;
                                }
                            }
                        }
                        
                        // Extract timestamp
                        let createdAt = '';
                        const timeElem = element.querySelector('time');
                        if (timeElem) {
                            const datetimeAttr = timeElem.getAttribute('datetime');
                            if (datetimeAttr) {
                                try {
                                    const date = new Date(datetimeAttr);
                                    createdAt = date.toISOString().replace('T', ' ').substring(0, 19);
                                } catch (e) {
                                    // Ignore
                                }
                            }
                        }
                        
                        tweets.push({
                            username: username,
                            name: name || username,
                            reply_text: text.trim(),
                            reply_tweet_id: tweetId || `scraped_${index}`,
                            created_at: createdAt
                        });
                        
                    } catch (error) {
                        // Skip this tweet if extraction fails
                        console.error('Error extracting tweet:', error);
                    }
                });
                
                return tweets;
            });

            // Add to replies array
            replies.push(...tweetData);

        } catch (error) {
            console.log(`   ⚠️  Error extracting replies: ${error.message}`);
        }

        return replies;
    }
}

/**
 * Get replies using API first, then fall back to scraping if needed.
 */
export async function getRepliesWithFallback(tweetUrl, apiReplies, tweetAgeDays, options = {}) {
    const { useScraping = false, maxScraped = 500 } = options;
    const allReplies = [...apiReplies];

    // If tweet is older than 7 days, ALWAYS try scraping (API won't work)
    // OR if useScraping flag is set
    // OR if API returned 0 but we expect replies
    const shouldScrape = tweetAgeDays > 7 || useScraping || (apiReplies.length === 0 && tweetAgeDays > 0);
    
    if (shouldScrape) {
        if (tweetAgeDays > 7) {
            console.log(`\n   🔄 Tweet is ${Math.floor(tweetAgeDays)} days old (>7 days)`);
            console.log('   💡 API only returns last 7 days. Attempting web scraping fallback...');
        } else if (useScraping) {
            console.log(`\n   🔄 Scraping flag enabled. Attempting web scraping...`);
        } else {
            console.log(`\n   🔄 API returned 0 replies. Attempting web scraping fallback...`);
        }

        try {
            const scraper = new TwitterScraper({ headless: false, slowMo: 500 }); // Changed to false to see modals
            const scrapedReplies = await scraper.getRepliesViaScraping(tweetUrl, maxScraped);

            // Merge with API replies (avoid duplicates)
            const apiTweetIds = new Set(apiReplies.map(r => r.reply_tweet_id).filter(id => id));
            const apiTextHashes = new Set(apiReplies.map(r => r.reply_text?.substring(0, 50)).filter(t => t));
            
            let newReplies = 0;
            for (const reply of scrapedReplies) {
                const replyId = reply.reply_tweet_id;
                const replyText = reply.reply_text?.substring(0, 50);
                
                // Check both ID and text to avoid duplicates
                const isDuplicate = (replyId && apiTweetIds.has(replyId)) || 
                                   (replyText && apiTextHashes.has(replyText));
                
                if (!isDuplicate) {
                    allReplies.push(reply);
                    newReplies++;
                    if (replyId) apiTweetIds.add(replyId);
                    if (replyText) apiTextHashes.add(replyText);
                }
            }

            console.log(`   ✅ Combined: ${apiReplies.length} from API + ${newReplies} new from scraping = ${allReplies.length} total`);

        } catch (error) {
            if (error.message.includes('puppeteer') || error.message.includes('Cannot find module')) {
                console.log('   ⚠️  Puppeteer not installed. Install with: npm install puppeteer');
            } else {
                console.log(`   ❌ Scraping failed: ${error.name}: ${error.message}`);
                console.log('   💡 Falling back to API results only');
                if (error.stack) {
                    console.log(`   📋 Error details: ${error.stack.substring(0, 200)}...`);
                }
            }
        }
    }

    return allReplies;
}

export default TwitterScraper;

