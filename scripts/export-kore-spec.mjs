/* eslint-env node */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUGGESTED_QUESTIONS } from '../src/lib/dialog.js';
import knowledge from '../src/data/knowledge.json' with { type: 'json' };

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/kore-xo-bot-spec.json');

const intents = [
  {
    intent: 'Greeting',
    dialogTask: 'Welcome and authentication',
    utterances: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'I need help', 'can you help me', 'start chat'],
    entities: [],
    firstNode: { type: 'Message', text: 'Hello! Welcome to our Virtual Assistant.' },
    nextNode: { type: 'Choice', prompt: 'How would you like to continue?', options: ['Login', 'Register'] },
  },
  {
    intent: 'UserLogin',
    dialogTask: 'Login Flow',
    utterances: ['log in', 'login', 'sign in', 'sign into my account', 'access my account', 'I want to log into my account', 'open my account'],
    entities: [{ name: 'Email', type: 'Email', validation: 'Valid email format required' }],
    restService: { name: 'findUserByEmail', method: 'GET', endpoint: '{{usersResourceUrl}}' },
    branches: [
      { condition: 'response length > 0', action: 'Message', text: 'Hello {{username}}! You have successfully logged in.', next: 'Account Options' },
      { condition: 'response length == 0', action: 'Message', text: 'This email is not registered. Would you like to create a new account?', next: 'Choice: Register Now | Retry | Cancel' },
    ],
    errorBranch: { action: 'Message', text: 'Something went wrong. Please try again later.' },
  },
  {
    intent: 'UserRegistration',
    dialogTask: 'Signup Flow',
    utterances: ['register', 'sign up', 'signup', 'create an account', 'create a new account', 'I am a new user', 'make a new account', 'join Pronix'],
    entities: [
      { name: 'Username', type: 'Text', validation: 'Minimum 2 characters' },
      { name: 'Email', type: 'Email', validation: 'Valid email format required' },
      { name: 'Phone', type: 'PhoneNumber', validation: 'Valid phone pattern required' },
      { name: 'Password', type: 'Password', validation: 'Minimum 8 characters' },
    ],
    restService: { name: 'registerUser', method: 'POST', endpoint: '{{usersResourceUrl}}', body: ['username', 'email', 'phone', 'password'] },
    branches: [
      { condition: 'success', action: 'Message', text: 'Registration successful! Would you like to continue?', next: 'Choice: Yes | No' },
    ],
    yesBranch: { next: 'Account Options' },
    noBranch: { action: 'Message', text: 'Thank you! Have a great day.' },
    errorBranch: { action: 'Message', text: 'Something went wrong. Please try again later.' },
  },
  {
    intent: 'AccountManagement',
    dialogTask: 'Account Options',
    utterances: ['change my account', 'edit my profile', 'update my phone number', 'update my email', 'delete my account', 'remove my profile', 'account settings'],
    entities: [{ name: 'Field', type: 'Entity', values: ['username', 'email', 'phone'] }],
    choice: ['Modify Account', 'Delete Account'],
    modifyService: { name: 'updateUser', method: 'PUT', endpoint: '{{usersResourceUrl}}/{{recordId}}' },
    deleteService: { name: 'deleteUser', method: 'DELETE', endpoint: '{{usersResourceUrl}}/{{recordId}}' },
    deleteConfirmation: 'Are you sure you want to permanently delete this account?',
    errorBranch: { action: 'Message', text: 'Something went wrong. Please try again later.' },
  },
  {
    intent: 'PronixServices',
    dialogTask: 'Service Discovery',
    utterances: ['what services do you offer', 'tell me about Pronix services', 'contact center AI', 'agentic AI services', 'business automation', 'how can Pronix help us', 'what do you do'],
    entities: [],
    fallback: 'Search AI with category filter Services',
  },
  {
    intent: 'CaseStudySearch',
    dialogTask: 'Case Study Search',
    utterances: ['show a case study', 'do you have a Kore.ai example', 'customer success story', 'banking automation example', 'show outcomes', 'latest case studies', 'client references'],
    entities: [],
    fallback: 'Search AI with category filter Case studies',
  },
  {
    intent: 'PronixInsights',
    dialogTask: 'Insights Search',
    utterances: ['show me a blog', 'enterprise AI guide', 'how do I move from pilot to production', 'governance guidance', 'latest Pronix article', 'AI trends'],
    entities: [],
    fallback: 'Search AI with category filter Blogs',
  },
  {
    intent: 'ContactSupport',
    dialogTask: 'Contact and Handoff',
    utterances: ['contact Pronix', 'email support', 'talk to a person', 'schedule a session', 'get in touch', 'I need help from the team'],
    entities: [],
    actions: { email: 'info@pronix.ai', website: 'https://pronix.ai/' },
  },
];

const payload = {
  bot: 'Pronix Virtual Assistant',
  generatedAt: new Date().toISOString(),
  knowledgeCollection: {
    name: 'Pronix Public Knowledge',
    crawlerStartUrl: 'http://www.pronixinc.com',
    resolvedOrigin: knowledge.origin,
    documentCount: knowledge.documentCount,
    categories: knowledge.categories,
    serviceTypes: knowledge.serviceTypes,
    blogTags: knowledge.blogTags,
    metadataFields: ['content_type', 'service_type', 'category', 'blog_tag'],
    rankers: ['keyword', 'semantic'],
    retrievalMode: 'hybrid',
    fallbackPolicy: 'Unmatched intent routes to Search AI; no result offers related options, the Pronix site link, and info@pronix.ai.',
  },
  intents,
  suggestedQuestions: SUGGESTED_QUESTIONS,
  monitoringEvents: ['intent', 'question', 'sentiment', 'search-hit', 'fallback', 'login', 'registration', 'account', 'api-error', 'handoff', 'conversation', 'corpus'],
  channels: [
    { name: 'Web', status: 'deliverable in this repository', notes: 'Vite web client implementing the same dialog tasks.' },
    { name: 'Telegram', status: 'configured in Kore.ai', notes: 'BotFather token stored only in Kore.ai; publish the version containing these dialog tasks.' },
    { name: 'WhatsApp', status: 'blocked', notes: 'Requires Meta Business verification and a verified phone number owned by the project owner.' },
  ],
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log('wrote ' + OUT);