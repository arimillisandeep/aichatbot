import { describe, expect, it } from 'vitest';
import {
  analyzeSentiment, API_FAILURE, classifyIntent, isNegativeSentiment, NOT_FOUND_EXIT, NOT_REGISTERED,
  REGISTRATION_EXIT, REGISTRATION_SUCCESS, validateAccountUpdate, validateLoginEmail, validateRegistration,
  WELCOME,
} from '../src/lib/dialog.js';

describe('dialog copy matches the assignment script', () => {
  it('uses the specified messages', () => {
    expect(WELCOME).toBe('Hello! Welcome to our Virtual Assistant.');
    expect(REGISTRATION_SUCCESS).toBe('Registration successful! Would you like to continue?');
    expect(REGISTRATION_EXIT).toBe('Thank you! Have a great day.');
    expect(NOT_REGISTERED).toBe('This email is not registered. Would you like to create a new account?');
    expect(NOT_FOUND_EXIT).toBe('No problem! Have a great day.');
    expect(API_FAILURE).toBe('Something went wrong. Please try again later.');
  });
});

describe('login email validation', () => {
  it('accepts a valid address', () => {
    expect(validateLoginEmail('maya@pronix.demo')).toBe('');
    expect(validateLoginEmail(' Maya@Pronix.Demo ')).toBe('');
  });

  it('rejects malformed addresses', () => {
    for (const value of ['', 'maya', 'maya@', '@pronix.demo', 'maya@pronix', 'a b@pronix.demo']) {
      expect(validateLoginEmail(value)).not.toBe('');
    }
  });
});

describe('registration validation', () => {
  const valid = { username: 'Ravi', email: 'ravi@pronix.demo', phone: '+1 609 555 0184', password: 'Pronix@2026' };

  it('accepts a complete valid profile', () => {
    expect(validateRegistration(valid)).toBe('');
  });

  it('requires a username of at least two characters', () => {
    expect(validateRegistration({ ...valid, username: 'R' })).toMatch(/username/i);
  });

  it('requires a valid email', () => {
    expect(validateRegistration({ ...valid, email: 'ravi' })).toMatch(/email/i);
  });

  it('requires a valid phone number', () => {
    expect(validateRegistration({ ...valid, phone: '123' })).toMatch(/phone/i);
  });

  it('requires a password of at least eight characters', () => {
    expect(validateRegistration({ ...valid, password: 'short' })).toMatch(/password/i);
  });
});

describe('account update validation', () => {
  it('accepts a valid profile', () => {
    expect(validateAccountUpdate({ username: 'Ravi', email: 'ravi@pronix.demo', phone: '+1 609 555 0184' })).toBe('');
  });

  it('rejects an invalid profile', () => {
    expect(validateAccountUpdate({ username: '', email: 'bad', phone: 'x' })).not.toBe('');
  });
});

describe('sentiment analysis', () => {
  it('detects concern', () => {
    expect(analyzeSentiment('this is really frustrating and the login is broken').tone).toBe('concern');
    expect(isNegativeSentiment('urgent problem')).toBe(true);
  });

  it('detects positive sentiment', () => {
    expect(analyzeSentiment('thanks, that was helpful').tone).toBe('positive');
  });

  it('defaults to neutral', () => {
    expect(analyzeSentiment('what services do you offer').tone).toBe('neutral');
    expect(isNegativeSentiment('what is your address')).toBe(false);
  });
});

describe('intent classification', () => {
  const cases = [
    ['log in', 'UserLogin'],
    ['I want to sign into my account', 'UserLogin'],
    ['register a new account', 'UserRegistration'],
    ['sign up', 'UserRegistration'],
    ['I need a new account', 'UserRegistration'],
    ['delete my account', 'AccountManagement'],
    ['update my phone number', 'AccountManagement'],
    ['contact support', 'ContactSupport'],
    ['I need to talk to a person', 'ContactSupport'],
    ['who do I talk to', 'ContactSupport'],
    ['email the team', 'ContactSupport'],
    ['can I speak to a human', 'ContactSupport'],
    ['book a demo', 'ContactSupport'],
    ['show a case study', 'CaseStudySearch'],
    ['any customer success stories?', 'CaseStudySearch'],
    ['show me a success story', 'CaseStudySearch'],
    ['any client examples', 'CaseStudySearch'],
    ['show me a blog about governance', 'PronixInsights'],
    ['latest articles', 'PronixInsights'],
    ['show guides', 'PronixInsights'],
    ['what services do you offer', 'PronixServices'],
    ['hello', 'Greeting'],
    ['good morning', 'Greeting'],
    ['can you help', 'Greeting'],
  ];

  it.each(cases)('routes %s to %s', (phrase, intent) => {
    expect(classifyIntent(phrase).intent).toBe(intent);
  });

  it('falls back to Search AI for an unmatched question', () => {
    const result = classifyIntent('what is the containment rate you normally see');
    expect(result.intent).toBe('SearchAI');
    expect(result.confidence).toBeLessThan(0.5);
  });

  // "contact center AI" must not be read as a request for a human, or the
  // pricing questions in the corpus become unanswerable.
  it('does not treat contact-center content questions as a handoff', () => {
    expect(classifyIntent('how much does contact center AI cost').intent).not.toBe('ContactSupport');
    expect(classifyIntent('what industries do you serve').intent).not.toBe('ContactSupport');
  });

  it('returns no intent for empty input', () => {
    expect(classifyIntent('  ').intent).toBe('None');
  });
});