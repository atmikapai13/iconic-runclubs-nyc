# Strava Segments Setup Guide

This project uses GitHub Actions to automatically fetch Strava segments data daily, avoiding rate limits and ensuring all users see the same cached data.

## How It Works

1. **GitHub Actions** runs daily at 6 AM UTC
2. Fetches top 10 segments from each NYC borough (up to 50 total)
3. Fetches detailed stats (athlete count, elevation, distance) for each segment
4. Saves results to `data/segments_data.json`
5. Commits and pushes the updated JSON file
6. Users load from the cached JSON file instead of calling the API

## Setup Instructions

### 1. Get Strava API Access

1. Go to https://www.strava.com/settings/api
2. Create an application (if you haven't already)
3. Note your **Client ID** and **Client Secret**

### 2. Get an Access Token

You need to exchange your authorization code for an access token. Here's how:

1. Visit this URL in your browser (replace `YOUR_CLIENT_ID`):
   ```
   https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=activity:read_all
   ```

2. Authorize the application
3. You'll be redirected to `http://localhost/?code=XXXXXX`
4. Copy the `code` value from the URL

5. Exchange the code for an access token (replace values):
   ```bash
   curl -X POST https://www.strava.com/api/v3/oauth/token \
     -d client_id=YOUR_CLIENT_ID \
     -d client_secret=YOUR_CLIENT_SECRET \
     -d code=YOUR_CODE \
     -d grant_type=authorization_code
   ```

6. The response will include your `access_token` and `refresh_token`

### 3. Add GitHub Secret

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `STRAVA_ACCESS_TOKEN`
5. Value: Paste your access token
6. Click **Add secret**

### 4. Enable GitHub Actions

1. Go to **Actions** tab in your repository
2. Enable workflows if prompted
3. The workflow will run daily at 6 AM UTC
4. You can also trigger it manually:
   - Go to **Actions** tab
   - Click **Fetch Strava Segments Daily**
   - Click **Run workflow**

### 5. Initial Run

Before deploying, you need to create the initial `segments_data.json` file:

**Option A: Manual trigger (Recommended)**
1. Go to Actions tab
2. Click "Fetch Strava Segments Daily"
3. Click "Run workflow" → "Run workflow"
4. Wait for it to complete
5. The `data/segments_data.json` file will be created

**Option B: Local run**
```bash
export STRAVA_ACCESS_TOKEN="your_token_here"
node scripts/fetch-segments.js
git add data/segments_data.json
git commit -m "Add initial segments data"
git push
```

## Token Refresh

Strava access tokens expire after 6 hours. To refresh:

1. Use the refresh token from step 2.6 above
2. Call the token refresh endpoint:
   ```bash
   curl -X POST https://www.strava.com/api/v3/oauth/token \
     -d client_id=YOUR_CLIENT_ID \
     -d client_secret=YOUR_CLIENT_SECRET \
     -d refresh_token=YOUR_REFRESH_TOKEN \
     -d grant_type=refresh_token
   ```
3. Update the GitHub secret with the new access token

**Note:** You'll need to refresh the token periodically (every few months). GitHub Actions will fail when the token expires, and you'll receive an email notification.

## File Structure

```
iconic-runclubs-nyc/
├── .github/
│   └── workflows/
│       └── fetch-strava-segments.yml    # GitHub Actions workflow
├── data/
│   └── segments_data.json               # Cached segments (auto-generated)
├── scripts/
│   └── fetch-segments.js                # Node.js script to fetch segments
└── index.html                           # Main app (loads from JSON)
```

## Troubleshooting

### Workflow fails with "STRAVA_ACCESS_TOKEN not found"
- Make sure you added the secret in GitHub Settings → Secrets and variables → Actions
- Secret name must be exactly `STRAVA_ACCESS_TOKEN`

### Workflow fails with "401 Unauthorized"
- Your access token has expired
- Follow "Token Refresh" instructions above to get a new token
- Update the GitHub secret

### Segments not showing on website
- Check that `data/segments_data.json` exists in your repository
- Trigger the workflow manually to generate the initial file
- Check the Actions tab for any workflow errors

### Rate limit errors
- The script includes 100ms delays between requests
- Daily runs should stay well within the 1000 requests/day limit
- Each run uses ~55 API calls (5 explore + ~50 detail requests)
