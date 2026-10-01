import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = resolve(ROOT, 'src/data/knowledge.json');
const ENTRY_URL = process.env.PRONIX_ENTRY_URL || 'http://www.pronixinc.com';
const ORIGIN = 'https://pronix.ai';
const MAX_PAGES = Number(process.env.PRONIX_MAX_PAGES || 260);
const CONCURRENCY = 6;

const SEEDS = [
  '/',
  '/services',
  '/cx-contact-center',
  '/ai-agents',
  '/solutions',
  '/industries',
  '/resources',
  '/resources/case-studies',
  '/resources/guides',
  '/blog',
  '/company',
  '/how-we-work',
  '/managed-services',
  '/platforms',
  '/answers',
  '/thoughtleaders',
  '/engagement-models',
  '/forward-deployed-engineering',
  '/careers',
];

const FEEDS = [
  { url: '/feeds/answers.json', category: 'FAQs' },
  { url: '/feeds/guides.json', category: 'Blogs' },
  { url: '/feeds/insights.json', category: 'Blogs' },
];

const SKIP = /^(\/(assets|fonts|legal|favicon)|https?:\/\/(?!pronix))/;
const FILE_LIKE = /\.(jpe?g|png|gif|webp|svg|css|js|mjs|ico|woff2?|pdf|xml|json)$/i;
const PRIVATE_ASSET = /^\/(__l5e|cdn-cgi|uploads|wp-content)\//i;

const SERVICE_TYPES = [
  { value: 'CX', patterns: [/contact center/i, /ccaa?s/i, /voice ai/i, /ivr/i, /agent assist/i, /customer experience/i] },
  { value: 'Agentic AI', patterns: [/agentic/i, /\bagents?\b/i, /rag\b/i, /retrieval/i, /enterprise ai/i] },
  { value: 'Automation', patterns: [/business automation/i, /\brpa\b/i, /document/i, /claims/i, /workflow/i, /finance operations/i] },
  { value: 'Strategy', patterns: [/strategy/i, /consult/i, /operating model/i, /readiness/i, /assessment/i, /roadmap/i] },
  { value: 'Engineering', patterns: [/engineering/i, /implementation/i, /migration/i, /integration/i, /devops/i, /foundation/i] },
];

const TAGS = [
  { value: 'Governance', patterns: [/governance/i, /\bnist\b/i, /iso\/?iec/i, /risk/i, /compliance/i, /red.?team/i] },
  { value: 'Delivery', patterns: [/timeline/i, /pilot/i, /production/i, /rollout/i, /delivery/i, /implement/i, /90 days?/i] },
  { value: 'Industries', patterns: [/industry/i, /industries/i, /healthcare/i, /insurance/i, /financial services/i, /retail/i, /\bbpo\b/i, /payer/i] },
  { value: 'Operations', patterns: [/\bsla\b/i, /managed/i, /monitoring/i, /drift/i, /run state/i, /support/i, /unit economics/i, /\broi\b/i] },
  { value: 'Platforms', patterns: [/kore\.ai/i, /amazon connect/i, /genesys/i, /nice cxone/i, /agentforce/i, /bedrock/i, /azure/i, /five9/i, /platform/i] },
  { value: 'Case study', patterns: [/case study/i, /customer story/i] },
];

function categoryFor(path, feedCategory) {
  if (feedCategory) return feedCategory;
  if (path.startsWith('/resources/case-studies')) return 'Case studies';
  if (path.startsWith('/blog') || path.startsWith('/resources/insights') || path.startsWith('/resources/guides')) return 'Blogs';
  if (path.startsWith('/answers')) return 'FAQs';
  if (path.startsWith('/services') || path.startsWith('/cx-contact-center') || path.startsWith('/ai-agents')
    || path.startsWith('/solutions') || path.startsWith('/managed-services') || path.startsWith('/engagement-models')
    || path.startsWith('/forward-deployed-engineering') || path.startsWith('/roi')) return 'Services';
  if (path.startsWith('/industries') || path.startsWith('/company') || path.startsWith('/how-we-work')
    || path.startsWith('/careers') || path.startsWith('/partners') || path.startsWith('/contact')) return 'About';
  if (path.startsWith('/platforms')) return 'Platforms';
  if (path.startsWith('/for/') || path.startsWith('/thoughtleaders') || path.startsWith('/campaigns')) return 'About';
  if (path.startsWith('/resources')) return 'Resources';
  return 'Company';
}

// Signals are scored by frequency over the meaningful head of a page rather than
// by any-match over the whole body: shared navigation and footer copy mentions
// every service on every page, which would otherwise collapse every document
// onto a single service type.
function scoreSignals(text, table) {
  return table
    .map((entry) => {
      const hits = entry.patterns.reduce((total, pattern) => {
        const matches = text.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'));
        return total + (matches ? matches.length : 0);
      }, 0);
      return { value: entry.value, hits };
    })
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits);
}

function head(entry) {
  return [entry.title, entry.summary, entry.text.slice(0, 1600)].join(' ');
}

function serviceTypesFor(entry) {
  return scoreSignals(head(entry), SERVICE_TYPES).map((entry) => entry.value).slice(0, 3);
}

function blogTagsFor(entry, category) {
  const tags = scoreSignals(head(entry), TAGS).map((entry) => entry.value);
  if (category === 'Case studies' && !tags.includes('Case study')) tags.unshift('Case study');
  return tags.slice(0, 3);
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, ' - ')
    .replace(/&ndash;/g, ' - ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|section|article|br|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return decodeEntities(match[1]).trim();
  }
  return '';
}

function metaOf(html, names) {
  for (const name of names) {
    const match = html.match(
      new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
    );
    if (match) return decodeEntities(match[1]).trim();
  }
  const reversed = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["'](${names.join('|')})["']`, 'i'),
  );
  return reversed ? decodeEntities(reversed[1]).trim() : '';
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 45);
}

function pickAnswer(text, title) {
  const sentences = splitSentences(text);
  if (!sentences.length) return text.slice(0, 320).trim();
  const titleWords = new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3));
  const ranked = sentences
    .map((sentence) => {
      const words = sentence.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
      const overlap = words.filter((word) => titleWords.has(word)).length;
      return { sentence, score: overlap - sentence.length / 4000 };
    })
    .sort((a, b) => b.score - a.score);
  let answer = ranked.slice(0, 2).map((entry) => entry.sentence).join(' ');
  if (answer.length > 520) answer = answer.slice(0, answer.lastIndexOf(' ', 517)) + '...';
  return answer;
}

async function get(url) {
  const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'PronixChatbotCrawler/1.0 (+assignment prototype)' } });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response;
}

async function collectLinks() {
  const found = new Set(SEEDS);
  const queue = [...SEEDS];
  while (queue.length && found.size < MAX_PAGES) {
    const batch = queue.splice(0, CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (path) => {
        try {
          const html = await (await get(ORIGIN + path)).text();
          const links = [...html.matchAll(/href="(\/[^"#?]+)"/g)]
            .map((match) => match[1].replace(/\/$/, '') || '/')
            .filter((link) => !SKIP.test(link) && !FILE_LIKE.test(link) && !PRIVATE_ASSET.test(link) && !link.startsWith('/book'));
          links.forEach((link) => {
            if (!found.has(link) && found.size < MAX_PAGES) {
              found.add(link);
              queue.push(link);
            }
          });
          return true;
        } catch {
          return false;
        }
      }),
    );
    if (!results.some(Boolean)) break;
  }
  return [...found];
}

async function readFeeds(documents) {
  for (const feed of FEEDS) {
    try {
      const feedJson = await (await get(ORIGIN + feed.url)).json();
      for (const item of feedJson.items || []) {
        const path = new URL(item.url).pathname.replace(/\/$/, '') || '/';
        const body = item.content_text || item.summary || '';
        if (!body) continue;
        documents.push({
          path,
          url: item.url,
          title: item.title || path,
          summary: item.summary || '',
          text: body,
          datePublished: item.date_published || '',
          tags: item.tags || [],
          category: categoryFor(path, feed.category),
        });
      }
    } catch (error) {
      process.stderr.write('feed failed ' + feed.url + ': ' + error.message + '\n');
    }
  }
}

const KEYWORD_STOP_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'the', 'to', 'with']);

function keywordTokens(values) {
  return values
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !KEYWORD_STOP_WORDS.has(token));
}

function toDocument(entry) {
  const category = categoryFor(entry.path);
  const serviceTypes = serviceTypesFor(entry);
  const blogTags = blogTagsFor(entry, category);
  const answer = entry.summary && entry.summary.length > 80 ? entry.summary : pickAnswer(entry.text, entry.title);
  return {
    id: entry.path,
    title: entry.title,
    url: entry.url,
    category,
    serviceType: serviceTypes[0] || '',
    serviceTypes,
    blogTag: blogTags[0] || '',
    blogTags,
    answer,
    excerpt: entry.summary || entry.text.slice(0, 260).trim(),
    datePublished: entry.datePublished || '',
    tags: entry.tags,
    keywords: [...new Set(keywordTokens([entry.title, category, ...serviceTypes, ...blogTags]))],
  };
}

async function crawlPages(paths) {
  const documents = [];
  for (let index = 0; index < paths.length; index += CONCURRENCY) {
    const batch = paths.slice(index, index + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (path) => {
        const url = ORIGIN + (path === '/' ? '/' : path + '/');
        try {
          const html = await (await get(url)).text();
          const title = firstMatch(html, [/<h1[^>]*>([\s\S]*?)<\/h1>/i]) || metaOf(html, ['og:title', 'twitter:title']) || path;
          const text = stripTags(html);
          if (text.length < 200) return null;
          return {
            path,
            url,
            title: stripTags(title).split('\n')[0],
            summary: metaOf(html, ['description', 'og:description']),
            text,
            datePublished: '',
            tags: [],
            category: categoryFor(path),
          };
        } catch {
          return null;
        }
      }),
    );
    documents.push(...results.filter(Boolean));
  }
  return documents;
}

async function main() {
  process.stdout.write('resolving ' + ENTRY_URL + '\n');
  try {
    const response = await get(ENTRY_URL);
    process.stdout.write('entry resolved to ' + response.url + '\n');
  } catch (error) {
    process.stderr.write('entry URL failed (' + error.message + '), continuing with ' + ORIGIN + '\n');
  }

  const feedDocuments = [];
  await readFeeds(feedDocuments);
  const paths = await collectLinks();
  process.stdout.write('crawling ' + paths.length + ' pages\n');
  const pageDocuments = await crawlPages(paths);

  const merged = new Map();
  for (const entry of [...feedDocuments, ...pageDocuments]) {
    const existing = merged.get(entry.path);
    if (!existing) {
      merged.set(entry.path, entry);
      continue;
    }
    // Feed documents carry curated summaries and tags; keep whichever body is richer
    // while never discarding that metadata.
    const preferred = (existing.text || '').length >= (entry.text || '').length ? existing : entry;
    merged.set(entry.path, {
      ...preferred,
      summary: existing.summary || entry.summary,
      datePublished: existing.datePublished || entry.datePublished,
      tags: existing.tags?.length ? existing.tags : entry.tags,
      category: existing.category !== 'Company' ? existing.category : entry.category,
    });
  }

  const documents = [...merged.values()]
    .filter((entry) => (entry.text || '').length > 200)
    .map(toDocument);
  const byCategory = documents.reduce((totals, doc) => {
    totals[doc.category] = (totals[doc.category] || 0) + 1;
    return totals;
  }, {});

  const payload = {
    generatedAt: new Date().toISOString(),
    entryUrl: ENTRY_URL,
    origin: ORIGIN,
    documentCount: documents.length,
    categories: byCategory,
    serviceTypes: [...new Set(documents.flatMap((doc) => doc.serviceTypes))].sort(),
    blogTags: [...new Set(documents.flatMap((doc) => doc.blogTags))].sort(),
    documents,
  };

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
  process.stdout.write('wrote ' + documents.length + ' documents to ' + OUT_FILE + '\n');
  process.stdout.write(JSON.stringify(byCategory, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write('crawl failed: ' + error.stack + '\n');
  process.exit(1);
});