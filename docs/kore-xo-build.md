# Kore.ai XO Build Guide

`npm run spec` regenerates `docs/kore-xo-bot-spec.json` from the working code. It contains the intent list with utterances, dialog-task node structure, entity validations, REST mappings, Search AI configuration, monitoring events, and channel status. Use it as the input for the platform work below rather than retyping it.

## Before configuration

Create personal accounts at https://academy.kore.ai/ and https://platform.kore.ai/auth/login. The Academy Google sign-in step must be performed by the student using their personal email. Create the MockAPI users resource described in the README before adding REST Service nodes.

## Bot structure

Create a new XO bot named Pronix Virtual Assistant. Add the following intents and connect each to a Dialog Task.

| Intent | Dialog Task | Training utterances |
| --- | --- | --- |
| Greeting | Welcome and authentication | hello; hi; good morning; I need help; can you help me; start chat |
| UserLogin | Login Flow | log in; login; sign in; access my account; I want to log into my account; open my account |
| UserRegistration | Signup Flow | register; sign up; create an account; I am a new user; make a new account; join Pronix |
| AccountManagement | Account Options | change my account; edit my profile; update my phone number; delete my account; remove my profile; account settings |
| PronixServices | Service Discovery | what services do you offer; tell me about Pronix services; contact center AI; agentic AI services; business automation; how can Pronix help us |
| CaseStudySearch | Case Study Search | show a case study; do you have a Kore.ai example; customer success story; banking automation example; show outcomes; latest case studies |
| PronixInsights | Insights Search | show me a blog; enterprise AI guide; how do I move from pilot to production; governance guidance; latest Pronix article; AI trends |
| ContactSupport | Contact and Handoff | contact Pronix; email support; talk to a person; schedule a session; get in touch; I need help from the team |

Train the model after adding all utterances. Test each intent in the NLP Training console and add missed phrasing from the test results.

## Dialog Task 1: Signup Flow

1. Start with a Message node: Hello! Welcome to our Virtual Assistant.
2. Add a Choice node with Login and Register.
3. Connect Register to Entity nodes for username, email, phone number, and password.
4. Email entity validation: a valid email format is required.
5. Phone entity validation: require a valid phone number pattern.
6. Password entity validation: require at least eight characters.
7. Add a Service node that POSTs to the MockAPI users resource with username, email, phone, and password in JSON.
8. On a successful response, send: Registration successful! Would you like to continue?
9. Add a Yes or No Choice node. Yes routes to Account Options; No sends: Thank you! Have a great day.
10. On a Service node error, send: Something went wrong. Please try again later.

## Dialog Task 2: Login Flow

1. Prompt for the registered email with email validation.
2. Use a Service node to GET the MockAPI users resource. Filter or inspect the response for a matching email.
3. If a record is found, store username and record id in context variables.
4. Send: Hello {{context.username}}! You have successfully logged in.
5. Route to Account Options with Modify Account and Delete Account choices.
6. If no record is found, send: This email is not registered. Would you like to create a new account?
7. Add Register Now, Retry, and Cancel choices. Register Now routes to Signup Flow; Retry loops back to email collection; Cancel sends: No problem! Have a great day.
8. On a Service node error, send: Something went wrong. Please try again later.

## Account Options

Modify Account should collect the changed username, email, or phone number and call PUT on the MockAPI users resource plus the context record id. Delete Account should ask for confirmation and call DELETE on the same resource plus record id. Add success and error messages to both outcomes.

## Search AI and knowledge graph

1. In Search AI, create a knowledge collection named Pronix Public Knowledge.
2. Add the website crawler starting URL https://pronix.ai/. The assignment URL http://www.pronixinc.com currently redirects there.
3. Index pages for services, case studies, blog or insights, and About Pronix. Upload any approved company PDFs as a separate document source.
4. Create metadata fields named content_type, service_type, category, and blog_tag.
5. Configure a keyword ranker and a semantic ranker. Test questions against both and prefer the mixed or hybrid result that produces the clearest cited answers.
6. Add filters for service_type, category, and blog_tag in the Search AI response configuration.
7. In the bot's standard response or interruption flow, configure an unmatched-intent fallback that invokes Search AI.
8. When Search AI has no result, offer related options, the Pronix site link, and info@pronix.ai.

## REST request mapping

Use the MockAPI resource URL in a secure environment or bot configuration variable. Do not place credentials or personal data directly in a Dialog Task.

| Action | Method | Endpoint | Response handling |
| --- | --- | --- | --- |
| Find user | GET | users resource | Match the response email to the email entity. |
| Register | POST | users resource | Store username, email, phone, and password only for this prototype. |
| Update user | PUT | users resource plus context record id | Replace the changed profile fields. |
| Delete user | DELETE | users resource plus context record id | Clear authenticated context after success. |

For a real deployment, replace MockAPI with a secured backend that hashes passwords, returns a minimal profile shape, enforces authorization, and writes audit logs.

## Sentiment and monitoring

Enable sentiment analysis in the XO bot settings or use the platform's sentiment entity or service response where available. Route negative sentiment to an empathetic acknowledgement and the ContactSupport intent when needed.

Log intent name, question text, channel, confidence, Search AI fallback result, REST status, and handoff outcome. Review unmatched phrases and repeated fallbacks weekly, then add approved answers and new training utterances.

## Web, WhatsApp, and Telegram

1. Deploy the bot's Web SDK to the Pronix website using the XO channel installation snippet.
2. In Channels, add WhatsApp. Complete the Meta Business and phone-number verification steps requested by the platform, then map the same dialog tasks and test opt-in messaging.
3. In Channels, add Telegram. Create a bot with BotFather, enter the Bot API token in Kore.ai, configure the webhook through the channel flow, and test the same login, search, and fallback paths.
4. Keep a channel-specific test matrix for greeting, login success, unknown email, registration, search fallback, API failure, and live-agent handoff.

Channel credentials, Meta verification, and Telegram bot tokens are account-specific actions and should be added by the project owner in the Kore.ai platform rather than stored in this repository.

## Telegram deployment

1. In Telegram, open `@BotFather`, run `/newbot`, and keep the generated Bot API token in a password manager. Treat this token as a secret: anyone with it has full control of the bot.
2. In the Kore.ai assistant, open Channels and Flows, select Channels, then choose Telegram from the Digital channel catalog.
3. Paste the Bot API token directly into the Kore.ai Telegram configuration and save or enable the channel. Do not add the token to `.env`, source code, Git, screenshots, or assignment submissions.
4. Publish the assistant version that contains the Pronix dialog tasks. Kore.ai registers and manages the Telegram channel webhook as part of the channel setup.
5. In Telegram, open the bot's `t.me/<bot-username>` link, select Start, and test registration, valid login, unknown-email recovery, Search AI fallback, and the API-error message.
6. Record the bot username, deployment date, test results, and any failed messages in the assignment report. Rotate the BotFather token immediately if it is ever exposed.

Telegram bots cannot start a private conversation; the user must open the bot and send the first message. This is expected behavior, not a deployment error.
