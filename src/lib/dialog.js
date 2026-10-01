export const WELCOME = 'Hello! Welcome to our Virtual Assistant.';
export const REGISTRATION_SUCCESS = 'Registration successful! Would you like to continue?';
export const REGISTRATION_EXIT = 'Thank you! Have a great day.';
export const NOT_REGISTERED = 'This email is not registered. Would you like to create a new account?';
export const NOT_FOUND_EXIT = 'No problem! Have a great day.';
export const API_FAILURE = 'Something went wrong. Please try again later.';

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE = /^[0-9+()\s-]{8,}$/;

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function validateLoginEmail(value) {
  return EMAIL.test(normalizeEmail(value)) ? '' : 'Enter a valid email address to continue.';
}

export function validateRegistration({ username, email, phone, password }) {
  if (String(username || '').trim().length < 2) return 'Enter a username with at least 2 characters.';
  if (!EMAIL.test(normalizeEmail(email))) return 'Enter a valid email address.';
  if (!PHONE.test(String(phone || ''))) return 'Enter a valid phone number.';
  if (String(password || '').length < 8) return 'Use a password with at least 8 characters.';
  return '';
}

export function validateAccountUpdate({ username, email, phone }) {
  if (String(username || '').trim().length < 2) return 'Enter a username with at least 2 characters.';
  if (!EMAIL.test(normalizeEmail(email))) return 'Enter a valid email address.';
  if (!PHONE.test(String(phone || ''))) return 'Enter a valid phone number.';
  return '';
}

const CONCERN_WORDS = ['bad', 'angry', 'frustrated', 'frustrating', 'issue', 'problem', 'urgent', 'upset', 'terrible', 'awful', 'broken', 'fail', 'failed', 'hate', 'worst', 'unhappy'];
const POSITIVE_WORDS = ['great', 'thanks', 'thank', 'good', 'helpful', 'excellent', 'happy', 'nice', 'awesome', 'love', 'perfect'];

/**
 * Sentiment analysis for the in-session label and the negative-sentiment
 * acknowledgement rule.
 */
export function analyzeSentiment(value) {
  const input = String(value || '').toLowerCase();
  if (CONCERN_WORDS.some((word) => input.includes(word))) return { label: 'Concern detected', tone: 'concern' };
  if (POSITIVE_WORDS.some((word) => input.includes(word))) return { label: 'Positive', tone: 'positive' };
  return { label: 'Neutral', tone: 'neutral' };
}

export function isNegativeSentiment(value) {
  return analyzeSentiment(value).tone === 'concern';
}

/**
 * Intent routing for free-text messages. Mirrors the Kore.ai intent map so the
 * web prototype and the platform assistant behave the same way.
 */
export function classifyIntent(value) {
  const text = String(value || '').toLowerCase().trim();
  if (!text) return { intent: 'None', confidence: 0 };

  if (/\b(log ?in|log ?into|login|sign ?in|sign ?into|signin|access my account|open my account)\b/.test(text)) {
    return { intent: 'UserLogin', confidence: 0.95 };
  }
  if (/\b(register|signup|sign ?up|create (an |a )?account|create (an |a )?(new )?account|new (user|account)|i (need|want) (an |a )?(new )?account|make (an |a )?account|join pronix)\b/.test(text)) {
    return { intent: 'UserRegistration', confidence: 0.95 };
  }
  if (/\b(modify|edit|update|change|delete|remove|account settings|my profile)\b/.test(text) && /\b(account|profile|phone|email|username|details)\b/.test(text)) {
    return { intent: 'AccountManagement', confidence: 0.9 };
  }
  // "contact" alone must not trigger handoff: questions such as "how much does
  // contact center AI cost?" are content questions, not requests for a human.
  if (/\b(contact (pronix|us|support|you|team|sales)|email (pronix|support|us|the team|them)|who do i talk to|(talk|speak) to (a |the )?(person|human|agent|someone|anyone|you)|get in touch|reach (out|us)|schedule a (call|session|meeting)|book a (call|demo|session))\b/.test(text)) {
    return { intent: 'ContactSupport', confidence: 0.9 };
  }
  if (/\b(case stud(y|ies)|success stor(y|ies)|customer success|client stor(y|ies)|examples?|kore\.ai)\b/.test(text)) {
    return { intent: 'CaseStudySearch', confidence: 0.88 };
  }
  if (/\b(blogs?|insights?|articles?|guides?|whitepapers?|trends?|outlook|perspectives?)\b/.test(text)) {
    return { intent: 'PronixInsights', confidence: 0.85 };
  }
  if (/\b(services?|capabilities|capability|what do you do|how (can|do) you help)\b/.test(text)) {
    return { intent: 'PronixServices', confidence: 0.85 };
  }
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|start|help|can you help|i need help|need help)\b/.test(text)) {
    return { intent: 'Greeting', confidence: 0.8 };
  }
  return { intent: 'SearchAI', confidence: 0.4 };
}

export const SUGGESTED_QUESTIONS = {
  services: 'What services does Pronix offer?',
  caseStudy: 'Show a case study',
  timeline: 'How long does a production agent take?',
  cost: 'How much does contact center AI cost?',
  governance: 'How do you govern enterprise AI?',
};