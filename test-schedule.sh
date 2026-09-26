#!/bin/bash

echo "========== Testing Article Publication Schedule =========="
echo

echo "Test 1: Sep 27, 2026 (day before Part 1) - No articles expected"
CONTEXT=production PUBLISH_DATE_OVERRIDE=2026-09-27 npm run build | grep -E "(Generated articles.json|Generated .* article pages|Context:)"
echo

echo "Test 2: Sep 28, 2026 (Part 1 publishes) - Only Part 1 expected"
CONTEXT=production PUBLISH_DATE_OVERRIDE=2026-09-28 npm run build | grep -E "(Generated articles.json|Generated .* article pages|Context:)"
ls -la articles/ 2>/dev/null | grep -v "^total" | awk '{print "  " $NF}' || echo "  (no articles directory)"
cat articles.json 2>/dev/null | jq '.[] | {part, slug, date}' || echo "{}"
echo

echo "Test 3: Oct 5, 2026 (Part 2 publishes) - Parts 1-2 expected"
CONTEXT=production PUBLISH_DATE_OVERRIDE=2026-10-05 npm run build | grep -E "(Generated articles.json|Generated .* article pages|Context:)"
ls -la articles/ 2>/dev/null | grep -v "^total" | awk '{print "  " $NF}' || echo "  (no articles directory)"
cat articles.json 2>/dev/null | jq '.[] | {part, slug, date}' || echo "{}"
echo

echo "Test 4: Oct 12, 2026 (Part 3 publishes) - All 3 parts expected"
CONTEXT=production PUBLISH_DATE_OVERRIDE=2026-10-12 npm run build | grep -E "(Generated articles.json|Generated .* article pages|Context:)"
ls -la articles/ 2>/dev/null | grep -v "^total" | awk '{print "  " $NF}' || echo "  (no articles directory)"
cat articles.json 2>/dev/null | jq '.[] | {part, slug, date}' || echo "{}"
echo

echo "Test 5: Checking sitemap for Oct 12 (all 3 parts)"
grep "<loc>.*articles/" sitemap.xml | sed 's/.*<loc>/  /' | sed 's/<\/loc>//'
echo

echo "========== Done =========="
