import { describe, expect, it } from 'vitest';
import { bestAnswer } from '../src/lib/search.js';

// Broad questions should be answered from the right section rather than by an
// arbitrary page that happens to repeat a query word. This deliberately does not
// pin one specific landing page: the crawl is refreshed periodically, and a test
// that demands /services in first place would fail for the wrong reason.
describe('broad questions stay in the right section', () => {
  it('answers a services question from the services section', () => {
    expect(bestAnswer('what services do you offer').category).toBe('Services');
  });

  it('answers an industries question from the industries hub', () => {
    expect(bestAnswer('what industries do you work with').id).toBe('/industries');
  });

  // A specific question must still beat the section hub.
  it('keeps a specific question on its specific page', () => {
    expect(bestAnswer('what is AI unit economics').id).toBe('/answers/what-are-ai-unit-economics');
    expect(bestAnswer('how long does a pilot take').id).toBe('/answers/how-long-does-an-agentic-ai-pilot-take');
  });
});