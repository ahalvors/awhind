import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const articlesData = JSON.parse(readFileSync(join(__dirname, '../../content/articles.json'), 'utf8'));

export const config = {
  schedule: "10 12 * * *" // 12:10 UTC = 5:10 AM PDT / 4:10 AM PST
};

/**
 * Get today's date in America/Los_Angeles timezone
 * @returns {string} Date in YYYY-MM-DD format
 */
export function getTodayPacific() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
}

/**
 * Check if any article publishes today
 * @param {string} today - Date in YYYY-MM-DD format
 * @param {Array} articles - Array of article objects with date field
 * @returns {boolean}
 */
export function shouldPublishToday(today, articles) {
  return articles.some(article => article.date === today);
}

export default async function handler(req, context) {
  const today = getTodayPacific();
  const shouldPublish = shouldPublishToday(today, articlesData);
  
  console.log(`[scheduled-publish] Today: ${today}, Articles to publish: ${shouldPublish ? 'YES' : 'NO'}`);
  
  if (!shouldPublish) {
    console.log('[scheduled-publish] No articles due today, skipping rebuild');
    return new Response('No articles due today', { status: 200 });
  }
  
  const buildHookUrl = process.env.PUBLISH_BUILD_HOOK_URL;
  
  if (!buildHookUrl) {
    console.warn('[scheduled-publish] WARNING: PUBLISH_BUILD_HOOK_URL not set. Rebuild skipped. Set this env var in Netlify (functions scope, production) to enable automatic rebuilds.');
    return new Response('Build hook URL not configured', { status: 200 });
  }
  
  try {
    console.log(`[scheduled-publish] Triggering rebuild for articles due today...`);
    const response = await fetch(buildHookUrl, { method: 'POST' });
    
    if (!response.ok) {
      console.error(`[scheduled-publish] Build hook returned status ${response.status}`);
      return new Response(`Build hook failed: ${response.status}`, { status: 500 });
    }
    
    console.log('[scheduled-publish] Rebuild triggered successfully');
    return new Response('Rebuild triggered', { status: 200 });
  } catch (error) {
    console.error('[scheduled-publish] Error triggering rebuild:', error.message);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
