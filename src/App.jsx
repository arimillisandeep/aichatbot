import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Bot, BriefcaseBusiness, Check, CheckCircle2, ChevronRight,
  ClipboardList, Database, ExternalLink, FileText, Frown, Mail, Menu,
  MessageCircleMore, MessagesSquare, Pencil, RefreshCw, Search, Send,
  Settings2, ShieldCheck, Smile, Sparkles, Trash2, UserRound,
} from 'lucide-react';
import {
  createUser, findUserByEmail, isRemoteStoreEnabled, removeUser, updateUser,
} from './lib/accountStore';
import {
  API_FAILURE, analyzeSentiment, classifyIntent, normalizeEmail,
  NOT_FOUND_EXIT, NOT_REGISTERED, REGISTRATION_EXIT, REGISTRATION_SUCCESS, SUGGESTED_QUESTIONS,
  validateAccountUpdate, validateLoginEmail, validateRegistration, WELCOME,
} from './lib/dialog';
import { ALL, bestAnswer, blogTags, categories, corpusStats, relatedOptions, serviceTypes } from './lib/search';
import workforceImage from './assets/pronix-workforce-ai.png';
import './index.css';

const WEBSITE_URL = 'https://pronix.ai/';
const SUPPORT_EMAIL = 'info@pronix.ai';
const LOG_KEY = 'pronix-assistant-events';
const SENTIMENT_ICONS = { concern: Frown, positive: Smile, neutral: MessageCircleMore };

const stats = corpusStats();

const sources = [
  ['Services', BriefcaseBusiness, stats.categories.Services + ' pages'],
  ['Case studies', ClipboardList, stats.categories['Case studies'] + ' outcomes'],
  ['Insights', FileText, (stats.categories.Blogs || 0) + ' articles and guides'],
  ['About Pronix', Database, (stats.categories.About || 0) + ' company pages'],
];

const starterMessages = [{
  id: 'welcome', author: 'bot', time: 'Now', content: WELCOME,
  actions: [['Login', 'login', 'primary'], ['Register', 'register', 'secondary']],
}];

function time() {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date());
}

function storeEvent(type, detail) {
  try {
    const events = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    localStorage.setItem(LOG_KEY, JSON.stringify([{ type, detail, createdAt: new Date().toISOString() }, ...events].slice(0, 50)));
  } catch {
    localStorage.setItem(LOG_KEY, JSON.stringify([{ type, detail, createdAt: new Date().toISOString() }]));
  }
}

function App() {
  const [messages, setMessages] = useState(starterMessages);
  const [mode, setMode] = useState('welcome');
  const [profile, setProfile] = useState(null);
  const [input, setInput] = useState('');
const [loginEmail, setLoginEmail] = useState('');
  const [scope, setScope] = useState(ALL);
  const [serviceType, setServiceType] = useState(ALL);
  const [blogTag, setBlogTag] = useState(ALL);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [registerData, setRegisterData] = useState({ username: '', email: '', phone: '', password: '' });
  const [accountData, setAccountData] = useState({ username: '', email: '', phone: '', password: '' });
  const sentiment = useMemo(() => analyzeSentiment(input), [input]);
  const SentimentIcon = SENTIMENT_ICONS[sentiment.tone];

  const filters = useMemo(() => ({ category: scope, serviceType, blogTag }), [scope, serviceType, blogTag]);

  useEffect(() => {
    storeEvent('corpus', stats.documentCount + ' documents from ' + stats.entryUrl);
  }, []);

  function push(author, content, extra = {}) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), author, content, time: time(), ...extra }]);
  }

  function bot(content, extra) { push('bot', content, extra); }
  function user(content) { push('user', content); }

function beginLogin(withSelection = true) {
    if (withSelection) user('Login');
    setMode('login'); setLoginEmail(''); setError('');
    bot('Please enter your registered email address.');
    storeEvent('intent', 'UserLogin');
  }

  function beginRegister(withSelection = true) {
    if (withSelection) user('Register');
    setMode('register'); setRegisterData({ username: '', email: '', phone: '', password: '' }); setError('');
    bot('Create your account with the details below.');
    storeEvent('intent', 'UserRegistration');
  }

  function accountActions() {
    setMode('account');
    bot('Your account is ready. What would you like to do?', { actions: [['Modify account', 'edit', 'secondary'], ['Delete account', 'delete', 'danger']] });
  }

  function endConversation() {
    user('No, thank you'); bot(REGISTRATION_EXIT); setMode('idle'); storeEvent('conversation', 'ended');
  }

  function askSuggested(question) {
    answerQuestion(question);
  }

  function acknowledgeSentiment(trimmed) {
    const sentiment = analyzeSentiment(trimmed);
    if (sentiment.tone !== 'concern') return null;
    storeEvent('sentiment', sentiment.label);
    bot('I am sorry this has been frustrating. Let me help you get to the right answer.', {
      sentiment: sentiment.label,
      actions: [['Browse services', 'suggest-services', 'secondary'], ['Email support', 'support', 'link']],
    });
    return sentiment;
  }

  /**
   * Search AI path. When no confident match exists the bot shows related options,
   * the Pronix site link, and support email, per the alternate-flow requirement.
   */
  function answerQuestion(question, { alreadyEchoed = false } = {}) {
    const trimmed = question.trim();
    if (!trimmed) return;
    const intent = classifyIntent(trimmed);
    const result = bestAnswer(trimmed, filters);
    const sentiment = analyzeSentiment(trimmed);

    if (!alreadyEchoed) {
      user(trimmed);
      acknowledgeSentiment(trimmed);
    }
    storeEvent('intent', intent.intent + ' @' + intent.confidence);
    storeEvent('question', trimmed);

    if (result) {
      bot(result.answer, {
        source: result.category + ' - ' + result.title,
        sentiment: sentiment.label,
        link: result.url,
        actions: [['Ask another question', 'search', 'secondary'], ['Visit Pronix', 'site', 'link']],
      });
      storeEvent('search-hit', result.title);
    } else {
      const suggestions = relatedOptions(trimmed, filters)
        .filter((item) => item.category === 'Services')
        .slice(0, 2);
      bot('I could not find a precise answer for that yet. Here are a few related places to continue.', {
        fallback: true,
        actions: [
          ...suggestions.map((item) => [item.title, 'ask:' + item.answer, 'secondary']),
          ['Email support', 'support', 'link'],
          ['Visit Pronix', 'site', 'link'],
        ],
      });
      storeEvent('fallback', trimmed);
    }
    setInput(''); setMode('search');
  }

  function handleMessage(event) {
    event.preventDefault();
    const raw = input.trim();
    if (!raw) return;
    const intent = classifyIntent(raw);

    user(raw);
    // Acknowledge frustration before routing, so a complaint about the login
    // flow still receives the empathetic response.
    acknowledgeSentiment(raw);

    if (intent.intent === 'UserLogin') { beginLogin(false); setInput(''); return; }
    if (intent.intent === 'UserRegistration') { beginRegister(false); setInput(''); return; }
    if (intent.intent === 'AccountManagement') {
      if (profile) accountActions();
      else bot('Please log in first so I can find your account.', { actions: [['Login', 'login', 'primary']] });
      setInput('');
      return;
    }
    if (intent.intent === 'ContactSupport') {
      bot('You can reach the Pronix team at ' + SUPPORT_EMAIL + ', or book a session directly.', {
        actions: [['Email support', 'support', 'primary'], ['Visit Pronix', 'site', 'link']],
      });
      storeEvent('handoff', 'ContactSupport');
      setInput(''); setMode('search');
      return;
    }
    answerQuestion(raw, { alreadyEchoed: true });
  }

    async function submitLogin(event) {
      event.preventDefault();
      const email = normalizeEmail(loginEmail);
      const validation = validateLoginEmail(email);
    if (validation) { setError(validation); return; }
    setBusy(true); setError(''); user(email);
    try {
      const account = await findUserByEmail(email);
      if (!account) {
        setMode('not-found');
        bot(NOT_REGISTERED, { actions: [['Register now', 'register', 'primary'], ['Retry', 'login', 'secondary'], ['Cancel', 'end-login', 'link']] });
        storeEvent('login', 'not found');
        return;
      }
      setProfile(account); setAccountData(account);
      bot('Hello ' + (account.username || 'there') + '! You have successfully logged in.');
      storeEvent('login', 'success'); accountActions();
    } catch {
      setError(API_FAILURE); bot(API_FAILURE); storeEvent('api-error', 'login');
    } finally { setBusy(false); }
  }

  async function submitRegistration(event) {
    event.preventDefault();
    const validation = validateRegistration(registerData);
    if (validation) { setError(validation); return; }
    setBusy(true); setError(''); user('Register a new account');
    try {
      if (await findUserByEmail(registerData.email)) {
        setError('An account already exists for this email. Please log in instead.');
        bot('An account already exists for that email. Please log in to continue.', { actions: [['Login', 'login', 'primary']] });
        return;
      }
      const account = await createUser(registerData);
      setProfile(account); setAccountData(account); setMode('continue');
      bot(REGISTRATION_SUCCESS, { actions: [['Yes, continue', 'account', 'primary'], ['No, thanks', 'end', 'secondary']] });
      storeEvent('registration', 'success');
    } catch {
      setError(API_FAILURE); bot(API_FAILURE); storeEvent('api-error', 'registration');
    } finally { setBusy(false); }
  }

  async function saveAccount(event) {
    event.preventDefault();
    if (!profile) return;
    const validation = validateAccountUpdate(accountData);
    if (validation) { setError(validation); return; }
    setBusy(true); setError('');
    try {
      const account = await updateUser(profile.id, accountData);
      setProfile(account); setAccountData(account); setMode('account');
      user('Update my account'); bot('Your account details have been updated.', { actions: [['Account options', 'account', 'secondary']] });
      storeEvent('account', 'updated');
    } catch {
      setError(API_FAILURE); bot(API_FAILURE); storeEvent('api-error', 'update');
    } finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!profile) return;
    setBusy(true);
    try {
      await removeUser(profile.id); user('Delete my account'); bot('Your account has been deleted. Thank you for visiting Pronix.');
      setProfile(null); setAccountData({ username: '', email: '', phone: '', password: '' }); setMode('idle'); storeEvent('account', 'deleted');
    } catch {
      setError(API_FAILURE); bot(API_FAILURE); storeEvent('api-error', 'delete');
    } finally { setBusy(false); }
  }

  function action(value) {
    setError('');
    if (value.startsWith('ask:')) { answerQuestion(value.slice(4)); return; }
    if (value === 'login') beginLogin();
    else if (value === 'register') beginRegister();
    else if (value === 'account') { user('Continue'); accountActions(); }
    else if (value === 'edit') { user('Modify account'); setMode('edit'); bot('Update your account details below.'); }
    else if (value === 'delete') { user('Delete account'); setMode('delete'); bot('Are you sure you want to permanently delete this account?'); }
    else if (value === 'end') endConversation();
    else if (value === 'end-login') { user('Cancel'); bot(NOT_FOUND_EXIT); setMode('idle'); storeEvent('conversation', 'cancelled'); }
    else if (value === 'search') { setMode('search'); bot('Ask about Pronix services, case studies, insights, or delivery.'); }
    else if (value === 'site') window.open(WEBSITE_URL, '_blank', 'noopener,noreferrer');
    else if (value === 'support') window.location.href = 'mailto:' + SUPPORT_EMAIL;
    else if (value === 'suggest-services') askSuggested(SUGGESTED_QUESTIONS.services);
    else if (value === 'suggest-case') askSuggested(SUGGESTED_QUESTIONS.caseStudy);
  }

  function composer() {
    if (mode === 'login') return <form className="auth-form" onSubmit={submitLogin}><label>Registered email<input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" /></label>{error && <p className="form-error">{error}</p>}<button className="command primary full" disabled={busy}>{busy ? 'Checking account...' : 'Continue'}<ArrowRight size={16} /></button>{!isRemoteStoreEnabled() && <p className="demo-hint">Try maya@pronix.demo to test a registered account.</p>}</form>;
    if (mode === 'register') return <form className="auth-form form-grid" onSubmit={submitRegistration}><div className="form-title"><span>Account details</span><ShieldCheck size={18} /></div><label>Username<input value={registerData.username} onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })} autoComplete="name" /></label><label>Email<input type="email" value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} autoComplete="email" /></label><label>Phone number<input type="tel" value={registerData.phone} onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })} autoComplete="tel" /></label><label>Password<input type="password" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} autoComplete="new-password" /></label>{error && <p className="form-error">{error}</p>}<button className="command primary full" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}<ArrowRight size={16} /></button></form>;
    if (mode === 'edit' && profile) return <form className="auth-form form-grid" onSubmit={saveAccount}><div className="form-title"><span>Update account</span><Pencil size={18} /></div><label>Username<input value={accountData.username || ''} onChange={(e) => setAccountData({ ...accountData, username: e.target.value })} /></label><label>Email<input type="email" value={accountData.email || ''} onChange={(e) => setAccountData({ ...accountData, email: e.target.value })} /></label><label>Phone number<input type="tel" value={accountData.phone || ''} onChange={(e) => setAccountData({ ...accountData, phone: e.target.value })} /></label>{error && <p className="form-error">{error}</p>}<button className="command primary full" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}<Check size={16} /></button></form>;
    if (mode === 'delete' && profile) return <div className="delete-box"><strong>Delete {profile.username}'s account?</strong><p>This removes the stored profile and ends the active session.</p>{error && <p className="form-error">{error}</p>}<div><button className="command secondary" onClick={() => accountActions()}>Keep account</button><button className="command danger" onClick={deleteAccount} disabled={busy}><Trash2 size={16} />{busy ? 'Deleting...' : 'Delete'}</button></div></div>;
    return <form className="message-form" onSubmit={handleMessage}><button className="icon-button" type="button" aria-label="Search Pronix knowledge" title="Search Pronix knowledge" onClick={() => action('search')}><Search size={18} /></button><input value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode === 'search' ? 'Search Pronix knowledge...' : 'Message Pronix AI...'} aria-label="Message Pronix AI" /><span className={'sentiment ' + sentiment.tone}><SentimentIcon size={14} />{sentiment.label}</span><button className="icon-button send" type="submit" aria-label="Send message" title="Send message"><Send size={17} /></button></form>;
  }

  return <div className="app-shell">
    <aside className={'sidebar ' + (sidebarOpen ? 'open' : '')}>
      <div className="brand"><span>p</span><strong>pronix</strong><small>AI</small></div>
      <nav aria-label="Pronix sections"><button className="nav-link current"><Sparkles size={18} />Assistant</button><a className="nav-link" href={WEBSITE_URL} target="_blank" rel="noreferrer"><BriefcaseBusiness size={18} />Services<ExternalLink size={14} /></a><a className="nav-link" href={WEBSITE_URL} target="_blank" rel="noreferrer"><ClipboardList size={18} />Case studies<ExternalLink size={14} /></a><a className="nav-link" href={WEBSITE_URL} target="_blank" rel="noreferrer"><FileText size={18} />Insights<ExternalLink size={14} /></a></nav>
      <div className="sidebar-bottom"><div className="connection"><i></i><span><strong>{isRemoteStoreEnabled() ? 'MockAPI connected' : 'Local demo data'}</strong><small>{isRemoteStoreEnabled() ? 'Remote user store active' : 'Set endpoint to enable REST'}</small></span></div><button className="profile" onClick={() => profile ? accountActions() : beginLogin()}><b>{profile ? profile.username.slice(0, 1).toUpperCase() : <UserRound size={18} />}</b><span><strong>{profile ? profile.username : 'Guest visitor'}</strong><small>{profile ? 'Account active' : 'Sign in to continue'}</small></span><ChevronRight size={16} /></button></div>
    </aside>
    {sidebarOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <main>
      <header className="topbar"><button className="icon-button menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><div><span>Pronix AI</span><ChevronRight size={15} /><strong>Conversational assistant</strong></div><section><a href={WEBSITE_URL} target="_blank" rel="noreferrer">pronix.ai <ExternalLink size={14} /></a><button className="icon-button" title="Assistant settings" aria-label="Assistant settings"><Settings2 size={18} /></button></section></header>
      <div className="workspace">
        <section className="experience">
          <div className="intro"><p className="eyebrow"><i></i>Enterprise AI and CX systems</p><h1>Make your next production move with confidence.</h1><p>Ask about Pronix capabilities, practical delivery paths, and the systems behind an enterprise-ready AI experience.</p><div><button className="command primary" onClick={() => answerQuestion('What services does Pronix offer?')}>Explore services<ArrowRight size={16} /></button><button className="command secondary" onClick={() => answerQuestion('How long does a production agent take?')}>Delivery timeline</button></div></div>
          <div className="visual"><div><span>Connect. Orchestrate. Operate.</span><strong>One governed path from inquiry to outcome.</strong></div><img src={workforceImage} alt="Connected workforce and conversational intelligence interface panels" /></div>
          <div className="service-list">{[['Contact center AI', 'Voice AI, agent assist, automated quality, and CCaaS modernization.', MessagesSquare], ['Enterprise agentic AI', 'Governed agents that retrieve, reason, and complete work.', Bot], ['Business automation', 'Intake, documents, decisions, and exception handling.', ClipboardList]].map(([title, detail, Icon]) => <button key={title} className="service" onClick={() => answerQuestion('Tell me about ' + title)}><span><Icon size={19} /></span><div><strong>{title}</strong><small>{detail}</small></div><ArrowRight size={17} /></button>)}</div>
          <div className="data-area"><section><header><div><span>Search AI</span><h2>Knowledge sources</h2></div><button className="icon-button" title="Search indexed knowledge" aria-label="Search indexed knowledge" onClick={() => action('search')}><Search size={18} /></button></header>{sources.map(([name, Icon, detail]) => <div className="source" key={name}><span><Icon size={17} /></span><div><strong>{name}</strong><small>{detail}</small></div><CheckCircle2 size={18} /></div>)}</section><section><header><div><span>Automation</span><h2>Visitor signals</h2></div><b className="live"><i></i>Live</b></header><div className="signals"><p><span>Intent routing</span><strong>Search fallback ready</strong></p><p><span>Sentiment analysis</span><strong>In session</strong></p><p><span>Preferred channel</span><select defaultValue="Website" aria-label="Preferred channel"><option>Website</option><option>WhatsApp</option><option>Telegram</option></select></p></div></section></div>
        </section>
        <aside className="assistant">
          <header><span className="bot-avatar"><Bot size={19} /></span><div><h2>Pronix virtual assistant</h2><small><i></i>Available now</small></div><button className="icon-button" title="Start a new conversation" aria-label="Start a new conversation" onClick={() => { setMessages(starterMessages); setMode('welcome'); setError(''); }}><RefreshCw size={17} /></button></header>
          {mode === 'search' && <div className="search-bar"><span><Database size={16} />Search filters</span><div className="search-filters"><select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Knowledge category"><option value={ALL}>{ALL} categories</option>{categories().map((value) => <option key={value}>{value}</option>)}</select><select value={serviceType} onChange={(e) => setServiceType(e.target.value)} aria-label="Service type"><option value={ALL}>{ALL} service types</option>{serviceTypes().map((value) => <option key={value}>{value}</option>)}</select><select value={blogTag} onChange={(e) => setBlogTag(e.target.value)} aria-label="Blog tag"><option value={ALL}>{ALL} blog tags</option>{blogTags().map((value) => <option key={value}>{value}</option>)}</select></div></div>}
          <div className="messages" aria-live="polite">{messages.map((message) => <Bubble key={message.id} message={message} runAction={action} />)}</div>
          <div className="suggestions"><button onClick={() => askSuggested(SUGGESTED_QUESTIONS.services)}>Services</button><button onClick={() => askSuggested(SUGGESTED_QUESTIONS.caseStudy)}>Case study</button><button onClick={() => askSuggested(SUGGESTED_QUESTIONS.timeline)}>Timeline</button><button onClick={() => askSuggested(SUGGESTED_QUESTIONS.cost)}>Pricing</button><button onClick={() => askSuggested(SUGGESTED_QUESTIONS.governance)}>Governance</button></div>
          <div className="composer">{composer()}</div><footer><span><ShieldCheck size={14} />Session-aware assistance</span><a href={'mailto:' + SUPPORT_EMAIL}><Mail size={14} />Support</a></footer>
        </aside>
      </div>
    </main>
  </div>;
}

function Bubble({ message, runAction }) {
  const isBot = message.author === 'bot';
  const Icon = isBot ? Bot : UserRound;
  return <article className={'bubble-row ' + (isBot ? 'bot' : 'user')}><span className="bubble-avatar"><Icon size={15} /></span><div><p className="bubble-meta"><strong>{isBot ? 'Pronix AI' : 'You'}</strong><span>{message.time}</span></p><div className="bubble"><p>{message.content}</p>{message.source && <small className="source-tag"><Database size={13} />{message.source}</small>}{message.sentiment && <small className="message-sentiment">{message.sentiment}</small>}{message.link && <a className="source-link" href={message.link} target="_blank" rel="noreferrer">Source<ExternalLink size={13} /></a>}{message.fallback && <a href={WEBSITE_URL} target="_blank" rel="noreferrer">{WEBSITE_URL.replace('https://', '')}<ExternalLink size={13} /></a>}</div>{message.actions && <div className="bubble-actions">{message.actions.map(([label, action, tone]) => <button className={tone} key={label} onClick={() => runAction(action)}>{label}{tone === 'link' && <ExternalLink size={13} />}</button>)}</div>}</div></article>;
}

export default App;
