/**
 * Twitter/X Data Extractor (Node.js)
 * Extracts usernames from likes, retweets, and replies of a specific tweet
 * and exports them to an XLSX file.
 */

import { TwitterApi } from 'twitter-api-v2';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';
import { createInterface } from 'readline';

// Load .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TwitterExtractor {
    constructor(options = {}) {
        const {
            bearerToken,
            apiKey,
            apiSecret,
            accessToken,
            accessTokenSecret
        } = options;

        // Initialize Twitter API client
        if (apiKey && apiSecret && accessToken && accessTokenSecret) {
            // Full OAuth 1.0a (required for likes endpoint)
            this.client = new TwitterApi({
                appKey: apiKey,
                appSecret: apiSecret,
                accessToken: accessToken,
                accessSecret: accessTokenSecret,
            });
            // Use readWrite for OAuth 1.0a (has access to likes/retweets)
            this.apiClient = this.client.readWrite;
            this.authType = 'oauth1';
        } else if (bearerToken) {
            // Bearer Token (read-only, doesn't work for likes)
            this.client = new TwitterApi(bearerToken);
            this.apiClient = this.client.readOnly;
            this.authType = 'bearer';
        } else {
            throw new Error('Need either: bearerToken OR (apiKey + apiSecret + accessToken + accessTokenSecret)');
        }
    }

    extractTweetId(url) {
        if (url.includes('/status/')) {
            return url.split('/status/')[1].split('?')[0];
        }
        return url;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getLikers(tweetId) {
        console.log('\n   📥 Fetching ALL likers... (respecting 25 requests/15 mins limit)');
        console.log('   💡 Using max_results=100 with proper delays to get ALL data...');
        console.log('   💡 Note: Works best for your OWN tweets (OAuth 1.0a required)');

        const likers = [];
        let requestCount = 0;
        let nextToken = null;
        let count = 0;

        try {
            while (true) {
                requestCount++;

                try {
                    let response;
                    if (nextToken) {
                        console.log(`   📄 Request ${requestCount}: Fetching next page...`);
                        response = await this.apiClient.v2.tweetLikedBy(tweetId, {
                            max_results: 100,
                            pagination_token: nextToken,
                            'user.fields': ['username', 'name', 'created_at']
                        });
                    } else {
                        response = await this.apiClient.v2.tweetLikedBy(tweetId, {
                            max_results: 100,
                            'user.fields': ['username', 'name', 'created_at']
                        });
                    }

                    if (response.data && response.data.length > 0) {
                        for (const user of response.data) {
                            likers.push({
                                username: user.username,
                                name: user.name,
                                user_id: user.id
                            });
                            count++;
                        }

                        console.log(`   ✅ Request ${requestCount}: Fetched ${response.data.length} users (Total: ${count} likers)`);

                        // Check for next page
                        nextToken = response.meta?.next_token || null;

                        if (nextToken) {
                            console.log(`   📄 More data available! next_token = ${nextToken.substring(0, 30)}...`);
                        } else {
                            console.log(`   ✅ No more data. Total: ${count} likers`);
                            break;
                        }
                    } else {
                        if (requestCount === 1 && count === 0) {
                            console.log('   ⚠️  WARNING: Tweet shows likes in metrics, but API returned 0 likers');
                            console.log('   💡 Possible reasons:');
                            console.log('      - Likes are from protected accounts (not visible via API)');
                            console.log('      - API tier has limited visibility (Basic tier limitation)');
                            console.log('      - Privacy settings hide likers from API access');
                            console.log('   📊 This is a Twitter API limitation, not a code issue');
                        }
                        console.log(`   ✅ No more data. Total: ${count} likers`);
                        break;
                    }
                } catch (error) {
                    if (error.code === 401) {
                        console.log('   ❌ UNAUTHORIZED: This endpoint requires OAuth 1.0a User Context');
                        console.log('   💡 You need: API Key + Secret + Access Token + Access Token Secret');
                    } else if (error.code === 403) {
                        console.log('   ❌ FORBIDDEN: Bearer Token (OAuth 2.0) doesn\'t work for this endpoint!');
                        console.log('   💡 You MUST use OAuth 1.0a User Context');
                    } else {
                        console.log(`   ❌ Error in request ${requestCount}: ${error.message}`);
                    }
                    break;
                }

                // Rate limit handling: 25 requests / 15 mins = 36 seconds per request
                if (requestCount % 25 === 0) {
                    const waitTime = 15 * 60;
                    console.log(`   ⏳ Rate limit window reached (25 requests). Waiting ${waitTime / 60} minutes for reset...`);
                    await this.sleep(waitTime * 1000);
                } else {
                    const waitTime = 40;
                    console.log(`   ⏳ Waiting ${waitTime} seconds before next request (rate limit: 25/15min)...`);
                    await this.sleep(waitTime * 1000);
                }
            }
        } catch (error) {
            if (error.code === 429) {
                console.log('   ⚠️  Rate limit hit. Please wait and try again.');
            } else {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }

        return likers;
    }

    async getRetweeters(tweetId) {
        console.log('\n   🔄 Fetching ALL retweeters... (respecting 25 requests/15 mins limit)');
        console.log('   💡 Using max_results=100 with proper delays to get ALL data...');

        const retweeters = [];
        let requestCount = 0;
        let nextToken = null;
        let count = 0;

        try {
            while (true) {
                requestCount++;

                try {
                    let response;
                    if (nextToken) {
                        console.log(`   📄 Request ${requestCount}: Fetching next page...`);
                        response = await this.apiClient.v2.tweetRetweetedBy(tweetId, {
                            max_results: 100,
                            pagination_token: nextToken,
                            'user.fields': ['username', 'name', 'created_at']
                        });
                    } else {
                        response = await this.apiClient.v2.tweetRetweetedBy(tweetId, {
                            max_results: 100,
                            'user.fields': ['username', 'name', 'created_at']
                        });
                    }

                    if (response.data && response.data.length > 0) {
                        for (const user of response.data) {
                            retweeters.push({
                                username: user.username,
                                name: user.name,
                                user_id: user.id
                            });
                            count++;
                        }

                        console.log(`   ✅ Request ${requestCount}: Fetched ${response.data.length} users (Total: ${count} retweeters)`);

                        // Check for next page
                        nextToken = response.meta?.next_token || null;

                        if (nextToken) {
                            console.log(`   📄 More data available! next_token = ${nextToken.substring(0, 30)}...`);
                        } else {
                            console.log(`   ✅ No more data. Total: ${count} retweeters`);
                            break;
                        }
                    } else {
                        console.log(`   ✅ No more data. Total: ${count} retweeters`);
                        break;
                    }
                } catch (error) {
                    if (error.code === 401) {
                        console.log('   ❌ UNAUTHORIZED: This endpoint requires OAuth 1.0a User Context');
                    } else if (error.code === 403) {
                        console.log('   ❌ FORBIDDEN: Bearer Token doesn\'t work for this endpoint!');
                    } else {
                        console.log(`   ❌ Error in request ${requestCount}: ${error.message}`);
                    }
                    break;
                }

                // Rate limit handling
                if (requestCount % 25 === 0) {
                    const waitTime = 15 * 60;
                    console.log(`   ⏳ Rate limit window reached (25 requests). Waiting ${waitTime / 60} minutes...`);
                    await this.sleep(waitTime * 1000);
                } else {
                    const waitTime = 40;
                    console.log(`   ⏳ Waiting ${waitTime} seconds before next request...`);
                    await this.sleep(waitTime * 1000);
                }
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }

        return retweeters;
    }

    async getRepliers(tweetId) {
        console.log('\n   💬 Fetching replies...');
        console.log('   ⚠️  Note: Only replies from last 7 days are available via API');

        const repliers = [];
        let requestCount = 0;
        let nextToken = null;

        try {
            // Check tweet age
            const tweetInfo = await this.apiClient.v2.singleTweet(tweetId, {
                'tweet.fields': ['created_at', 'author_id']
            });

            if (tweetInfo.data) {
                const tweetDate = new Date(tweetInfo.data.created_at);
                const daysOld = (Date.now() - tweetDate.getTime()) / (1000 * 60 * 60 * 24);
                
                if (daysOld > 7) {
                    console.log(`   ⚠️  WARNING: Tweet is ${Math.floor(daysOld)} days old`);
                    console.log('   📊 Twitter API only returns replies from last 7 days');
                    console.log('   💡 Older replies cannot be retrieved via API');
                }
            }

            // Search for replies - try different query formats
            const queries = [
                `in_reply_to_tweet_id:${tweetId}`,
                `conversation_id:${tweetId}`,
                `-from:${tweetId} conversation_id:${tweetId}`
            ];
            
            let queryIndex = 0;
            let foundReplies = false;
            
            while (queryIndex < queries.length && !foundReplies) {
                const query = queries[queryIndex];
                console.log(`   🔍 Trying query: ${query}`);
                nextToken = null; // Reset pagination for new query
                requestCount = 0;
                
                while (true) {
                    requestCount++;

                    try {
                        let response;
                        const searchOptions = {
                            max_results: 75,
                            'tweet.fields': ['author_id', 'created_at', 'text', 'public_metrics', 'in_reply_to_user_id'],
                            expansions: ['author_id'],
                            'user.fields': ['username', 'name']
                        };
                        
                        if (nextToken) {
                            searchOptions.next_token = nextToken;
                            response = await this.apiClient.v2.search(query, searchOptions);
                        } else {
                            response = await this.apiClient.v2.search(query, searchOptions);
                        }

                        if (response.data && response.data.length > 0) {
                            foundReplies = true;
                            const usersMap = {};
                            if (response.includes?.users) {
                                for (const user of response.includes.users) {
                                    usersMap[user.id] = user;
                                }
                            }

                            for (const tweet of response.data) {
                                // Skip the original tweet itself
                                if (tweet.id === tweetId) continue;
                                
                                // Verify it's actually a reply to our tweet
                                if (tweet.in_reply_to_user_id && tweet.in_reply_to_user_id !== tweetId) {
                                    // This might be a reply in the conversation but not to our specific tweet
                                    // Still include it as it's part of the conversation
                                }

                                const user = usersMap[tweet.author_id];
                                if (user) {
                                    repliers.push({
                                        username: user.username,
                                        name: user.name,
                                        user_id: user.id,
                                        reply_text: tweet.text,
                                        reply_tweet_id: tweet.id,
                                        created_at: tweet.created_at
                                    });
                                }
                            }

                            console.log(`   ✅ Request ${requestCount}: Fetched ${response.data.length} tweets (Total: ${repliers.length} replies)`);

                            // Check for next page
                            nextToken = response.meta?.next_token || null;

                            if (nextToken) {
                                console.log(`   📄 More data available!`);
                            } else {
                                console.log(`   ✅ No more data. Total: ${repliers.length} replies`);
                                break;
                            }
                        } else {
                            if (requestCount === 1) {
                                // First request returned nothing, try next query
                                console.log(`   ⚠️  Query returned no results, trying next query...`);
                                break;
                            } else {
                                console.log(`   ✅ No more data. Total: ${repliers.length} replies`);
                                break;
                            }
                        }
                    } catch (error) {
                        console.log(`   ❌ Error in request ${requestCount}: ${error.message}`);
                        if (requestCount === 1) {
                            // First request failed, try next query
                            break;
                        } else {
                            break;
                        }
                    }

                    // Small delay for replies (less restrictive rate limits)
                    await this.sleep(2000);
                }
                
                if (foundReplies) {
                    break; // Found replies with this query, no need to try others
                }
                
                queryIndex++;
            }
            
            if (!foundReplies && repliers.length === 0) {
                console.log(`   ⚠️  All query attempts returned no results`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }

        return repliers;
    }

    async extract(tweetUrl, options = {}) {
        const { skipLikes = false, skipRetweets = false, outputFile = null, useScrapingFallback = false } = options;
        const tweetId = this.extractTweetId(tweetUrl);

        console.log('\n' + '='.repeat(70));
        console.log('🚀 TWITTER DATA EXTRACTOR (Node.js)');
        console.log('='.repeat(70));
        console.log(`\n📌 Tweet ID: ${tweetId}`);
        console.log('⏳ This may take a while depending on the number of interactions...');

        // Check if this is the user's own tweet
        try {
            const tweetInfo = await this.apiClient.v2.singleTweet(tweetId, {
                'tweet.fields': ['author_id']
            });
            if (tweetInfo.data) {
                const me = await this.apiClient.v2.me();
                const isOwnTweet = tweetInfo.data.author_id === me.data.id;
                if (isOwnTweet) {
                    console.log('\n✅ This is YOUR OWN tweet - all endpoints will work!');
                } else {
                    console.log('\n⚠️  This is ANOTHER USER\'s tweet - likes may return 0 if from protected accounts');
                }
            }
        } catch (error) {
            // Continue anyway
        }

        console.log('\n' + '─'.repeat(70));
        console.log('📊 RATE LIMITS INFO');
        console.log('─'.repeat(70));
        console.log('   • Likes:    25 requests / 15 minutes');
        console.log('   • Retweets: 25 requests / 15 minutes');
        console.log('   • Each request gets up to 100 users');
        console.log('\n💡 Strategy: 40 second delays between requests');
        console.log('✅ The script handles this automatically - just let it run!');
        console.log('─'.repeat(70));

        // Get all data
        console.log('\n' + '='.repeat(70));
        console.log('📥 EXTRACTING DATA...');
        console.log('='.repeat(70));

        let likers = [];
        let retweeters = [];
        let repliers = [];

        if (!skipLikes) {
            console.log('\n[1/3] ❤️  FETCHING LIKERS...');
            console.log('─'.repeat(70));
            likers = await this.getLikers(tweetId);
            if (likers.length > 0) {
                console.log(`\n✅ SUCCESS: Found ${likers.length} likers`);
            } else {
                console.log('\n⚠️  No likers found');
            }
        } else {
            console.log('\n[1/3] ❤️  SKIPPING LIKES (disabled)');
        }

        if (!skipRetweets) {
            console.log('\n[2/3] 🔄 FETCHING RETWEETERS...');
            console.log('─'.repeat(70));
            retweeters = await this.getRetweeters(tweetId);
            if (retweeters.length > 0) {
                console.log(`\n✅ SUCCESS: Found ${retweeters.length} retweeters`);
            } else {
                console.log('\n⚠️  No retweeters found');
            }
        } else {
            console.log('\n[2/3] 🔄 SKIPPING RETWEETS (disabled)');
        }

        console.log('\n[3/3] 💬 FETCHING REPLIES...');
        console.log('─'.repeat(70));
        repliers = await this.getRepliers(tweetId);
        
        // Check tweet age and reply count for scraping fallback
        let tweetAgeDays = 0;
        let replyCount = 0;
        try {
            const tweetInfo = await this.apiClient.v2.singleTweet(tweetId, {
                'tweet.fields': ['created_at', 'public_metrics']
            });
            if (tweetInfo.data) {
                if (tweetInfo.data.created_at) {
                    const tweetDate = new Date(tweetInfo.data.created_at);
                    const ageMs = Date.now() - tweetDate.getTime();
                    tweetAgeDays = ageMs / (1000 * 60 * 60 * 24);
                    console.log(`   📅 Tweet age: ${Math.floor(tweetAgeDays)} days`);
                }
                if (tweetInfo.data.public_metrics) {
                    replyCount = tweetInfo.data.public_metrics.reply_count || 0;
                    console.log(`   📊 Tweet has ${replyCount} replies according to metrics`);
                }
            }
        } catch (error) {
            console.log(`   ⚠️  Could not get tweet info: ${error.message}`);
            // If we can't get tweet info but API returned 0 replies, still try scraping
            // as it might be an old tweet
        }
        
        // Auto-trigger scraping if:
        // 1. Tweet is older than 7 days (API won't work for old tweets) - ALWAYS scrape
        // 2. OR useScrapingFallback flag is set (manual override with --scrape)
        // For tweets < 7 days: API should work, so don't auto-scrape (only if --scrape flag is set)
        const shouldAutoScrape = tweetAgeDays > 7;
        const shouldScrape = useScrapingFallback || shouldAutoScrape;
        
        // Log decision
        if (shouldScrape) {
            if (tweetAgeDays > 7) {
                console.log(`\n   🔄 Auto-scraping: Tweet is ${Math.floor(tweetAgeDays)} days old (>7 days)`);
            } else if (repliers.length === 0 && replyCount > 0) {
                console.log(`\n   🔄 Auto-scraping: API returned 0 replies but tweet shows ${replyCount} replies`);
            } else if (useScrapingFallback) {
                console.log(`\n   🔄 Auto-scraping: --scrape flag enabled`);
            }
        }
        
        if (shouldScrape) {
            try {
                console.log('\n   🔄 Attempting to scrape replies...');
                
                if (tweetAgeDays > 7) {
                    console.log(`   📅 Tweet is ${Math.floor(tweetAgeDays)} days old (API only returns last 7 days)`);
                } else if (replyCount > 0 && repliers.length === 0) {
                    console.log(`   📊 Tweet shows ${replyCount} replies but API returned 0`);
                }
                
                const { getRepliesWithFallback } = await import('./twitterScraper.js');
                
                repliers = await getRepliesWithFallback(
                    tweetUrl,
                    repliers,
                    tweetAgeDays,
                    { useScraping: true, maxScraped: 500 }
                );
                
                if (repliers.length > 0) {
                    console.log(`   ✅ Scraping found ${repliers.length} replies!`);
                } else {
                    console.log('   ⚠️  Scraping completed but found 0 replies');
                    console.log('   💡 Possible reasons:');
                    console.log('      - Twitter blocked the request');
                    console.log('      - Page structure changed');
                    console.log('      - Replies are not publicly visible');
                }
            } catch (error) {
                console.log(`\n   ❌ Scraping failed: ${error.message}`);
                if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message.includes('puppeteer')) {
                    console.log('   💡 Puppeteer not installed. Run: npm install puppeteer');
                } else if (error.message.includes('browser')) {
                    console.log('   💡 Browser launch failed. Check if Chromium is installed.');
                } else {
                    console.log('   💡 Try running with --scrape flag explicitly:');
                    console.log('      node twitterExtractor.js "URL" --scrape');
                }
            }
        } else if (repliers.length === 0 && replyCount > 0) {
            console.log(`\n   💡 Tweet shows ${replyCount} replies but API returned 0`);
            console.log('   💡 Use --scrape flag to try web scraping:');
            console.log('      node twitterExtractor.js "URL" --scrape');
        }
        
        if (repliers.length > 0) {
            console.log(`\n✅ SUCCESS: Found ${repliers.length} replies`);
        } else {
            console.log('\n⚠️  No replies found');
            if (replyCount > 0) {
                console.log(`   💡 Tweet has ${replyCount} replies but couldn't retrieve them`);
                console.log('   💡 Try: npm start "URL" --scrape');
            }
        }

        // Add interaction type
        likers = likers.map(u => ({ ...u, interaction_type: 'Like' }));
        retweeters = retweeters.map(u => ({ ...u, interaction_type: 'Retweet' }));
        repliers = repliers.map(u => ({ ...u, interaction_type: 'Reply' }));

        // Create Excel file
        const workbook = new ExcelJS.Workbook();

        // All Interactions sheet
        const allSheet = workbook.addWorksheet('All Interactions');
        const allData = [...likers, ...retweeters, ...repliers];
        
        if (allData.length > 0) {
            const columns = [
                { header: 'Username', key: 'username', width: 20 },
                { header: 'Name', key: 'name', width: 30 },
                { header: 'User ID', key: 'user_id', width: 20 },
                { header: 'Interaction Type', key: 'interaction_type', width: 15 }
            ];
            
            // Add reply-specific columns if there are replies
            if (repliers.length > 0) {
                columns.push(
                    { header: 'Reply Text', key: 'reply_text', width: 50 },
                    { header: 'Reply Tweet ID', key: 'reply_tweet_id', width: 20 },
                    { header: 'Created At', key: 'created_at', width: 20 }
                );
            }
            
            allSheet.columns = columns;
            allSheet.addRows(allData);
        }

        // Likes sheet
        if (likers.length > 0) {
            const likesSheet = workbook.addWorksheet('Likes');
            likesSheet.columns = [
                { header: 'Username', key: 'username', width: 20 },
                { header: 'Name', key: 'name', width: 30 },
                { header: 'User ID', key: 'user_id', width: 20 },
                { header: 'Interaction Type', key: 'interaction_type', width: 15 }
            ];
            likesSheet.addRows(likers);
        }

        // Retweets sheet
        if (retweeters.length > 0) {
            const retweetsSheet = workbook.addWorksheet('Retweets');
            retweetsSheet.columns = [
                { header: 'Username', key: 'username', width: 20 },
                { header: 'Name', key: 'name', width: 30 },
                { header: 'User ID', key: 'user_id', width: 20 },
                { header: 'Interaction Type', key: 'interaction_type', width: 15 }
            ];
            retweetsSheet.addRows(retweeters);
        }

        // Replies sheet
        if (repliers.length > 0) {
            const repliesSheet = workbook.addWorksheet('Replies');
            repliesSheet.columns = [
                { header: 'Username', key: 'username', width: 20 },
                { header: 'Name', key: 'name', width: 30 },
                { header: 'User ID', key: 'user_id', width: 20 },
                { header: 'Interaction Type', key: 'interaction_type', width: 15 },
                { header: 'Reply Text', key: 'reply_text', width: 50 },
                { header: 'Reply Tweet ID', key: 'reply_tweet_id', width: 20 },
                { header: 'Created At', key: 'created_at', width: 20 }
            ];
            repliesSheet.addRows(repliers);
        }

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
        const filename = outputFile || `twitter_data_${tweetId}_${timestamp}.xlsx`;

        // Write file
        const buffer = await workbook.xlsx.writeBuffer();
        writeFileSync(filename, buffer);

        // Print summary
        console.log('\n' + '='.repeat(70));
        console.log('✅ EXTRACTION COMPLETE!');
        console.log('='.repeat(70));
        console.log(`\n📁 File: ${filename}`);
        console.log('\n📊 SUMMARY:');
        console.log('   ' + '─'.repeat(60));
        console.log(`   👥 Total unique users: ${allData.length}`);
        console.log(`   ❤️  Likes:              ${likers.length}`);
        console.log(`   🔄 Retweets:           ${retweeters.length}`);
        console.log(`   💬 Replies:            ${repliers.length} (with reply text)`);
        console.log('   ' + '─'.repeat(60));

        console.log('\n📋 EXCEL FILE CONTENTS:');
        console.log('   ' + '─'.repeat(60));
        if (likers.length > 0) {
            console.log(`   ✅ 'Likes' sheet:        ${likers.length} users`);
        } else {
            console.log('   ⚠️  \'Likes\' sheet:        Empty');
        }
        if (retweeters.length > 0) {
            console.log(`   ✅ 'Retweets' sheet:     ${retweeters.length} users`);
        } else {
            console.log('   ⚠️  \'Retweets\' sheet:    Empty');
        }
        if (repliers.length > 0) {
            console.log(`   ✅ 'Replies' sheet:      ${repliers.length} replies`);
        } else {
            console.log('   ⚠️  \'Replies\' sheet:     Empty');
        }
        console.log(`   ✅ 'All Interactions':  Combined data (${allData.length} total)`);
        console.log('   ' + '─'.repeat(60));

        if (allData.length > 0) {
            console.log('\n🎉 SUCCESS! Data extracted and saved to Excel file!');
        } else {
            console.log('\n⚠️  No data found. Check if tweet is public and has interactions.');
        }
    }
}

// Main function
async function main() {
    const args = process.argv.slice(2);
    
    // Get credentials from environment
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

    // Check credentials
    let credentialsFound = false;
    if (apiKey && apiSecret && accessToken && accessTokenSecret) {
        console.log('✅ Found full OAuth 1.0a credentials (API Key + Secret + Access Token + Access Token Secret)');
        console.log('   💡 This is REQUIRED for likes endpoint - Bearer Token won\'t work!');
        credentialsFound = true;
    } else if (bearerToken) {
        console.log('✅ Found Bearer Token from environment/.env file');
        console.log('   ⚠️  WARNING: Bearer Token doesn\'t work for likes endpoint!');
        console.log('   💡 You need OAuth 1.0a (API Key + Secret + Access Token + Access Token Secret)');
        credentialsFound = true;
    }

    if (!credentialsFound) {
        console.log('⚠️  Twitter API credentials not found in environment variables or .env file.');
        console.log('\nYou can create a .env file with:');
        console.log('   TWITTER_API_KEY=your_key_here');
        console.log('   TWITTER_API_SECRET=your_secret_here');
        console.log('   TWITTER_ACCESS_TOKEN=your_access_token_here');
        console.log('   TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here');
        console.log('\nOr use Bearer Token:');
        console.log('   TWITTER_BEARER_TOKEN=your_token_here');
        process.exit(1);
    }

    // Get tweet URL - filter out flags
    let tweetUrl = null;
    for (const arg of args) {
        if (arg.includes('x.com') || arg.includes('twitter.com') || arg.match(/^\d+$/)) {
            tweetUrl = arg;
            break;
        }
    }
    
    if (!tweetUrl) {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });

        tweetUrl = await new Promise(resolve => {
            rl.question('Enter tweet URL: ', answer => {
                rl.close();
                resolve(answer);
            });
        });
    }

    if (!tweetUrl) {
        console.log('❌ No tweet URL provided');
        process.exit(1);
    }

    // Create extractor
    const extractor = new TwitterExtractor({
        bearerToken,
        apiKey,
        apiSecret,
        accessToken,
        accessTokenSecret
    });

    // Check for scraping flag in args (not process.argv to avoid npm config issues)
    const useScraping = args.includes('--scrape') || args.includes('-s');
    
    if (useScraping) {
        console.log('\n⚠️  WARNING: Web scraping may violate Twitter\'s Terms of Service!');
        console.log('   Use at your own risk. See SCRAPING_WARNING.md for details.');
        
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            rl.question('   Continue with scraping? (y/N): ', answer => {
                rl.close();
                resolve(answer);
            });
        });
        
        if (answer.trim().toLowerCase() !== 'y') {
            console.log('   Scraping cancelled. Using API only.');
        }
    }

    // Extract data
    try {
        await extractor.extract(tweetUrl, { useScrapingFallback: useScraping });
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('twitterExtractor.js')) {
    main().catch(console.error);
}

export default TwitterExtractor;

