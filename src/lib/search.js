import knowledge from '../data/knowledge.json';

const STOP_WORDS = new Set([
  'a', 'about', 'after', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by',
  'can', 'did', 'do', 'does', 'doing', 'done', 'for', 'from', 'get', 'had', 'has', 'have', 'how', 'i', 'if', 'in',
  'into', 'is', 'it', 'its', 'just', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'our', 'out', 'over', 'please', 'so',
  'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'to',
  'too', 'up', 'us', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with',
  'would', 'you', 'your',
]);

// Small curated concept map. The assignment asks for a semantic ranker; in the
// prototype this stands in for an embedding model, matching paraphrases to
// canonical vocabulary so "how fast can you go live" reaches delivery content.
// "agent" is deliberately absent from several lists: this corpus is about AI
// agents, so the term would match almost every document and destroy the signal.
const CONCEPTS = {
  pricing: ['cost', 'costs', 'price', 'prices', 'pricing', 'budget', 'spend', 'expensive', 'cheap', 'fee', 'fees', 'money', 'roi'],
  timeline: ['long', 'duration', 'fast', 'quick', 'weeks', 'month', 'months', 'year', 'deadline', 'speed', 'quickly'],
  services: ['offer', 'offers', 'service', 'services', 'capabilities', 'do', 'provide', 'capability', 'help'],
  contactCenter: ['contact center', 'ccaaS', 'call', 'calls', 'voice', 'ivr', 'telephony', 'hotline'],
  agentic: ['agentic', 'autonomous', 'copilot'],
  automation: ['automate', 'automation', 'automated', 'rpa', 'workflow', 'workflows', 'process', 'manual'],
  governance: ['governance', 'govern', 'risk', 'compliance', 'audit', 'regulation', 'policy', 'security', 'nist', 'iso'],
  caseStudy: ['case study', 'case studies', 'customer story', 'success story', 'example', 'examples', 'reference', 'outcome', 'results', 'client'],
  industries: ['industry', 'industries', 'sector', 'sectors', 'vertical', 'healthcare', 'banking', 'insurance', 'retail', 'bpo'],
  platforms: ['platform', 'platforms', 'kore', 'genesys', 'amazon', 'connect', 'nice', 'salesforce', 'agentforce', 'aws', 'azure'],
  delivery: ['deliver', 'delivery', 'implement', 'implementation', 'deploy', 'rollout', 'pilot', 'production', 'migrate', 'migration'],
  operations: ['sla', 'managed', 'monitoring', 'drift', 'run state', 'unit economics', 'roi', 'support', 'incident', 'evaluate'],
  support: ['support', 'help', 'contact', 'speak', 'person', 'human', 'talk', 'reach', 'team'],
  retrieval: ['rag', 'retrieval', 'search', 'grounding', 'knowledge', 'documents', 'index'],
};

const CATEGORY_ALIASES = {
  services: ['Services'],
  'service offering': ['Services'],
  faq: ['FAQs'],
  faqs: ['FAQs'],
  blogs: ['Blogs'],
  insights: ['Blogs'],
  guides: ['Blogs'],
  'case study': ['Case studies'],
  'case studies': ['Case studies'],
  cases: ['Case studies'],
  about: ['About'],
  company: ['About', 'Company'],
  platforms: ['Platforms'],
};

const ALIAS_LOOKUP = new Map();
for (const [alias, categories] of Object.entries(CATEGORY_ALIASES)) {
  for (const category of categories) {
    if (!ALIAS_LOOKUP.has(alias)) ALIAS_LOOKUP.set(alias, []);
    ALIAS_LOOKUP.get(alias).push(category);
  }
}

export const ALL = 'All';

// Retrieval tuning.
const MIN_SCORE = 0.85;
// Share of the query's content tokens that must match before a page is
// considered an answer.
const MIN_COVERAGE = 0.5;

export function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function stem(token) {
  if (token.length > 4 && token.endsWith('ies')) return token.slice(0, -3) + 'y';
  if (token.length > 4 && token.endsWith('es') && !token.endsWith('ses')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
  return token;
}

function conceptSet(tokens) {
  const text = tokens.join(' ');
  const concepts = new Set();
  for (const [concept, members] of Object.entries(CONCEPTS)) {
    if (members.some((member) => text.includes(member))) concepts.add(concept);
  }
  return concepts;
}

function buildIndex(documents) {
  const entries = documents.map((document) => {
    const tokens = tokenize([document.title, document.keywords, document.answer, document.excerpt].join(' '));
    return {
      document,
      tokens,
      stemmed: new Set(tokens.map(stem)),
      titleTokens: new Set(tokenize(document.title)),
      titleStemmed: new Set(tokenize(document.title).map(stem)),
      concepts: conceptSet(tokenize(document.title + ' ' + document.keywords.join(' ') + ' ' + document.answer)),
      frequency: tokens.reduce((totals, token) => {
        totals[token] = (totals[token] || 0) + 1;
        return totals;
      }, {}),
    };
  });

  const documentFrequency = {};
  entries.forEach((entry) => {
    for (const token of new Set(entry.tokens)) documentFrequency[token] = (documentFrequency[token] || 0) + 1;
  });

  return { entries, documentFrequency, total: entries.length };
}

const corpus = buildIndex(knowledge.documents);

function idf(token) {
  const seen = corpus.documentFrequency[token] || 0;
  return Math.log((corpus.total + 1) / (seen + 1)) + 1;
}

function keywordScore(entry, queryTokens, queryConcepts) {
  let score = 0;
  let lengthNorm = 1 + Math.log(entry.tokens.length || 1);

  for (const token of queryTokens) {
    const termFrequency = entry.frequency[token] || 0;
    if (termFrequency) {
      score += idf(token) * ((termFrequency * 2.2) / (termFrequency + 1.2 * 0.75 + 0.1));
    }
    if (stem(token) !== token && entry.stemmed.has(stem(token))) score += idf(token) * 0.35;
  }

  const titleTokens = new Set(tokenize(entry.document.title));
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += idf(token) * 1.4;
  }

  const titleConcepts = conceptSet(tokenize(entry.document.title + ' ' + entry.document.category));
  for (const concept of queryConcepts) {
    if (titleConcepts.has(concept)) score += 1.1;
  }

  return score / lengthNorm;
}

function semanticScore(entry, queryConcepts) {
  if (!queryConcepts.size) return 0;
  let shared = 0;
  for (const concept of queryConcepts) if (entry.concepts.has(concept)) shared += 1;
  if (!shared) return 0;
  // Title-level concept matches are worth more than body mentions.
  const titleConcepts = conceptSet(tokenize(entry.document.title));
  const titleHits = [...queryConcepts].filter((concept) => titleConcepts.has(concept)).length;
  const coverage = shared / queryConcepts.size;
  return coverage * 2.2 + titleHits * 0.8;
}

function phraseBonus(entry, query) {
  const text = (entry.document.title + ' ' + entry.document.answer + ' ' + entry.document.keywords).toLowerCase();
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalizedQuery) return 0;
  if (text.includes(normalizedQuery)) return 2.6;
  const bigrams = normalizedQuery.split(' ').filter((word) => word.length > 3);
  if (!bigrams.length) return 0;
  const hits = bigrams.filter((word) => text.includes(word)).length;
  return (hits / bigrams.length) * 0.8;
}

function matchesFilters(document, filters) {
  const { category, serviceType, blogTag } = filters;
  if (category && category !== ALL) {
    const accepted = ALIAS_LOOKUP.get(category.toLowerCase()) || [category];
    if (!accepted.includes(document.category)) return false;
  }
  if (serviceType && serviceType !== ALL && !document.serviceTypes.includes(serviceType)) return false;
  if (blogTag && blogTag !== ALL && !document.blogTags.includes(blogTag)) return false;
  return true;
}

function depthOf(path) {
  return path.split('/').filter(Boolean).length;
}

function isHub(document) {
  return depthOf(document.id) <= 1;
}

/**
 * Section landing pages answer broad questions ("what services do you offer")
 * better than any single leaf page, even though a leaf page often repeats the
 * query words more often. A small, capped boost reflects that without letting a
 * hub outrank a genuinely more specific match.
 */
function hubBoost(entry, queryTokens) {
  if (!isHub(entry.document)) return 0;
  const genericShare = queryTokens.filter((token) => entry.frequency[token]).length / Math.max(queryTokens.length, 1);
  return 1.6 * genericShare;
}

function score(entry, query) {
  const queryTokens = tokenize(query);
  const concepts = conceptSet(queryTokens);
  const titleTokens = new Set(tokenize(entry.document.title));
  const matched = queryTokens.filter((token) => entry.frequency[token] || entry.stemmed.has(stem(token)));
  // Hybrid: keyword relevance dominates, semantics rescues paraphrase, phrase match confirms.
  const value =
    keywordScore(entry, queryTokens, concepts) +
    semanticScore(entry, concepts) +
    phraseBonus(entry, query) +
    hubBoost(entry, queryTokens) +
    (queryTokens.some((term) => titleTokens.has(term)) ? 0.5 : 0);
  return {
    value,
    matched: matched.length,
    coverage: queryTokens.length ? matched.length / queryTokens.length : 0,
    exactMatch: queryTokens.length > 0 && tokenize(entry.document.title).join(' ') === queryTokens.join(' '),
    titleCoversQuery:
      queryTokens.length > 0 &&
      queryTokens.every((token) => entry.titleStemmed.has(stem(token))),
    concepts: entry.concepts,
  };
}

/**
 * Relevance gate. An answer needs both sufficient query coverage and a concept
 * match, because term frequency alone cannot separate on-domain from off-domain
 * questions in this corpus: "time" and "connect" have identical inverse-document
 * frequency, and "agentic" appears in 241 of 260 documents.
 *
 * A tight title or phrase match is accepted without a concept, so a direct
 * question about a specifically named topic still answers.
 */
function isRelevant(document, queryTokens, queryConcepts) {
  if (!document.matchedTerms) return false;
  if (document.score <= MIN_SCORE) return false;
  if (!queryTokens.length) return false;

  const coverage = document.matchedTerms / queryTokens.length;
  if (coverage < MIN_COVERAGE) return false;

  const semantic = queryConcepts.size > 0 && [...document.concepts].some((concept) => queryConcepts.has(concept));
  // A page whose title covers every word the visitor used is about what they
  // asked, even when the query maps to no known concept.
  return semantic || document.titleCoversQuery;
}

/**
 * Hybrid keyword + semantic retrieval over the crawled Pronix corpus.
 * Returns ranked results; an empty array means Search AI has no confident answer
 * and the caller must show the related-options fallback.
 */
export function search(query, filters = {}) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];

  const applied = { category: ALL, serviceType: ALL, blogTag: ALL, ...filters };
  const terms = tokenize(trimmed);
  if (!terms.length) return [];
  const concepts = conceptSet(terms);

  const ranked = corpus.entries
    .filter((entry) => matchesFilters(entry.document, applied))
    .map((entry) => {
      const ranking = score(entry, trimmed);
      return {
        ...entry.document,
        score: ranking.value,
        matchedTerms: ranking.matched,
        concepts: ranking.concepts,
        titleCoversQuery: ranking.titleCoversQuery,
      };
    })
    .filter((document) => isRelevant(document, terms, concepts))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, 5);
}

export function bestAnswer(query, filters = {}) {
  return search(query, filters)[0] || null;
}

export function relatedOptions(query, filters = {}) {
  return search(query, filters).slice(1, 3);
}

export function categories() {
  return [...new Set(knowledge.documents.map((document) => document.category))].sort();
}

export function serviceTypes() {
  return knowledge.serviceTypes;
}

export function blogTags() {
  return knowledge.blogTags;
}

export function corpusStats() {
  return {
    documentCount: knowledge.documentCount,
    categories: knowledge.categories,
    generatedAt: knowledge.generatedAt,
    entryUrl: knowledge.entryUrl,
  };
}