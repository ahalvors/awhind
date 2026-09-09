#!/usr/bin/env node

const fs = require('fs');

const posts = JSON.parse(fs.readFileSync('posts.json', 'utf8'));

const staticUrls = [
  { loc: 'https://awhind.com/', lastmod: '2026-09-02', priority: '1.0' },
  { loc: 'https://awhind.com/shadow-ai', lastmod: '2026-09-02', priority: '0.9' },
  { loc: 'https://awhind.com/capabilities/service-desk', lastmod: '2026-09-02', priority: '0.8' },
  { loc: 'https://awhind.com/capabilities/ai-governance', lastmod: '2026-09-02', priority: '0.8' },
  { loc: 'https://awhind.com/capabilities/endpoint-ops', lastmod: '2026-09-02', priority: '0.8' },
  { loc: 'https://awhind.com/capabilities/global-noc', lastmod: '2026-09-02', priority: '0.8' }
];

const briefingUrls = posts.map(post => ({
  loc: `https://awhind.com/briefing/${post.date}`,
  lastmod: post.date,
  priority: '0.6'
}));

const allUrls = [...staticUrls, ...briefingUrls];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync('sitemap.xml', sitemap, 'utf8');
console.log(`Generated sitemap.xml with ${allUrls.length} URLs (${staticUrls.length} static + ${briefingUrls.length} briefings)`);
