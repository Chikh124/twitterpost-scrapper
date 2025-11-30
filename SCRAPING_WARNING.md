# ⚠️ Web Scraping Warning

## Important Legal Notice

The web scraping feature in this tool may **violate Twitter's Terms of Service**. Use at your own risk.

### Twitter's Terms of Service

According to Twitter's Terms of Service:
- Automated data collection (scraping) is generally prohibited
- Twitter may block or ban accounts/IPs that engage in scraping
- Legal action may be taken against violators

### Recommended Alternatives

1. **Twitter Academic Research Tier** (Best Option)
   - Official access to full historical archive
   - Legal and compliant
   - Requires application and approval
   - Free for qualified researchers
   - [Apply here](https://developer.twitter.com/en/products/twitter-api/academic-research)

2. **Twitter API Pro/Enterprise Tier**
   - Paid access with better rate limits
   - May have access to more historical data
   - Official and legal

3. **Third-Party Services**
   - Services with official Twitter partnerships
   - May have access to historical data
   - Usually paid

### If You Still Want to Use Scraping

**Risks:**
- Your IP may be blocked
- Your Twitter account may be suspended
- Legal consequences possible
- Scraping may break when Twitter updates their website

**Best Practices (if you proceed):**
- Use slow delays between requests
- Don't scrape too frequently
- Use a VPN/proxy (but still risky)
- Only scrape public data
- Respect robots.txt

### How to Use Scraping Feature (Node.js)

1. Install Puppeteer:
```bash
npm install puppeteer
```

2. Run with scraping flag:
```bash
npm start "TWEET_URL" --scrape
```

Or:
```bash
node twitterExtractor.js "TWEET_URL" --scrape
```

### Recommendation

**For production use or important data, use Twitter Academic Research tier instead of scraping.**

