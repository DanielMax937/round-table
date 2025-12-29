#!/usr/bin/env tsx

/**
 * Test script for web search enhancement
 * Tests Serper + Jina integration with caching
 */

import { performWebSearch } from '../lib/agents/tools/websearch';
import { cleanExpiredCache } from '../lib/db/searchCache';

async function main() {
  console.log('🧪 Testing Web Search Enhancement\n');
  console.log('=' .repeat(60));

  // Test 1: Basic search functionality
  console.log('\n📝 Test 1: Basic Search (Cache Miss)');
  console.log('-'.repeat(60));
  try {
    const query1 = 'Claude AI Anthropic 2024';
    console.log(`Query: "${query1}"\n`);

    const start1 = Date.now();
    const results1 = await performWebSearch(query1);
    const duration1 = Date.now() - start1;

    console.log(`\n✅ Search completed in ${duration1}ms`);
    console.log(`Found ${results1.length} results\n`);

    // Display first result
    if (results1.length > 0) {
      const first = results1[0];
      console.log('First Result:');
      console.log(`  Title: ${first.title}`);
      console.log(`  URL: ${first.url}`);
      console.log(`  Snippet: ${first.snippet.substring(0, 100)}...`);
      console.log(`  Enriched: ${first.enrichedContent?.source || 'none'}`);
      if (first.enrichedContent?.source === 'jina') {
        console.log(`  Content Length: ${first.enrichedContent.markdown.length} chars`);
      }
    }
  } catch (error: any) {
    console.error('❌ Test 1 Failed:', error.message);
  }

  // Test 2: Cache hit
  console.log('\n\n📝 Test 2: Same Query (Cache Hit)');
  console.log('-'.repeat(60));
  try {
    const query2 = 'Claude AI Anthropic 2024';
    console.log(`Query: "${query2}"\n`);

    const start2 = Date.now();
    const results2 = await performWebSearch(query2);
    const duration2 = Date.now() - start2;

    console.log(`\n✅ Search completed in ${duration2}ms (should be <100ms)`);
    console.log(`Found ${results2.length} results`);

    if (duration2 < 100) {
      console.log('✅ Cache is working! Sub-100ms response.');
    } else {
      console.log('⚠️  Cache may not be working - took longer than expected');
    }
  } catch (error: any) {
    console.error('❌ Test 2 Failed:', error.message);
  }

  // Test 3: Different query
  console.log('\n\n📝 Test 3: Different Query');
  console.log('-'.repeat(60));
  try {
    const query3 = 'TypeScript async programming 2024';
    console.log(`Query: "${query3}"\n`);

    const start3 = Date.now();
    const results3 = await performWebSearch(query3);
    const duration3 = Date.now() - start3;

    console.log(`\n✅ Search completed in ${duration3}ms`);
    console.log(`Found ${results3.length} results`);

    // Check enrichment success rate
    const jinaSuccesses = results3.filter(
      (r) => r.enrichedContent?.source === 'jina'
    ).length;
    console.log(`Jina enrichment success: ${jinaSuccesses}/${results3.length}`);
  } catch (error: any) {
    console.error('❌ Test 3 Failed:', error.message);
  }

  // Test 4: Edge cases
  console.log('\n\n📝 Test 4: Edge Cases');
  console.log('-'.repeat(60));

  // Empty query
  try {
    await performWebSearch('');
    console.log('❌ Empty query should have thrown error');
  } catch (error: any) {
    console.log('✅ Empty query correctly rejected:', error.message);
  }

  // Very short query
  try {
    const results = await performWebSearch('ai');
    console.log(`✅ Short query accepted, found ${results.length} results`);
  } catch (error: any) {
    console.log('⚠️  Short query failed:', error.message);
  }

  // Test 5: Cache cleanup
  console.log('\n\n📝 Test 5: Cache Cleanup');
  console.log('-'.repeat(60));
  try {
    const cleaned = await cleanExpiredCache();
    console.log(`✅ Cleaned ${cleaned} expired entries (should be 0 for new cache)`);
  } catch (error: any) {
    console.error('❌ Test 5 Failed:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Testing Complete!\n');
}

main().catch(console.error);
