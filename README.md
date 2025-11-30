# Twitter/X Data Extractor

Extract usernames and data from Twitter/X posts (likes, retweets, and replies) and export them to an XLSX file.

**🚀 Node.js implementation** - Modern async handling, clean code, fast performance!

## Features

- ✅ Extract all users who **liked** a tweet (works for your own tweets)
- ✅ Extract all users who **retweeted** a tweet
- ✅ Extract all users who **replied** to a tweet (with reply text content)
- ✅ Export to XLSX format with separate sheets
- ✅ Handles rate limiting automatically
- ✅ Beautiful, clear output formatting

## Prerequisites

1. **Twitter API Access**: You need OAuth 1.0a credentials
   - Sign up at [Twitter Developer Portal](https://developer.twitter.com/)
   - Create a new project/app
   - Get your API Key, API Secret, Access Token, and Access Token Secret
   - **Important**: Likes endpoint only works for YOUR OWN tweets with OAuth 1.0a

## Quick Start (Node.js - Recommended)

1. **Install Node.js** (v18+ recommended)
2. **Install dependencies:**
```bash
npm install
```

3. **Create `.env` file:**
```env
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
TWITTER_ACCESS_TOKEN=your_access_token_here
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here
```

4. **Run:**
```bash
npm start "https://x.com/username/status/TWEET_ID"
```

## Output

The script generates an XLSX file with multiple sheets:
- **All Interactions**: Combined list of all users
- **Likes**: Users who liked the tweet
- **Retweets**: Users who retweeted the tweet
- **Replies**: Users who replied to the tweet (includes reply text)

### Column Details:

**Likes & Retweets sheets contain:**
- `username`: Twitter username (e.g., @username)
- `name`: Display name
- `user_id`: Twitter user ID
- `interaction_type`: Type of interaction (Like/Retweet)

**Replies sheet contains (additional columns):**
- `username`: Twitter username
- `name`: Display name
- `user_id`: Twitter user ID
- `interaction_type`: "Reply"
- `reply_text`: **The actual text content of the reply**
- `reply_tweet_id`: The ID of the reply tweet
- `created_at`: When the reply was posted

## Important Notes

- **Likes**: Only work for YOUR OWN tweets (OAuth 1.0a required)
- **Replies**: 
  - **Last 7 days**: Retrieved via Twitter API (automatic, no browser needed)
  - **Older than 7 days**: Uses web scraping (requires browser and login)
  - For old tweets, browser will open - you may need to log in to Twitter/X
- **Rate Limits**: Script handles automatically (25 requests/15 min for Basic tier)
- **Own Tweets**: Best results when extracting from your own account's tweets

## Web Scraping for Old Tweets (>7 days)

For tweets older than 7 days, the script automatically uses web scraping:
- Browser will open (Chrome/Chromium)
- You may need to log in to Twitter/X manually
- Replies will be scraped from the page

⚠️ **WARNING**: Web scraping may violate Twitter's Terms of Service. Use at your own risk.

**Recommended Alternative**: Twitter Academic Research Tier provides legal access to full historical archive. See: https://developer.twitter.com/en/products/twitter-api/academic-research

## Example

```bash
npm start "https://x.com/James_Gets_It/status/1974616766442840240"
```

This will create a file like: `twitter_data_1974616766442840240_20241127_143022.xlsx`

## Troubleshooting

**Error: "Unauthorized"**
- Check that your OAuth 1.0a credentials are correct
- Ensure all 4 credentials are in your `.env` file

**No likes found**
- Make sure you're extracting from YOUR OWN tweets
- Likes from other users' tweets may return 0 (protected accounts)

**No replies found**
- Replies are only available from last 7 days via API
- For older tweets (>7 days), use scraping: `npm start "URL" --scrape`
- **If scraping fails with "Chrome not found" error:**
  1. Install Chrome: https://www.google.com/chrome/
  2. Or run: `install-chrome.bat` (double-click the file)
  3. Or in CMD: `npx puppeteer browsers install chrome`
  4. Or: `npm run install-chrome`
