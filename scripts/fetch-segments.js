#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Get Strava access token from environment variable
const STRAVA_ACCESS_TOKEN = process.env.STRAVA_ACCESS_TOKEN;

if (!STRAVA_ACCESS_TOKEN) {
  console.error('Error: STRAVA_ACCESS_TOKEN environment variable not set');
  process.exit(1);
}

// NYC borough bounding boxes
const boroughBounds = {
  'Manhattan': '40.700,-74.020,40.880,-73.907',
  'Brooklyn': '40.570,-74.042,40.739,-73.833',
  'Queens': '40.541,-73.962,40.800,-73.700',
  'Bronx': '40.785,-73.933,40.917,-73.765',
  'Staten Island': '40.477,-74.259,40.651,-74.050'
};

// Fetch data from URL using https
function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Authorization': `Bearer ${STRAVA_ACCESS_TOKEN}` } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    }).on('error', reject);
  });
}

// Fetch explore segments for a borough
async function fetchBoroughSegments(borough, bounds) {
  const url = `https://www.strava.com/api/v3/segments/explore?bounds=${bounds}&activity_type=running&min_cat=0&max_cat=5`;
  console.log(`Fetching segments for ${borough}...`);

  try {
    const data = await fetchData(url);
    return data.segments || [];
  } catch (error) {
    console.error(`Error fetching ${borough}:`, error.message);
    return [];
  }
}

// Fetch detailed segment data
async function fetchSegmentDetails(segmentId) {
  const url = `https://www.strava.com/api/v3/segments/${segmentId}`;

  try {
    const data = await fetchData(url);
    return {
      effort_count: data.effort_count,
      athlete_count: data.athlete_count,
      star_count: data.star_count
    };
  } catch (error) {
    console.error(`Error fetching segment ${segmentId}:`, error.message);
    return null;
  }
}

// Add delay between API calls to respect rate limits
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Starting Strava segments fetch...');
  console.log('Timestamp:', new Date().toISOString());

  // Fetch segments from all boroughs
  const boroughPromises = Object.entries(boroughBounds).map(([borough, bounds]) =>
    fetchBoroughSegments(borough, bounds)
  );

  const boroughSegmentArrays = await Promise.all(boroughPromises);
  const allSegments = boroughSegmentArrays.flat();

  // Remove duplicates by segment ID
  const uniqueSegments = [];
  const seenIds = new Set();

  allSegments.forEach(segment => {
    if (!seenIds.has(segment.id)) {
      seenIds.add(segment.id);
      uniqueSegments.push(segment);
    }
  });

  console.log(`Found ${uniqueSegments.length} unique segments`);

  // Fetch detailed data for each segment with delay to avoid rate limits
  const detailedSegments = [];

  for (let i = 0; i < uniqueSegments.length; i++) {
    const segment = uniqueSegments[i];
    console.log(`Fetching details for segment ${i + 1}/${uniqueSegments.length}: ${segment.name}`);

    const details = await fetchSegmentDetails(segment.id);

    if (details) {
      detailedSegments.push({
        ...segment,
        ...details
      });
    } else {
      detailedSegments.push(segment);
    }

    // Wait 100ms between requests to avoid rate limiting
    if (i < uniqueSegments.length - 1) {
      await delay(100);
    }
  }

  // Sort by athlete count (descending)
  detailedSegments.sort((a, b) => (b.athlete_count || 0) - (a.athlete_count || 0));

  // Save to JSON file
  const outputData = {
    updated_at: new Date().toISOString(),
    segment_count: detailedSegments.length,
    segments: detailedSegments
  };

  const outputPath = path.join(__dirname, '..', 'data', 'segments_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  console.log(`✓ Saved ${detailedSegments.length} segments to ${outputPath}`);
  console.log('Done!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
