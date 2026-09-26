#!/usr/bin/env node

import { getTodayPacific, shouldPublishToday } from './netlify/functions/scheduled-publish.mjs';

// Mock articles matching the real schedule
const mockArticles = [
  { date: '2026-09-28', slug: 'part-1' },
  { date: '2026-10-05', slug: 'part-2' },
  { date: '2026-10-12', slug: 'part-3' }
];

console.log('========== Testing Scheduled Function Date Logic ==========\n');

// Test cases
const testCases = [
  { date: '2026-09-27', expected: false, desc: 'Day before Part 1' },
  { date: '2026-09-28', expected: true, desc: 'Part 1 publish day' },
  { date: '2026-09-29', expected: false, desc: 'Day after Part 1' },
  { date: '2026-10-04', expected: false, desc: 'Day before Part 2' },
  { date: '2026-10-05', expected: true, desc: 'Part 2 publish day' },
  { date: '2026-10-06', expected: false, desc: 'Day after Part 2' },
  { date: '2026-10-11', expected: false, desc: 'Day before Part 3' },
  { date: '2026-10-12', expected: true, desc: 'Part 3 publish day' },
  { date: '2026-10-13', expected: false, desc: 'Day after Part 3' }
];

let passed = 0;
let failed = 0;

testCases.forEach(({ date, expected, desc }) => {
  const result = shouldPublishToday(date, mockArticles);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  
  if (result === expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${status} ${date} (${desc}): Should publish = ${expected}, Got = ${result}`);
});

console.log(`\n========== Summary ==========`);
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failed > 0) {
  process.exit(1);
}

console.log('\n✅ All tests passed!');
