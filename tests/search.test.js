import { describe, expect, it } from 'vitest';
import {
  bestAnswer, blogTags, categories, corpusStats, relatedOptions, search, serviceTypes,
} from '../src/lib/search.js';

describe('search corpus', () => {
  it('indexes the crawled Pronix corpus', () => {
    const stats = corpusStats();
    expect(stats.documentCount).toBeGreaterThan(50);
    expect(stats.entryUrl).toContain('pronixinc.com');
    expect(Object.keys(stats.categories)).toContain('Services');
    expect(Object.keys(stats.categories)).toContain('FAQs');
    expect(Object.keys(stats.categories)).toContain('Case studies');
  });

  it('exposes filter values for the search UI', () => {
    expect(categories()).toContain('Services');
    expect(categories()).toContain('FAQs');
    expect(serviceTypes().length).toBeGreaterThan(1);
    expect(blogTags()).toContain('Governance');
  });
});

describe('hybrid retrieval', () => {
  it('answers a direct keyword question', () => {
    const result = bestAnswer('what services does Pronix offer?');
    expect(result).not.toBeNull();
    expect(result.answer.length).toBeGreaterThan(40);
  });

  it('retrieves FAQ content for a pricing question', () => {
    const results = search('how much does contact center AI cost?');
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((item) => item.category)).toContain('FAQs');
  });

  it('retrieves case studies for an outcome question', () => {
    const results = search('show me a customer success case study');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((item) => item.category === 'Case studies')).toBe(true);
  });

  it('resolves paraphrase through the semantic ranker', () => {
    const results = search('how fast can you get this live?');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].blogTags.some((tag) => ['Delivery', 'Operations'].includes(tag))).toBe(true);
  });

  it('returns a ranked list capped at five', () => {
    const results = search('AI');
    expect(results.length).toBeLessThanOrEqual(5);
    const scores = results.map((item) => item.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('offers related options alongside the best answer', () => {
    expect(relatedOptions('enterprise AI governance').length).toBeGreaterThan(0);
  });
});

describe('search filters', () => {
  it('restricts results to a category', () => {
    const results = search('AI', { category: 'Case studies' });
    expect(results.every((item) => item.category === 'Case studies')).toBe(true);
  });

  it('restricts results to a blog tag', () => {
    const results = search('AI', { blogTag: 'Governance' });
    expect(results.every((item) => item.blogTags.includes('Governance'))).toBe(true);
  });

  it('restricts results to a service type', () => {
    const results = search('AI', { serviceType: 'CX' });
    expect(results.every((item) => item.serviceTypes.includes('CX'))).toBe(true);
  });

  it('can filter out every result so the fallback path is reachable', () => {
    // A category the crawl never produced empties the result set, which is what
    // drives the related-options fallback in the UI.
    expect(search('AI', { category: 'No Such Category' })).toHaveLength(0);
  });
});

describe('no-answer fallback', () => {
  it('returns nothing for an unrelated question', () => {
    expect(bestAnswer('what is the best recipe for tiramisu')).toBeNull();
  });

  it('returns nothing for empty input', () => {
    expect(search('')).toHaveLength(0);
    expect(search('   ')).toHaveLength(0);
  });
});

// Regression cases found by probing the ranker against real questions. Each one
// previously returned a confident but wrong answer.
describe('retrieval regressions', () => {
  const mustAnswer = [
    ['what is AI unit economics', 'FAQs'],
    ['what is AI drift monitoring', 'FAQs'],
    ['what is RAG', 'FAQs'],
    ['how long does a pilot take', 'FAQs'],
    ['how do you govern AI', 'FAQs'],
    ['will AI replace contact center agents', 'FAQs'],
    ['what is your ROI', 'FAQs'],
    ['how do you automate claims', 'FAQs'],
  ];

  it.each(mustAnswer)('answers %s from the right section', (question, category) => {
    const result = bestAnswer(question);
    expect(result).not.toBeNull();
    expect(result.category).toBe(category);
  });

  it('answers industry and platform questions', () => {
    expect(bestAnswer('what industries do you work with').category).toBe('About');
    expect(bestAnswer('tell me about Amazon Connect').category).toBe('Services');
  });

  // "what time do you open" once matched a blog post about handle time, because
  // a single common term was enough to clear the gate.
  it('rejects an out-of-domain question that shares one common word', () => {
    expect(bestAnswer('what time do you open')).toBeNull();
    expect(bestAnswer('where are you based')).toBeNull();
  });

  it('rejects questions with no corpus vocabulary at all', () => {
    for (const question of ['who won the football match', 'what is the weather tomorrow', 'recipe for lasagna']) {
      expect(bestAnswer(question)).toBeNull();
    }
  });
});