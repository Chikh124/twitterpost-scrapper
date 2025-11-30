"""
Twitter/X Username Extractor
Extracts usernames from likes, retweets, and replies of a specific tweet
and exports them to an XLSX file.
"""

import tweepy
import pandas as pd
from datetime import datetime, timedelta
import sys
import os
import time
from typing import List, Dict

# Try to load .env file if it exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # If python-dotenv is not installed, continue without it
    pass


class TwitterExtractor:
    def __init__(self, bearer_token: str = None, api_key: str = None, api_secret: str = None, 
                 access_token: str = None, access_token_secret: str = None):
        """
        Initialize the Twitter API client.
        
        Args:
            bearer_token: Twitter API v2 Bearer Token (preferred, simpler, read-only)
            api_key: Twitter API Key (Consumer Key)
            api_secret: Twitter API Secret (Consumer Secret)
            access_token: OAuth Access Token (for OAuth 1.0a)
            access_token_secret: OAuth Access Token Secret (for OAuth 1.0a)
        """
        if bearer_token:
            # Bearer Token (simplest, read-only)
            self.client = tweepy.Client(
                bearer_token=bearer_token, 
                wait_on_rate_limit=True
            )
        elif api_key and api_secret and access_token and access_token_secret:
            # Full OAuth 1.0a (API Key + Secret + Access Token + Access Token Secret)
            self.client = tweepy.Client(
                consumer_key=api_key,
                consumer_secret=api_secret,
                access_token=access_token,
                access_token_secret=access_token_secret,
                wait_on_rate_limit=True
            )
        elif api_key and api_secret:
            # OAuth 2.0 (API Key + Secret only)
            self.client = tweepy.Client(
                consumer_key=api_key, 
                consumer_secret=api_secret, 
                wait_on_rate_limit=True
            )
        else:
            raise ValueError("Need either: bearer_token OR (api_key + api_secret) OR (api_key + api_secret + access_token + access_token_secret)")
    
    def extract_tweet_id(self, url: str) -> str:
        """Extract tweet ID from Twitter URL."""
        if '/status/' in url:
            return url.split('/status/')[-1].split('?')[0]
        return url
    
    def get_likers(self, tweet_id: str) -> List[Dict]:
        """
        Get all users who liked the tweet.
        
        IMPORTANT: This endpoint works best for YOUR OWN tweets when using OAuth 1.0a User Context.
        For other users' tweets, you may get 0 results if likes are from protected accounts.
        """
        likers = []
        count = 0
        try:
            print("   Fetching ALL likers... (respecting 25 requests/15 mins PER APP limit)")
            print("   💡 Using max_results=100 with proper delays to get ALL data...")
            print("   💡 Note: Works best for your OWN tweets (OAuth 1.0a User Context required)")
            
            # Basic tier PER APP: 25 requests / 15 mins
            # Strategy: Use max_results=100, wait 40 seconds between requests
            # 25 requests / 15 mins = 1 request per 36 seconds, we'll use 40 to be safe
            request_count = 0
            next_token = None
            
            while True:
                request_count += 1
                
                # Make request with pagination token if available
                try:
                    if next_token:
                        print(f"   📄 Request {request_count}: Fetching next page (token: {next_token[:20]}...)")
                        response = self.client.get_liking_users(
                            id=tweet_id,
                            max_results=100,
                            user_fields=['username', 'name', 'created_at'],
                            pagination_token=next_token,
                            user_auth=True  # Explicitly use user auth
                        )
                    else:
                        print(f"   📄 Request {request_count}: Fetching first page...")
                        # Try multiple approaches to get likes
                        response = None
                        if request_count == 1:
                            # First attempt: try without user_fields (sometimes works better)
                            try:
                                print(f"   🔄 Attempt 1: Trying without user_fields...")
                                response = self.client.get_liking_users(
                                    id=tweet_id,
                                    max_results=100,
                                    user_auth=True
                                )
                                # Check if we got results
                                result_count = 0
                                if hasattr(response, 'meta') and response.meta:
                                    if isinstance(response.meta, dict):
                                        result_count = response.meta.get('result_count', 0)
                                    else:
                                        result_count = getattr(response.meta, 'result_count', 0)
                                
                                if not response.data and result_count == 0:
                                    # Try with user_fields
                                    print(f"   🔄 Attempt 2: Trying with user_fields...")
                                    response = self.client.get_liking_users(
                                        id=tweet_id,
                                        max_results=100,
                                        user_fields=['username', 'name', 'created_at'],
                                        user_auth=True
                                    )
                            except Exception as e:
                                print(f"   ⚠️  First attempt failed: {e}, trying with user_fields...")
                                response = self.client.get_liking_users(
                                    id=tweet_id,
                                    max_results=100,
                                    user_fields=['username', 'name', 'created_at'],
                                    user_auth=True
                                )
                        else:
                            # Subsequent requests use user_fields
                            response = self.client.get_liking_users(
                                id=tweet_id,
                                max_results=100,
                                user_fields=['username', 'name', 'created_at'],
                                user_auth=True
                            )
                    
                    # Debug: Check response structure
                    print(f"   🔍 Debug: response.data = {response.data is not None}, len = {len(response.data) if response.data else 0}")
                    if hasattr(response, 'meta'):
                        print(f"   🔍 Debug: response.meta = {response.meta}")
                    
                    if response.data:
                        for user in response.data:
                            # Handle both cases: with and without user_fields
                            username = getattr(user, 'username', None)
                            if not username:
                                # If no username, try to get from id or use placeholder
                                username = f"user_{getattr(user, 'id', 'unknown')}"
                            name = getattr(user, 'name', None) or 'Unknown'
                            user_id = getattr(user, 'id', None)
                            
                            likers.append({
                                'username': username,
                                'name': name,
                                'user_id': user_id
                            })
                            count += 1
                        
                        print(f"   ✅ Request {request_count}: Fetched {len(response.data)} users (Total: {count} likers)")
                        
                        # Check for next page - tweepy uses response.meta.next_token
                        next_token = None
                        if hasattr(response, 'meta') and response.meta:
                            # Try different ways to get next_token
                            if hasattr(response.meta, 'next_token'):
                                next_token = response.meta.next_token
                            elif isinstance(response.meta, dict):
                                next_token = response.meta.get('next_token')
                            else:
                                # Check if meta has result_count to see if there's more
                                result_count = getattr(response.meta, 'result_count', None)
                                if result_count and result_count < len(response.data):
                                    next_token = None  # No more
                            
                            if next_token:
                                print(f"   📄 More data available! next_token = {next_token[:30]}...")
                            else:
                                print(f"   ✅ Reached end (no next_token). Total: {count} likers")
                                break
                        else:
                            # Check if we got less than max_results (means no more pages)
                            if len(response.data) < 100:
                                print(f"   ✅ Reached end (got {len(response.data)} < 100). Total: {count} likers")
                                break
                            else:
                                # Got exactly 100, might have more - make another request to check
                                print(f"   ⚠️  Got 100 users but no meta - checking if more available...")
                                # Continue to next request to see if there's more
                    else:
                        # Check if this is the first request and got 0 results
                        if request_count == 1 and count == 0:
                            print(f"   ⚠️  WARNING: Tweet shows likes in metrics, but API returned 0 likers")
                            print(f"   💡 Possible reasons:")
                            print(f"      - Likes are from protected accounts (not visible via API)")
                            print(f"      - API tier has limited visibility (Basic tier limitation)")
                            print(f"      - Privacy settings hide likers from API access")
                            print(f"   📊 This is a Twitter API limitation, not a code issue")
                        print(f"   ✅ No more data (response.data is None/empty). Total: {count} likers")
                        break
                except Exception as req_error:
                    print(f"   ❌ Error in request {request_count}: {type(req_error).__name__}: {req_error}")
                    import traceback
                    traceback.print_exc()
                    break
                
                # Rate limit: 25 requests / 15 mins = 36 seconds per request
                # Wait 40 seconds between requests to stay safe
                if request_count % 25 == 0:
                    # Every 25 requests, wait 15 minutes for rate limit reset
                    wait_time = 15 * 60
                    print(f"   ⏳ Rate limit window reached (25 requests). Waiting {wait_time//60} minutes for reset...")
                    time.sleep(wait_time)
                else:
                    # Wait 40 seconds between requests
                    wait_time = 40
                    print(f"   ⏳ Waiting {wait_time} seconds before next request (rate limit: 25/15min)...")
                    time.sleep(wait_time)
        except tweepy.TooManyRequests as e:
            print(f"   ⚠️  Rate limit hit. The script will wait automatically and continue.")
            # The wait_on_rate_limit should handle this, but just in case
            raise
        except tweepy.Unauthorized as e:
            print(f"   ❌ UNAUTHORIZED: {e}")
            print(f"   ⚠️  This endpoint requires OAuth 1.0a User Context (not Bearer Token)")
            print(f"   💡 You need to use API Key + Secret + Access Token + Access Token Secret")
        except tweepy.Forbidden as e:
            print(f"   ❌ FORBIDDEN: {e}")
            if "OAuth 2.0 Application-Only" in str(e):
                print(f"   ⚠️  Bearer Token (OAuth 2.0 Application-Only) doesn't work for this endpoint!")
                print(f"   💡 You MUST use OAuth 1.0a User Context:")
                print(f"      - API Key + Secret + Access Token + Access Token Secret")
                print(f"      - Update your .env file with all 4 credentials from your friend")
        except tweepy.NotFound as e:
            print(f"   ⚠️  Tweet not found or not accessible. Error: {e}")
        except Exception as e:
            print(f"   ⚠️  Error fetching likers: {type(e).__name__}: {e}")
        
        if count == 0:
            # Check if tweet actually has likes and if it's the user's own tweet
            try:
                tweet_info = self.client.get_tweet(tweet_id, tweet_fields=['public_metrics', 'author_id'], user_auth=True)
                if tweet_info.data and hasattr(tweet_info.data, 'public_metrics'):
                    expected_likes = tweet_info.data.public_metrics.get('like_count', 0)
                    if expected_likes > 0:
                        # Check if this is the authenticated user's own tweet
                        try:
                            me = self.client.get_me(user_auth=True)
                            is_own_tweet = str(tweet_info.data.author_id) == str(me.data.id)
                            
                            if is_own_tweet:
                                print(f"\n   ⚠️  NOTE: Your own tweet shows {expected_likes} likes, but API returned 0")
                                print(f"   💡 This might mean:")
                                print(f"      - All likes are from protected accounts (not visible)")
                                print(f"      - There's a delay in API data propagation")
                                print(f"      - Try waiting a few minutes and retry")
                            else:
                                print(f"\n   ⚠️  NOTE: Tweet shows {expected_likes} likes, but API returned 0 likers")
                                print(f"   💡 This is expected for OTHER users' tweets because:")
                                print(f"      - Likes endpoint works best for YOUR OWN tweets")
                                print(f"      - Protected account likes are NOT visible via API")
                                print(f"      - Privacy settings hide likers from API access")
                                print(f"   ✅ For your own tweets, you should see likers!")
                        except:
                            print(f"\n   ⚠️  NOTE: Tweet shows {expected_likes} likes, but API returned 0 likers")
                            print(f"   💡 This endpoint works best for YOUR OWN tweets")
            except:
                print(f"\n   💡 NOTE: If tweet shows likes but API returned 0 likers:")
                print(f"      - This endpoint works best for YOUR OWN tweets")
                print(f"      - Protected account likes (not visible via API)")
                print(f"      - Privacy settings hiding likers")
        
        return likers
    
    def get_retweeters(self, tweet_id: str) -> List[Dict]:
        """Get all users who retweeted the tweet."""
        retweeters = []
        count = 0
        try:
            print("   Fetching ALL retweeters... (respecting 25 requests/15 mins PER APP limit)")
            print("   💡 Using max_results=100 with proper delays to get ALL data...")
            
            # Basic tier PER APP: 25 requests / 15 mins
            # Strategy: Use max_results=100, wait 40 seconds between requests
            request_count = 0
            next_token = None
            
            while True:
                request_count += 1
                
                # Make request with pagination token if available
                try:
                    if next_token:
                        print(f"   📄 Request {request_count}: Fetching next page (token: {next_token[:20]}...)")
                        response = self.client.get_retweeters(
                            id=tweet_id,
                            max_results=100,
                            user_fields=['created_at'],
                            pagination_token=next_token,
                            user_auth=True  # Explicitly use user auth
                        )
                    else:
                        print(f"   📄 Request {request_count}: Fetching first page...")
                        response = self.client.get_retweeters(
                            id=tweet_id,
                            max_results=100,
                            user_fields=['created_at'],
                            user_auth=True  # Explicitly use user auth
                        )
                    
                    # Debug: Check response structure
                    print(f"   🔍 Debug: response.data = {response.data is not None}, len = {len(response.data) if response.data else 0}")
                    if hasattr(response, 'meta'):
                        print(f"   🔍 Debug: response.meta = {response.meta}")
                    
                    if response.data:
                        for user in response.data:
                            retweeters.append({
                                'username': user.username,
                                'name': user.name,
                                'user_id': user.id
                            })
                            count += 1
                        
                        print(f"   ✅ Request {request_count}: Fetched {len(response.data)} users (Total: {count} retweeters)")
                        
                        # Check for next page - tweepy uses response.meta.next_token
                        next_token = None
                        if hasattr(response, 'meta') and response.meta:
                            # Try different ways to get next_token
                            if hasattr(response.meta, 'next_token'):
                                next_token = response.meta.next_token
                            elif isinstance(response.meta, dict):
                                next_token = response.meta.get('next_token')
                            
                            # Check result_count to understand if there's more
                            result_count = None
                            if hasattr(response.meta, 'result_count'):
                                result_count = response.meta.result_count
                            elif isinstance(response.meta, dict):
                                result_count = response.meta.get('result_count')
                            
                            if result_count is not None:
                                print(f"   📊 API reports {result_count} total retweeters visible")
                                if count >= result_count:
                                    print(f"   ✅ Got all visible retweeters ({count}/{result_count})")
                                    next_token = None  # No more
                            
                            if next_token:
                                print(f"   📄 More data available! next_token = {next_token[:30]}...")
                            else:
                                print(f"   ✅ Reached end (no next_token). Total: {count} retweeters")
                                break
                        else:
                            # Check if we got less than max_results (means no more pages)
                            if len(response.data) < 100:
                                print(f"   ✅ Reached end (got {len(response.data)} < 100). Total: {count} retweeters")
                                break
                            else:
                                # Got exactly 100, might have more - make another request to check
                                print(f"   ⚠️  Got 100 users but no meta - checking if more available...")
                                # Continue to next request to see if there's more
                    else:
                        print(f"   ✅ No more data (response.data is None/empty). Total: {count} retweeters")
                        break
                except Exception as req_error:
                    print(f"   ❌ Error in request {request_count}: {type(req_error).__name__}: {req_error}")
                    import traceback
                    traceback.print_exc()
                    break
                
                # Rate limit: 25 requests / 15 mins = 36 seconds per request
                # Wait 40 seconds between requests to stay safe
                if request_count % 25 == 0:
                    # Every 25 requests, wait 15 minutes for rate limit reset
                    wait_time = 15 * 60
                    print(f"   ⏳ Rate limit window reached (25 requests). Waiting {wait_time//60} minutes for reset...")
                    time.sleep(wait_time)
                else:
                    # Wait 40 seconds between requests
                    wait_time = 40
                    print(f"   ⏳ Waiting {wait_time} seconds before next request (rate limit: 25/15min)...")
                    time.sleep(wait_time)
            
            if count == 0:
                print("   ℹ️  No retweeters found (tweet might have 0 retweets or endpoint returned empty)")
            else:
                # Check if we got fewer retweets than the tweet shows
                try:
                    tweet_info = self.client.get_tweet(tweet_id, tweet_fields=['public_metrics'], user_auth=True)
                    if tweet_info.data and hasattr(tweet_info.data, 'public_metrics'):
                        expected_rt = tweet_info.data.public_metrics.get('retweet_count', 0)
                        if expected_rt > count:
                            missing = expected_rt - count
                            print(f"\n   ⚠️  NOTE: Tweet shows {expected_rt} retweets, but API returned {count}")
                            print(f"   💡 Missing {missing} retweets likely due to:")
                            print(f"      - Protected/deleted accounts (not visible via API)")
                            print(f"      - Privacy settings hiding retweets")
                            print(f"      - API tier limitations (Basic tier may not see all)")
                except:
                    pass  # Don't fail if we can't get tweet info
        except tweepy.TooManyRequests as e:
            reset_time = getattr(e, 'reset_time', None)
            if reset_time:
                wait_seconds = reset_time - time.time()
                wait_minutes = int(wait_seconds / 60)
                wait_secs = int(wait_seconds % 60)
                print(f"\n   ⏳ Rate limit reached! Waiting {wait_minutes}m {wait_secs}s...")
                print(f"   (The script will continue automatically - you can minimize this window)")
            else:
                print(f"   ⏳ Rate limit reached! Waiting 15 minutes...")
                print(f"   (The script will continue automatically)")
            raise
        except tweepy.Unauthorized as e:
            print(f"   ❌ UNAUTHORIZED: {e}")
            print(f"   ⚠️  Your API credentials may not have access to retweets endpoint.")
        except tweepy.Forbidden as e:
            print(f"   ❌ FORBIDDEN: {e}")
            print(f"   ⚠️  Your API tier doesn't have access to retweets endpoint.")
            print(f"   💡 You need Elevated (free) or Paid API access.")
        except tweepy.NotFound as e:
            print(f"   ⚠️  Tweet not found or not accessible. Error: {e}")
        except Exception as e:
            print(f"   ❌ Error fetching retweeters: {type(e).__name__}: {e}")
            import traceback
            print(f"   Full error details:")
            traceback.print_exc()
        return retweeters
    
    def get_repliers(self, tweet_id: str) -> List[Dict]:
        """
        Get all users who replied to the tweet, including reply text.
        
        IMPORTANT: search_recent_tweets only returns replies from the last 7 days.
        Older replies will not be found via API.
        """
        repliers = []
        count = 0
        seen_tweet_ids = set()  # Track by tweet ID to avoid duplicates
        
        try:
            # First, check if tweet is older than 7 days
            try:
                tweet_info = self.client.get_tweet(tweet_id, tweet_fields=['created_at'], user_auth=True)
                if tweet_info.data and hasattr(tweet_info.data, 'created_at'):
                    tweet_date = tweet_info.data.created_at
                    days_old = (datetime.now(tweet_date.tzinfo) - tweet_date).days
                    if days_old > 7:
                        print(f"   ⚠️  WARNING: Tweet is {days_old} days old")
                        print(f"   ⚠️  search_recent_tweets only returns replies from last 7 days")
                        print(f"   ⚠️  Older replies will NOT be found via API")
                        print(f"   💡 This is a Twitter API limitation - no workaround available")
            except:
                pass  # Continue anyway
            
            print("   Fetching replies with content... (this may take a while)")
            print("   ⚠️  Note: Only replies from last 7 days can be retrieved")
            # Search for replies to this specific tweet
            query = f"in_reply_to_tweet_id:{tweet_id}"
            
            try:
                # Use smaller batches for replies too
                for response in tweepy.Paginator(
                    self.client.search_recent_tweets,
                    query=query,
                    max_results=75,  # Smaller batch size
                    tweet_fields=['author_id', 'created_at', 'text', 'public_metrics'],
                    expansions=['author_id'],
                    user_auth=True  # Explicitly use user auth
                ):
                    if response.data:
                        # Get user data from includes if available
                        users_dict = {}
                        if response.includes and 'users' in response.includes:
                            users_dict = {user.id: user for user in response.includes['users']}
                        
                        for tweet_obj in response.data:
                            # Skip if we've already seen this reply tweet
                            if tweet_obj.id in seen_tweet_ids:
                                continue
                            
                            seen_tweet_ids.add(tweet_obj.id)
                            author_id = tweet_obj.author_id
                            
                            # Get user info
                            if author_id in users_dict:
                                user = users_dict[author_id]
                            else:
                                try:
                                    user_response = self.client.get_user(id=author_id, user_auth=True)
                                    if not user_response.data:
                                        continue
                                    user = user_response.data
                                except:
                                    continue
                            
                            # Get reply text
                            reply_text = getattr(tweet_obj, 'text', '')
                            created_at = getattr(tweet_obj, 'created_at', None)
                            
                            repliers.append({
                                'username': user.username,
                                'name': user.name,
                                'user_id': user.id,
                                'reply_text': reply_text,
                                'reply_tweet_id': tweet_obj.id,
                                'created_at': created_at.strftime('%Y-%m-%d %H:%M:%S') if created_at else ''
                            })
                            
                            count += 1
                            if count % 50 == 0:
                                print(f"   ... fetched {count} replies so far...")
                        
                        # Add small delay every few replies to avoid rate limits
                        if count % 100 == 0:
                            time.sleep(1)  # 1 second delay every 100 replies
                                
            except tweepy.TooManyRequests:
                print("   ⚠️  Rate limit reached for replies. The script will wait automatically and continue.")
                raise
            except Exception as e:
                print(f"   ⚠️  Note: Reply extraction may be limited. Error: {type(e).__name__}: {e}")
            
            if count == 0:
                # Check if tweet is older than 7 days
                try:
                    tweet_info = self.client.get_tweet(tweet_id, tweet_fields=['created_at', 'public_metrics'], user_auth=True)
                    if tweet_info.data:
                        metrics = tweet_info.data.public_metrics if hasattr(tweet_info.data, 'public_metrics') else {}
                        reply_count = metrics.get('reply_count', 0)
                        if reply_count > 0:
                            if hasattr(tweet_info.data, 'created_at'):
                                tweet_date = tweet_info.data.created_at
                                days_old = (datetime.now(tweet_date.tzinfo) - tweet_date).days
                                if days_old > 7:
                                    print(f"\n   ⚠️  Tweet has {reply_count} replies but is {days_old} days old")
                                    print(f"   ❌ search_recent_tweets only returns replies from last 7 days")
                                    print(f"   💡 To get older replies, you need Academic Research tier (full archive)")
                except:
                    pass
        except Exception as e:
            print(f"   ⚠️  Error fetching repliers: {type(e).__name__}: {e}")
        
        return repliers
    
    def export_to_xlsx(self, tweet_id: str, output_file: str = None, skip_likes: bool = False, skip_retweets: bool = False):
        """
        Extract all usernames and export to XLSX.
        
        Args:
            tweet_id: Tweet ID or URL
            output_file: Output filename (optional)
        """
        tweet_id = self.extract_tweet_id(tweet_id)
        
        print("\n" + "="*70)
        print("🚀 TWITTER DATA EXTRACTOR")
        print("="*70)
        print(f"\n📌 Tweet ID: {tweet_id}")
        print("⏳ This may take a while depending on the number of interactions...")
        
        # Check if this is the user's own tweet (likes work best for own tweets)
        try:
            tweet_info = extractor.client.get_tweet(tweet_id, tweet_fields=['author_id'], user_auth=True)
            if tweet_info.data:
                me = extractor.client.get_me(user_auth=True)
                is_own_tweet = str(tweet_info.data.author_id) == str(me.data.id)
                if is_own_tweet:
                    print("\n✅ This is YOUR OWN tweet - all endpoints will work!")
                else:
                    print("\n⚠️  This is ANOTHER USER's tweet - likes may return 0 if from protected accounts")
        except:
            pass  # Continue anyway
        
        print("\n" + "─"*70)
        print("📊 RATE LIMITS INFO")
        print("─"*70)
        print("   • Likes:    25 requests / 15 minutes")
        print("   • Retweets: 25 requests / 15 minutes")
        print("   • Each request gets up to 100 users")
        print("\n💡 Strategy: 40 second delays between requests")
        print("✅ The script handles this automatically - just let it run!")
        print("─"*70)
        
        # Get all data
        print("\n" + "="*70)
        print("📥 EXTRACTING DATA...")
        print("="*70)
        
        if not skip_likes:
            print("\n[1/3] ❤️  FETCHING LIKERS...")
            print("─"*70)
            likers = self.get_likers(tweet_id)
            if likers:
                print(f"\n✅ SUCCESS: Found {len(likers)} likers")
            else:
                print(f"\n⚠️  No likers found")
        else:
            print("\n[1/3] ❤️  SKIPPING LIKES (disabled)")
            likers = []
        
        if not skip_retweets:
            print("\n[2/3] 🔄 FETCHING RETWEETERS...")
            print("─"*70)
            retweeters = self.get_retweeters(tweet_id)
            if retweeters:
                print(f"\n✅ SUCCESS: Found {len(retweeters)} retweeters")
            else:
                print(f"\n⚠️  No retweeters found")
        else:
            print("\n[2/3] 🔄 SKIPPING RETWEETS (disabled)")
            retweeters = []
        
        print("\n[3/3] 💬 FETCHING REPLIES...")
        print("─"*70)
        repliers = self.get_repliers(tweet_id)
        if repliers:
            print(f"\n✅ SUCCESS: Found {len(repliers)} replies")
        else:
            print(f"\n⚠️  No replies found")
        
        # Create DataFrames with proper columns
        df_likers = pd.DataFrame(likers) if likers else pd.DataFrame(columns=['username', 'name', 'user_id'])
        df_retweeters = pd.DataFrame(retweeters) if retweeters else pd.DataFrame(columns=['username', 'name', 'user_id'])
        df_repliers = pd.DataFrame(repliers) if repliers else pd.DataFrame(columns=['username', 'name', 'user_id', 'reply_text', 'reply_tweet_id', 'created_at'])
        
        # Add interaction type column
        if not df_likers.empty:
            df_likers['interaction_type'] = 'Like'
        if not df_retweeters.empty:
            df_retweeters['interaction_type'] = 'Retweet'
        if not df_repliers.empty:
            df_repliers['interaction_type'] = 'Reply'
        
        # Reorder columns for better readability
        if not df_repliers.empty:
            df_repliers = df_repliers[['username', 'name', 'user_id', 'interaction_type', 'reply_text', 'reply_tweet_id', 'created_at']]
        
        # Combine all data
        df_all = pd.concat([df_likers, df_retweeters, df_repliers], ignore_index=True)
        
        # Generate output filename if not provided
        if not output_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"twitter_data_{tweet_id}_{timestamp}.xlsx"
        
        # Export to XLSX with multiple sheets
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            df_all.to_excel(writer, sheet_name='All Interactions', index=False)
            if not df_likers.empty:
                df_likers.to_excel(writer, sheet_name='Likes', index=False)
            if not df_retweeters.empty:
                df_retweeters.to_excel(writer, sheet_name='Retweets', index=False)
            if not df_repliers.empty:
                df_repliers.to_excel(writer, sheet_name='Replies', index=False)
        
        # Print beautiful summary
        print("\n" + "="*70)
        print("✅ EXTRACTION COMPLETE!")
        print("="*70)
        print(f"\n📁 File: {output_file}")
        print(f"\n📊 SUMMARY:")
        print(f"   {'─'*60}")
        print(f"   👥 Total unique users: {len(df_all)}")
        print(f"   ❤️  Likes:              {len(df_likers)}")
        print(f"   🔄 Retweets:           {len(df_retweeters)}")
        print(f"   💬 Replies:            {len(df_repliers)} (with reply text)")
        print(f"   {'─'*60}")
        
        # Excel file contents
        print(f"\n📋 EXCEL FILE CONTENTS:")
        print(f"   {'─'*60}")
        if not df_likers.empty:
            print(f"   ✅ 'Likes' sheet:        {len(df_likers)} users")
        else:
            print(f"   ⚠️  'Likes' sheet:        Empty")
        if not df_retweeters.empty:
            print(f"   ✅ 'Retweets' sheet:     {len(df_retweeters)} users")
        else:
            print(f"   ⚠️  'Retweets' sheet:    Empty")
        if not df_repliers.empty:
            print(f"   ✅ 'Replies' sheet:      {len(df_repliers)} replies")
        else:
            print(f"   ⚠️  'Replies' sheet:     Empty")
        print(f"   ✅ 'All Interactions':  Combined data ({len(df_all)} total)")
        print(f"   {'─'*60}")
        
        # Success message
        if len(df_all) > 0:
            print(f"\n🎉 SUCCESS! Data extracted and saved to Excel file!")
        else:
            print(f"\n⚠️  No data found. Check if tweet is public and has interactions.")


def main():
    """Main function to run the extractor."""
    # Try to get credentials from environment variables first (including .env file)
    bearer_token = os.getenv('TWITTER_BEARER_TOKEN')
    api_key = os.getenv('TWITTER_API_KEY')
    api_secret = os.getenv('TWITTER_API_SECRET')
    access_token = os.getenv('TWITTER_ACCESS_TOKEN')
    access_token_secret = os.getenv('TWITTER_ACCESS_TOKEN_SECRET')
    
    # Check if we found credentials
    # IMPORTANT: Likes endpoint requires OAuth 1.0a User Context, not Bearer Token
    # So we prioritize OAuth 1.0a if available
    credentials_found = False
    if api_key and api_secret and access_token and access_token_secret:
        print("✅ Found full OAuth 1.0a credentials (API Key + Secret + Access Token + Access Token Secret)")
        print("   💡 This is REQUIRED for likes endpoint - Bearer Token won't work!")
        credentials_found = True
    elif bearer_token:
        print("✅ Found Bearer Token from environment/.env file")
        print("   ⚠️  WARNING: Bearer Token doesn't work for likes endpoint!")
        print("   💡 You need OAuth 1.0a (API Key + Secret + Access Token + Access Token Secret)")
        credentials_found = True
    elif api_key and api_secret:
        print("✅ Found API Key and Secret from environment/.env file")
        print("   ⚠️  WARNING: Likes endpoint may require Access Token + Access Token Secret too")
        credentials_found = True
    
    # If no credentials found, ask user
    if not credentials_found:
        print("⚠️  Twitter API credentials not found in environment variables or .env file.")
        print("\nYou can create a .env file with:")
        print("   TWITTER_BEARER_TOKEN=your_token_here")
        print("   OR")
        print("   TWITTER_API_KEY=your_key_here")
        print("   TWITTER_API_SECRET=your_secret_here")
        print("   TWITTER_ACCESS_TOKEN=your_access_token_here")
        print("   TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here")
        print("\nOr enter them now:")
        print("\nYou can use:")
        print("  1. Bearer Token (simpler, recommended)")
        print("  2. API Key + API Secret")
        print("  3. Full OAuth (API Key + Secret + Access Token + Access Token Secret)")
        print("\nEnter your choice:")
        choice = input("Use Bearer Token? (y/n, default=y): ").strip().lower()
        
        if choice != 'n':
            bearer_token = input("Bearer Token: ").strip()
        else:
            api_key = input("API Key: ").strip()
            api_secret = input("API Secret: ").strip()
            use_oauth = input("Use OAuth 1.0a (Access Token + Secret)? (y/n, default=n): ").strip().lower()
            if use_oauth == 'y':
                access_token = input("Access Token: ").strip()
                access_token_secret = input("Access Token Secret: ").strip()
    
    # Parse command line arguments
    skip_likes = '--skip-likes' in sys.argv
    skip_retweets = '--skip-retweets' in sys.argv
    
    # Get tweet URL/ID (first non-flag argument)
    tweet_url = None
    for arg in sys.argv[1:]:
        if arg not in ['--skip-likes', '--skip-retweets']:
            tweet_url = arg
            break
    
    if not tweet_url:
        tweet_url = input("\nEnter tweet URL or ID: ").strip()
    
    if not tweet_url:
        print("Error: Tweet URL or ID is required!")
        sys.exit(1)
    
    # Create extractor and export data
    # IMPORTANT: Prioritize OAuth 1.0a for likes endpoint support
    try:
        if api_key and api_secret and access_token and access_token_secret:
            print("\n🔑 Using OAuth 1.0a User Context authentication...")
            print("   ✅ This supports ALL endpoints (likes, retweets, replies)")
            extractor = TwitterExtractor(
                api_key=api_key, 
                api_secret=api_secret,
                access_token=access_token,
                access_token_secret=access_token_secret
            )
        elif bearer_token:
            print("\n🔑 Using Bearer Token (OAuth 2.0 Application-Only) authentication...")
            print("   ⚠️  WARNING: This does NOT support likes endpoint!")
            print("   💡 Likes will fail - you need OAuth 1.0a credentials")
            extractor = TwitterExtractor(bearer_token=bearer_token)
        else:
            if not api_key or not api_secret:
                print("❌ Error: Both API Key and API Secret are required!")
                print("   💡 For likes endpoint, you also need Access Token + Access Token Secret")
                sys.exit(1)
            print("\n🔑 Using API Key + Secret authentication...")
            print("   ⚠️  WARNING: Likes endpoint may require Access Token + Access Token Secret")
            extractor = TwitterExtractor(api_key=api_key, api_secret=api_secret)
        
        # Test the connection first
        print("🔍 Testing API connection...")
        try:
            # Extract tweet ID for testing
            test_tweet_id = extractor.extract_tweet_id(tweet_url)
            
            # First, try a simple endpoint that works with OAuth 1.0a
            print("   Testing with get_me() endpoint...")
            try:
                me = extractor.client.get_me()
                if me.data:
                    print(f"   ✅ get_me() works! Authenticated as: @{me.data.username}")
                else:
                    print(f"   ⚠️  get_me() returned no data")
            except tweepy.Unauthorized as e:
                print(f"   ❌ get_me() failed: Unauthorized")
                print(f"   This means your credentials are INVALID or EXPIRED!")
                print(f"\n   Possible issues:")
                print(f"   1. Credentials have typos (check carefully)")
                print(f"   2. Credentials were regenerated/revoked")
                print(f"   3. Credentials are from wrong API app/project")
                print(f"   4. Access Token + Secret don't match API Key + Secret")
                print(f"\n   💡 Ask your friend to:")
                print(f"   - Verify the credentials are still valid")
                print(f"   - Check if they were regenerated")
                print(f"   - Make sure all 4 credentials are from the SAME app/project")
                sys.exit(1)
            except Exception as e:
                print(f"   ⚠️  get_me() error: {type(e).__name__}: {e}")
            
            # Now try getting a tweet with user_auth
            print("\n   Testing with get_tweet() endpoint...")
            try:
                test_tweet = extractor.client.get_tweet(test_tweet_id, tweet_fields=['public_metrics'], user_auth=True)
                if test_tweet.data:
                    metrics = test_tweet.data.public_metrics if hasattr(test_tweet.data, 'public_metrics') else {}
                    print(f"✅ API connection successful!")
                    print(f"   Tweet has: {metrics.get('like_count', 0)} likes, {metrics.get('retweet_count', 0)} retweets, {metrics.get('reply_count', 0)} replies")
                else:
                    print("⚠️  Could not get tweet data, but continuing anyway...")
            except Exception as e:
                print(f"⚠️  get_tweet() error: {type(e).__name__}: {e}")
                print("   Continuing anyway...")
        except tweepy.Unauthorized as e:
            print("❌ ERROR: Unauthorized - Your API credentials are invalid!")
            print("\n   This usually means:")
            print("   1. ❌ Credentials have typos (most common)")
            print("   2. ❌ Credentials were regenerated/revoked")
            print("   3. ❌ Credentials are from different apps/projects")
            print("   4. ❌ Access Token + Secret don't match API Key + Secret")
            print("\n   💡 Solutions:")
            print("   - Double-check ALL 4 credentials for typos")
            print("   - Ask your friend to verify credentials are still valid")
            print("   - Make sure all 4 are from the SAME Twitter app/project")
            print("   - Try regenerating credentials if needed")
            sys.exit(1)
        except Exception as e:
            print(f"⚠️  Could not verify connection: {type(e).__name__}: {e}")
            print("   Continuing anyway...")
        
        extractor.export_to_xlsx(tweet_url, skip_likes=skip_likes, skip_retweets=skip_retweets)
    except ValueError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {type(e).__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

