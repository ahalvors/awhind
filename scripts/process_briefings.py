#!/usr/bin/env python3
"""Process markdown briefings and add them to posts.json"""
import json
import re
import sys
from pathlib import Path

def parse_markdown_briefing(md_content):
    """Parse a markdown briefing file and return a posts.json entry"""
    
    # Extract frontmatter
    frontmatter_match = re.match(r'^---\n(.*?)\n---\n', md_content, re.DOTALL)
    if not frontmatter_match:
        raise ValueError("No frontmatter found")
    
    frontmatter = {}
    for line in frontmatter_match.group(1).split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            frontmatter[key.strip()] = value.strip().strip('"')
    
    # Extract body content (skip the first H1 and meta line)
    body_start = md_content.find('**')
    if body_start == -1:
        body_start = md_content.find(frontmatter_match.group(0)) + len(frontmatter_match.group(0))
    
    # Get content after frontmatter
    content = md_content[len(frontmatter_match.group(0)):].strip()
    
    # Split into lines and process
    lines = content.split('\n')
    
    # Skip the header line (# Title)
    start_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('#') or line.startswith('**'):
            start_idx = i
            if line.startswith('#'):
                start_idx = i + 1
            break
    
    # Skip meta line
    for i in range(start_idx, len(lines)):
        if lines[i].strip().startswith('**') and '·' in lines[i]:
            start_idx = i + 1
            break
    
    # Extract body paragraphs and sources
    body_paragraphs = []
    sources = []
    
    # Join lines and split by double newline to get paragraphs
    content_text = '\n'.join(lines[start_idx:]).strip()
    
    # Extract sources from the end
    sources_match = re.search(r'\*\*Sources:\*\*\s+(.+)$', content_text, re.MULTILINE | re.DOTALL)
    if sources_match:
        sources_text = sources_match.group(1).strip()
        content_text = content_text[:sources_match.start()].strip()
        
        # Parse sources - they're in markdown link format
        source_links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', sources_text)
        sources = [[title, url] for title, url in source_links]
    
    # Process paragraphs
    paragraphs = content_text.split('\n\n')
    for para in paragraphs:
        para = para.strip()
        if para and not para.startswith('---'):
            # Clean up line numbers if present
            para = re.sub(r'^\s*\d+\|', '', para, flags=re.MULTILINE)
            # Join lines within paragraph
            para = ' '.join(line.strip() for line in para.split('\n') if line.strip())
            if para:
                body_paragraphs.append(para)
    
    return {
        "date": frontmatter['date'],
        "tag": frontmatter['tag'],
        "read": frontmatter['read'],
        "title": frontmatter['title'],
        "dek": frontmatter['dek'],
        "body": body_paragraphs,
        "sources": sources
    }

def main():
    if len(sys.argv) < 2:
        print("Usage: process_briefings.py <md_file1> [md_file2 ...]")
        sys.exit(1)
    
    # Load existing posts.json
    posts_path = Path(__file__).parent.parent / 'posts.json'
    with open(posts_path) as f:
        posts = json.load(f)
    
    # Process each markdown file
    new_entries = []
    for md_file in sys.argv[1:]:
        with open(md_file) as f:
            content = f.read()
        
        entry = parse_markdown_briefing(content)
        new_entries.append(entry)
        print(f"Processed {entry['date']}")
    
    # Add new entries to the beginning (most recent first)
    posts = new_entries + posts
    
    # Save back to posts.json
    with open(posts_path, 'w') as f:
        json.dump(posts, f, indent=2)
    
    print(f"\nAdded {len(new_entries)} entries to posts.json")

if __name__ == '__main__':
    main()
