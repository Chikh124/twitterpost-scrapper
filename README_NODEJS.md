# Twitter/X Data Extractor (Node.js) 🚀

**Recommended version!** Modern Node.js implementation with improved async handling and cleaner code.

## Why Node.js?

- ✅ **Better async/await** - Native promise handling
- ✅ **Faster I/O** - Better for concurrent operations
- ✅ **Modern JavaScript** - ES6+ features
- ✅ **Smaller footprint** - No heavy dependencies
- ✅ **Better error handling** - Native try/catch with async
- ✅ **Puppeteer support** - Scrape older replies (>7 days)

## Installation

1. Install Node.js (v18+ recommended)
2. Install dependencies:
```bash
npm install
```

**Note:** First install may take 5-10 minutes as Puppeteer downloads Chromium (~300MB). This is normal!

## Setup

Create a `.env` file in the project directory:

```env
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
TWITTER_ACCESS_TOKEN=your_access_token_here
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here
```

## Usage

### Basic Usage (API only - last 7 days of replies)

```bash
npm start "https://x.com/username/status/TWEET_ID"
```

Or:

```bash
node twitterExtractor.js "https://x.com/username/status/TWEET_ID"
```

### With Scraping (for replies older than 7 days)

```bash
npm start "https://x.com/username/status/TWEET_ID" --scrape
```

⚠️ **Warning:** Scraping may violate Twitter's Terms of Service. Use at your own risk. See `SCRAPING_WARNING.md` for details.

## Features

- ✅ Extract likes (works for your own tweets)
- ✅ Extract retweets
- ✅ Extract replies (with text content)
  - API: Last 7 days only
  - Scraping: All replies (with `--scrape` flag)
- ✅ Export to XLSX with multiple sheets
- ✅ Automatic rate limit handling
- ✅ Beautiful output formatting

## Output

Same Excel format as Python version:
- **All Interactions** sheet
- **Likes** sheet
- **Retweets** sheet
- **Replies** sheet (with reply text)

## Comparison

| Feature | Python | Node.js |
|---------|--------|---------|
| Async handling | Good | Excellent |
| Performance | Good | Better for I/O |
| Dependencies | pandas, tweepy, openpyxl | twitter-api-v2, exceljs, puppeteer |
| Code size | ~800 lines | ~600 lines |
| Error handling | Good | Excellent |
| Scraping support | Playwright (removed) | Puppeteer ✅ |

## Notes

- Same API requirements as Python version
- Same rate limit handling
- **Replies:** API only returns last 7 days. Use `--scrape` flag for older replies.
- **Likes:** Only work for YOUR OWN tweets (OAuth 1.0a required)

## Quick Example

```bash
# Make sure you have .env file with credentials
npm start "https://x.com/James_Gets_It/status/1974616766442840240"
```

For older tweets with replies:
```bash
npm start "https://x.com/username/status/OLD_TWEET_ID" --scrape
```

This will create: `twitter_data_1974616766442840240_20241128_120000.xlsx`

## Troubleshooting

**Error: "Unauthorized"**
- Check that your OAuth 1.0a credentials are correct in `.env`
- Ensure all 4 credentials are present

**No likes found**
- Make sure you're extracting from YOUR OWN tweets
- Likes from other users' tweets may return 0 (protected accounts)

**No replies found (API)**
- Replies are only available from last 7 days via API
- Use `--scrape` flag for older tweets

**Puppeteer installation slow**
- First install downloads Chromium (~300MB) - this is normal
- Takes 5-10 minutes depending on internet speed
- Subsequent installs are much faster

**Scraping fails**
- Twitter may have changed their page structure
- Your IP may be rate-limited
- Try again later or use API only
