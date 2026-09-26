#!/usr/bin/env node

import { zipFunction } from '@netlify/zip-it-and-ship-it';
import { mkdtemp, rm, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('========== Testing Function Bundle ==========\n');

async function testBundle() {
  let tempDir;
  try {
    // Create temporary directory for output
    tempDir = await mkdtemp(join(tmpdir(), 'netlify-function-test-'));
    console.log(`Created temp directory: ${tempDir}`);
    
    // Bundle the function
    console.log('\nBundling function with @netlify/zip-it-and-ship-it...');
    const result = await zipFunction(
      join(__dirname, 'netlify/functions/scheduled-publish.mjs'),
      tempDir,
      {
        basePath: __dirname,
        config: {
          '*.mjs': {
            nodeBundler: 'esbuild'
          }
        }
      }
    );
    
    console.log(`✅ Function bundled successfully`);
    console.log(`   Output: ${result.path}`);
    console.log(`   Runtime: ${result.runtime}`);
    
    // Unzip the bundle
    console.log('\nUnzipping bundle...');
    const unzipDir = join(tempDir, 'unzipped');
    execSync(`unzip -q "${result.path}" -d "${unzipDir}"`);
    
    const files = await readdir(unzipDir);
    console.log(`   Unzipped files: ${files.join(', ')}`);
    
    // Find the entry point (should be scheduled-publish.mjs or similar)
    const entryPoint = files.find(f => f.endsWith('.mjs') || f.endsWith('.js'));
    if (!entryPoint) {
      throw new Error('No entry point found in bundle');
    }
    
    // Import and test the bundled function
    console.log(`\nImporting bundled function (${entryPoint})...`);
    const bundledModule = await import(join(unzipDir, entryPoint));
    
    console.log('✅ Function loaded successfully (no syntax errors)');
    
    // Check what's exported
    console.log(`   Exported keys: ${Object.keys(bundledModule).join(', ')}`);
    
    // The actual function module is in netlify/functions/scheduled-publish.mjs
    const actualFunctionPath = join(unzipDir, 'netlify/functions/scheduled-publish.mjs');
    console.log(`\nImporting actual function module for testing...`);
    const functionModule = await import(actualFunctionPath);
    
    if (functionModule.shouldPublishToday) {
      console.log('\nTesting shouldPublishToday logic...');
      const testDate = '2026-10-05';
      const mockArticles = [
        { date: '2026-09-28', slug: 'part-1' },
        { date: '2026-10-05', slug: 'part-2' },
        { date: '2026-10-12', slug: 'part-3' }
      ];
      
      const result = functionModule.shouldPublishToday(testDate, mockArticles);
      console.log(`   shouldPublishToday('2026-10-05'): ${result}`);
      
      if (result === true) {
        console.log('✅ Function correctly identifies publish date');
      } else {
        throw new Error('Function failed to identify publish date');
      }
      
      // Test non-publish date
      const nonPublishResult = functionModule.shouldPublishToday('2026-10-06', mockArticles);
      console.log(`   shouldPublishToday('2026-10-06'): ${nonPublishResult}`);
      
      if (nonPublishResult === false) {
        console.log('✅ Function correctly identifies non-publish date');
      } else {
        throw new Error('Function incorrectly identified non-publish date as publish date');
      }
    } else {
      console.log('   Note: shouldPublishToday not exported from bundled module');
    }
    
    console.log('\n========== All Bundle Tests Passed ==========');
    
  } catch (error) {
    console.error('\n❌ Bundle test failed:', error.message);
    throw error;
  } finally {
    // Cleanup
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      console.log(`\nCleaned up temp directory`);
    }
  }
}

testBundle().catch(err => {
  console.error(err);
  process.exit(1);
});
