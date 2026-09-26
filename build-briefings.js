#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read posts.json (briefings only) and content/articles.json
const posts = JSON.parse(fs.readFileSync('posts.json', 'utf8'));
const allArticles = fs.existsSync('content/articles.json') 
  ? JSON.parse(fs.readFileSync('content/articles.json', 'utf8'))
  : [];

const briefingDir = path.join(__dirname, 'briefing');
if (!fs.existsSync(briefingDir)) {
  fs.mkdirSync(briefingDir, { recursive: true });
}

const articlesDir = path.join(__dirname, 'articles');
if (!fs.existsSync(articlesDir)) {
  fs.mkdirSync(articlesDir, { recursive: true });
}

function fmtDate(dateStr) {
  const dt = new Date(dateStr + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '');
}

// Determine current date in America/Los_Angeles timezone
function getTodayInPacific() {
  // Allow override for testing
  if (process.env.PUBLISH_DATE_OVERRIDE) {
    return new Date(process.env.PUBLISH_DATE_OVERRIDE + 'T00:00:00');
  }
  
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
  return new Date(`${year}-${month}-${day}T00:00:00`);
}

// Check if article is due
function isArticleDue(article) {
  const articleDate = new Date(article.date + 'T00:00:00');
  const today = getTodayInPacific();
  return articleDate <= today;
}

// Determine if we're in preview mode
const isPreview = process.env.CONTEXT === 'deploy-preview' || process.env.CONTEXT === 'branch-deploy';

// Filter articles based on context
const dueArticles = isPreview 
  ? allArticles // Preview shows all
  : allArticles.filter(isArticleDue); // Production only shows due articles

let briefingCount = 0;
let articleCount = 0;

// ========== GENERATE BRIEFING PAGES ==========
posts.forEach(post => {
  briefingCount++;
  const dateDir = path.join(briefingDir, post.date);
  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir, { recursive: true });
  }

  const canonicalUrl = `https://awhind.com/briefing/${post.date}`;
  const ogTitle = escapeHtml(post.title);
  const ogDescription = escapeHtml(stripHtml(post.dek));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": stripHtml(post.dek),
    "datePublished": post.date,
    "url": canonicalUrl,
    "author": { "@type": "Organization", "name": "AWHIND", "url": "https://awhind.com" },
    "publisher": { "@type": "Organization", "name": "AWHIND", "url": "https://awhind.com" }
  };
  
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${ogDescription}">
<title>${ogTitle} — AWHIND Daily Briefing</title>
<link rel="canonical" href="${canonicalUrl}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='16' fill='%230B0F17'/%3E%3Ccircle cx='50' cy='50' r='16' fill='%23DD4E1E'/%3E%3C/svg%3E">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDescription}">
<meta property="og:site_name" content="AWHIND">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${ogDescription}">

<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  :root{
    --bg:#F1F2ED;
    --bg-elevated:#FFFFFF;
    --bg-sunken:#E7E8E1;
    --text:#0B0F17;
    --text-secondary:#566072;
    --text-tertiary:#848d9b;
    --line:#D9DAD2;
    --line-strong:#c2c4ba;
    --accent:#DD4E1E;
    --accent-contrast:#FFFFFF;
    --shadow: 0 1px 2px rgba(11,15,23,.04), 0 8px 24px rgba(11,15,23,.06);
    --serif: 'Newsreader', Georgia, 'Times New Roman', serif;
    --sans: 'IBM Plex Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
    --mono: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#0A0D14;
      --bg-elevated:#12161F;
      --bg-sunken:#080A10;
      --text:#EEF0F4;
      --text-secondary:#9AA3B4;
      --text-tertiary:#6d7688;
      --line:#232838;
      --line-strong:#323951;
      --accent:#FF7A47;
      --accent-contrast:#0A0D14;
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.4);
    }
  }
  :root[data-theme="dark"]{
    --bg:#0A0D14;
    --bg-elevated:#12161F;
    --bg-sunken:#080A10;
    --text:#EEF0F4;
    --text-secondary:#9AA3B4;
    --text-tertiary:#6d7688;
    --line:#232838;
    --line-strong:#323951;
    --accent:#FF7A47;
    --accent-contrast:#0A0D14;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.4);
  }

  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{
    margin:0; background:var(--bg); color:var(--text);
    font-family:var(--sans); font-size:16px; line-height:1.55;
    -webkit-font-smoothing:antialiased;
  }
  a{color:inherit;}
  h1,h2{font-family:var(--serif); font-weight:500; margin:0; text-wrap:balance; letter-spacing:-0.01em;}
  .mono{font-family:var(--mono);}
  .wrap{max-width:1120px; margin:0 auto; padding:0 28px;}
  .btn{
    display:inline-flex; align-items:center; gap:8px; font-family:var(--mono); font-size:13px;
    letter-spacing:.04em; text-transform:uppercase; padding:12px 20px; border-radius:2px;
    text-decoration:none; cursor:pointer; border:1px solid transparent;
  }
  .btn-ghost{border-color:var(--line-strong); color:var(--text);}
  .btn-ghost:hover{border-color:var(--accent); color:var(--accent);}
  .btn-sm{padding:8px 14px; font-size:11px;}

  nav.wrap{display:flex; align-items:center; justify-content:space-between; padding-top:18px; padding-bottom:18px;}
  .brand{font-family:var(--serif); font-weight:600; font-size:21px; letter-spacing:-.01em; text-decoration:none; color:var(--text); display:flex; align-items:center; gap:9px;}
  .brand .mark{width:9px;height:9px;background:var(--accent);display:inline-block;}

  article{max-width:720px; margin:44px auto; padding:0 28px;}
  .meta{font-family:var(--mono); font-size:11.5px; color:var(--text-tertiary); letter-spacing:.03em; margin-bottom:16px;}
  article h1{font-size:32px; line-height:1.15;}
  .dek{font-size:16px; color:var(--text-secondary); margin-top:14px; font-family:var(--serif); font-style:italic;}
  .article-body{margin-top:28px; font-size:15.5px; color:var(--text); max-width:60ch;}
  .article-body p{margin:0 0 18px;}
  .article-body strong{font-weight:600;}
  .article-body .stat-inline{font-family:var(--mono); color:var(--accent); font-weight:600;}
  .article-sources{margin-top:32px; padding-top:20px; border-top:1px solid var(--line); font-size:12px; color:var(--text-tertiary);}
  .article-sources a{color:var(--text-secondary); text-decoration:underline; text-decoration-color:var(--line-strong);}
  .back-link{margin-top:32px; display:inline-block;}
</style>
</head>
<body>

<nav class="wrap">
  <a href="/" class="brand"><span class="mark"></span>AWHIND</a>
  <div>
    <a href="/#briefing" class="btn btn-ghost btn-sm">← All Briefings</a>
  </div>
</nav>

<article>
  <div class="meta">${fmtDate(post.date)} &middot; ${post.tag} &middot; ${post.read} read</div>
  <h1>${post.title}</h1>
  <div class="dek">${post.dek}</div>
  <div class="article-body">
    ${post.body.map(p => `<p>${p}</p>`).join('\n    ')}
  </div>
  <div class="article-sources">
    Sources: ${post.sources.map(s => `<a href="${s[1]}" target="_blank" rel="noopener">${s[0]}</a>`).join(' &middot; ')}
  </div>
  <a href="/#briefing" class="btn btn-ghost btn-sm back-link">← All Briefings</a>
</article>

</body>
</html>
`;

  const outputPath = path.join(dateDir, 'index.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Generated ${outputPath}`);
});

// ========== CLEAN UP NON-DUE ARTICLE DIRECTORIES ==========
// Delete article directories that shouldn't exist
const allSlugs = allArticles.map(a => a.slug);
const dueSlugs = new Set(dueArticles.map(a => a.slug));

allSlugs.forEach(slug => {
  if (!dueSlugs.has(slug)) {
    const slugDir = path.join(articlesDir, slug);
    if (fs.existsSync(slugDir)) {
      fs.rmSync(slugDir, { recursive: true, force: true });
      console.log(`Deleted non-due article directory: ${slugDir}`);
    }
  }
});

// ========== GENERATE ARTICLE PAGES ==========
dueArticles.forEach(post => {
  articleCount++;

  const slugDir = path.join(articlesDir, post.slug);
  if (!fs.existsSync(slugDir)) {
    fs.mkdirSync(slugDir, { recursive: true });
  }

  const canonicalUrl = `https://awhind.com/articles/${post.slug}`;
  const ogTitle = escapeHtml(post.seo_title || post.title);
  const ogDescription = escapeHtml(post.meta_description);
  const ogImageUrl = post.featured_image ? `https://awhind.com${post.featured_image}` : '';
  const ogImageAlt = post.featured_image ? escapeHtml(`Featured image for ${post.title}`) : '';
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.meta_description,
    "datePublished": post.date,
    "url": canonicalUrl,
    "author": { "@type": "Organization", "name": "AWHIND", "url": "https://awhind.com" },
    "publisher": { "@type": "Organization", "name": "AWHIND", "url": "https://awhind.com" }
  };
  if (post.featured_image) {
    jsonLd.image = ogImageUrl;
  }

  // Build series navigation if present
  let seriesNav = '';
  if (post.series) {
    const prevPart = post.series.part > 1 ? post.series.part - 1 : null;
    const nextPart = post.series.part < post.series.total ? post.series.part + 1 : null;
    
    // Find prev/next articles
    const prevArticle = prevPart ? allArticles.find(p => p.series && p.series.part === prevPart) : null;
    const nextArticle = nextPart ? allArticles.find(p => p.series && p.series.part === nextPart) : null;
    
    // In production, only show links to due articles
    const prevLink = prevArticle && (isPreview || isArticleDue(prevArticle));
    const nextLink = nextArticle && (isPreview || isArticleDue(nextArticle));
    
    // In preview, label scheduled articles
    const prevLabel = prevArticle && isPreview && !isArticleDue(prevArticle) ? ` (scheduled ${fmtDate(prevArticle.date)})` : '';
    const nextLabel = nextArticle && isPreview && !isArticleDue(nextArticle) ? ` (scheduled ${fmtDate(nextArticle.date)})` : '';
    
    seriesNav = `
  <div class="series-nav">
    <div class="series-label">${post.series.title} &middot; Part ${post.series.part}</div>
    <div class="series-links">
      ${prevLink ? `<a href="/articles/${prevArticle.slug}" class="series-link">← Part ${prevPart}${prevLabel}</a>` : ''}
      ${nextLink ? `<a href="/articles/${nextArticle.slug}" class="series-link">Part ${nextPart} →${nextLabel}</a>` : ''}
    </div>
  </div>`;
  }

  // Scheduled banner for future articles in preview
  const isDue = isArticleDue(post);
  const scheduledBanner = (isPreview && !isDue) ? `
  <div class="scheduled-banner">
    <strong>Scheduled:</strong> Publishes ${fmtDate(post.date)}
  </div>` : '';

  // Add noindex meta for scheduled articles in preview
  const noindexMeta = (isPreview && !isDue) ? '\n<meta name="robots" content="noindex">' : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${ogDescription}">
<title>${ogTitle}</title>
<link rel="canonical" href="${canonicalUrl}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='16' fill='%230B0F17'/%3E%3Ccircle cx='50' cy='50' r='16' fill='%23DD4E1E'/%3E%3C/svg%3E">${noindexMeta}

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDescription}">
<meta property="og:site_name" content="AWHIND">${post.featured_image ? `
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${ogImageAlt}">` : ''}

<!-- Twitter Card -->
<meta name="twitter:card" content="${post.featured_image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${ogDescription}">${post.featured_image ? `
<meta name="twitter:image" content="${ogImageUrl}">` : ''}

<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  :root{
    --bg:#F1F2ED;
    --bg-elevated:#FFFFFF;
    --bg-sunken:#E7E8E1;
    --text:#0B0F17;
    --text-secondary:#566072;
    --text-tertiary:#848d9b;
    --line:#D9DAD2;
    --line-strong:#c2c4ba;
    --accent:#DD4E1E;
    --accent-contrast:#FFFFFF;
    --shadow: 0 1px 2px rgba(11,15,23,.04), 0 8px 24px rgba(11,15,23,.06);
    --serif: 'Newsreader', Georgia, 'Times New Roman', serif;
    --sans: 'IBM Plex Sans', -apple-system, 'Segoe UI', Roboto, sans-serif;
    --mono: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#0A0D14;
      --bg-elevated:#12161F;
      --bg-sunken:#080A10;
      --text:#EEF0F4;
      --text-secondary:#9AA3B4;
      --text-tertiary:#6d7688;
      --line:#232838;
      --line-strong:#323951;
      --accent:#FF7A47;
      --accent-contrast:#0A0D14;
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.4);
    }
  }
  :root[data-theme="dark"]{
    --bg:#0A0D14;
    --bg-elevated:#12161F;
    --bg-sunken:#080A10;
    --text:#EEF0F4;
    --text-secondary:#9AA3B4;
    --text-tertiary:#6d7688;
    --line:#232838;
    --line-strong:#323951;
    --accent:#FF7A47;
    --accent-contrast:#0A0D14;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.4);
  }

  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{
    margin:0; background:var(--bg); color:var(--text);
    font-family:var(--sans); font-size:16px; line-height:1.55;
    -webkit-font-smoothing:antialiased;
  }
  a{color:inherit;}
  h1,h2{font-family:var(--serif); font-weight:500; margin:0; text-wrap:balance; letter-spacing:-0.01em;}
  .mono{font-family:var(--mono);}
  .wrap{max-width:1120px; margin:0 auto; padding:0 28px;}
  .btn{
    display:inline-flex; align-items:center; gap:8px; font-family:var(--mono); font-size:13px;
    letter-spacing:.04em; text-transform:uppercase; padding:12px 20px; border-radius:2px;
    text-decoration:none; cursor:pointer; border:1px solid transparent;
  }
  .btn-ghost{border-color:var(--line-strong); color:var(--text);}
  .btn-ghost:hover{border-color:var(--accent); color:var(--accent);}
  .btn-sm{padding:8px 14px; font-size:11px;}

  nav.wrap{display:flex; align-items:center; justify-content:space-between; padding-top:18px; padding-bottom:18px;}
  .brand{font-family:var(--serif); font-weight:600; font-size:21px; letter-spacing:-.01em; text-decoration:none; color:var(--text); display:flex; align-items:center; gap:9px;}
  .brand .mark{width:9px;height:9px;background:var(--accent);display:inline-block;}

  article{max-width:720px; margin:44px auto; padding:0 28px;}
  .meta{font-family:var(--mono); font-size:11.5px; color:var(--text-tertiary); letter-spacing:.03em; margin-bottom:16px;}
  article h1{font-size:32px; line-height:1.15;}
  .featured-image{margin-top:24px; width:100%; height:auto; display:block;}
  .article-body{margin-top:28px; font-size:15.5px; color:var(--text); max-width:60ch;}
  .article-body p{margin:0 0 18px;}
  .article-body h2{font-size:24px; margin:32px 0 16px; line-height:1.25;}
  .article-body ul, .article-body ol{margin:0 0 18px; padding-left:28px;}
  .article-body li{margin-bottom:8px;}
  .article-body strong{font-weight:600;}
  .article-body a{color:var(--accent); text-decoration:underline; text-decoration-color:var(--line-strong);}
  .article-body a:hover{text-decoration-color:var(--accent);}
  .back-link{margin-top:32px; display:inline-block;}
  .series-nav{margin-top:40px; padding-top:20px; border-top:1px solid var(--line); font-size:13px;}
  .series-label{font-family:var(--mono); color:var(--text-tertiary); letter-spacing:.03em; margin-bottom:12px;}
  .series-links{display:flex; gap:16px;}
  .series-link{color:var(--text-secondary); text-decoration:underline; text-decoration-color:var(--line-strong);}
  .series-link:hover{color:var(--accent); text-decoration-color:var(--accent);}
  .scheduled-banner{
    background:var(--bg-sunken); border:1px solid var(--line-strong); border-radius:4px;
    padding:16px 20px; margin-top:24px; font-size:14px; color:var(--text-secondary);
  }
  .scheduled-banner strong{color:var(--text);}
</style>
</head>
<body>

<nav class="wrap">
  <a href="/" class="brand"><span class="mark"></span>AWHIND</a>
  <div>
    <a href="/" class="btn btn-ghost btn-sm">← Home</a>
  </div>
</nav>

<article>
  <div class="meta">${fmtDate(post.date)} &middot; ${post.read} read</div>
  <h1>${post.title}</h1>${scheduledBanner}${post.featured_image ? `
  <img src="${post.featured_image}" alt="${post.title}" class="featured-image" width="1200" height="630">` : ''}
  <div class="article-body">
    ${post.body}
  </div>${seriesNav}
  <a href="/" class="btn btn-ghost btn-sm back-link">← Home</a>
</article>

</body>
</html>
`;

  const outputPath = path.join(slugDir, 'index.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Generated ${outputPath}`);
});

// ========== GENERATE PUBLIC ARTICLES.JSON ==========
// Only include metadata, no body
const publicArticles = dueArticles.map(a => ({
  title: a.title,
  slug: a.slug,
  date: a.date,
  excerpt: a.excerpt,
  read: a.read,
  featured_image: a.featured_image,
  part: a.series ? a.series.part : null
}));

fs.writeFileSync('articles.json', JSON.stringify(publicArticles, null, 2), 'utf8');
console.log(`\nGenerated articles.json with ${publicArticles.length} due articles`);

console.log(`\nGenerated ${briefingCount} briefing pages and ${articleCount} article pages.`);
console.log(`Context: ${process.env.CONTEXT || 'local'}, Preview mode: ${isPreview}, Today: ${getTodayInPacific().toISOString().split('T')[0]}`);
