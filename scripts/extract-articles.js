#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read posts.json
const posts = JSON.parse(fs.readFileSync('posts.json', 'utf8'));

// Extract articles and briefings
const articles = posts.filter(p => p.type === 'article');
const briefings = posts.filter(p => p.type !== 'article');

// Update article dates to the schedule
articles[0].date = '2026-09-28'; // Part 1
articles[1].date = '2026-10-05'; // Part 2
articles[2].date = '2026-10-12'; // Part 3

// Save articles to content/articles.json
if (!fs.existsSync('content')) {
  fs.mkdirSync('content');
}
fs.writeFileSync('content/articles.json', JSON.stringify(articles, null, 2), 'utf8');

// Save briefings-only posts.json
fs.writeFileSync('posts.json', JSON.stringify(briefings, null, 2), 'utf8');

console.log(`Extracted ${articles.length} articles to content/articles.json`);
console.log(`Saved ${briefings.length} briefings to posts.json`);
console.log('\nArticle schedule:');
articles.forEach(a => console.log(`  Part ${a.series.part}: ${a.date} - ${a.title}`));
