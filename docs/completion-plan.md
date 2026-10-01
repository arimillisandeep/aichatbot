# Completion runbook

Everything needed to finish the Kore.ai XO app, in the order that avoids
wasted work. Roughly 90 minutes of builder time.

Verify at each gate with:

```bash
npm run verify:copy
```

## Before you start

- Sign in at <https://platform.kore.ai/builder/home> and open
  **Conversation_AI_ChatBot_Pronix**.
- The trial has 12 days left as of 1 October 2026. Work through phases 1 to 4
  first, since they carry the required copy.
- **Unpublish before editing.** Published dialogs and flows reject changes.
  That is why `User Registration` and `Welcome Chat Flow` are currently locked.

## Phase 0 — Already done, do not redo

- React chatbot in this repo: 101 tests passing, build clean.
- 260 documents crawled from `pronix.ai` in `src/data/knowledge.json`.
- Kore spec with 8 intents at 6 to 8 utterances each in
  `docs/kore-xo-bot-spec.json`.
- MockAPI users resource wired and smoke-tested.

## Phase 1 — Greeting (5 min)

**Flows & Channels > Start Flows > Welcome Chat Flow**

1. Unpublish the flow.
2. Open `MessagePrompt0002`, currently `Welcome!`.
3. Replace with exactly:

   ```
   Hello! Welcome to our Virtual Assistant.
   ```

4. Open `MessagePrompt0003`, currently `Thank you!`. Replace with:

   ```
   No problem! Have a great day.
   ```

5. Save, then republish.

This flow has no choice node in its palette, so Login and Register cannot be
quick replies here. Ask for them in the greeting text and route them from the
`User Login` dialog instead.

Gate: `npm run verify:copy` should show 2 of 7.

## Phase 2 — Login flow (20 min)

**Dialogs > User Login.** Already in development, so no unpublish needed.

Current order: `User_Login` intent to `Entity0003` to `loginLookupNotice` to
`findUserByEmail` to `Message0002`.

1. `Message0002` currently reads `Sample message for the user`. Set it to the
   success line. Check the `findUserByEmail` response mapping for the username
   field and use it:

   ```
   Hello {{<username field path>}}! You have successfully logged in.
   ```

2. Add email validation on `Entity0003`: a format rule for the email entity.

3. From `findUserByEmail`, add the not-found branch with:

   ```
   This email is not registered. Would you like to create a new account?
   ```

4. Add a dialog action under that message with three options:
   - **Register Now** — jump to the `User Registration` dialog task.
   - **Retry** — loop back to `Entity0003`.
   - **Cancel** — send `No problem! Have a great day.`

5. Add an error branch on the service node for a failed API call:

   ```
   Something went wrong. Please try again later.
   ```

6. On the found branch, after the success line, add dialog actions for
   **Modify Account** and **Delete Account**.

Gate: 5 of 7.

## Phase 3 — Registration flow (15 min)

**Dialogs > User Registration.** **Unpublish first**, it is currently published.

Current order: `User_Registration` intent to `Entity0001` to `Entity0002` to
`ContinueRegistration` to `SubmitRegistration`.

1. Confirm the POST service node points at the users resource and maps
   username, email, phone, and password:

   ```text
   https://6abd2bab5121d616d90cc9c7.mockapi.io/api/v1/users
   ```

2. `Entity0001` currently reads `Please provide your input`. Replace with
   `What is your username?` and confirm it captures the username.

3. `ContinueRegistration` currently reads
   `Would you like to continue entering your contact details?` and asks **before**
   the submit node. Replace with:

   ```
   Would you like to continue entering your contact details?
   ```

   Keep its Yes branch looping back to `Entity0001`.

4. `SubmitRegistration` is the **terminal** node, so it is where the success
   line belongs. It currently reads
   `Would you like to submit your Pronix registration?`. Replace with:

   ```
   Registration successful! Would you like to continue?
   ```

5. Under it, branch on Yes to **Modify Account** and **Delete Account** dialog
   actions, and on No to `Message0001`, which currently reads
   `Sample message for the user`. Set `Message0001` to:

   ```
   Thank you! Have a great day.
   ```

6. Add an error branch on the POST node:

   ```
   Something went wrong. Please try again later.
   ```

7. Save and republish.

Gate: **7 of 7.** Do not continue until this passes.

## Phase 4 — Intents and training (25 min)

**Dialogs > Manage Components > Intents**

The app has only `User_Login` and `User_Registration` from the assignment. Six
more are needed. `docs/kore-xo-bot-spec.json` carries 6 to 8 utterances for each
of the eight, in this order: `Greeting`, `UserLogin`, `UserRegistration`,
`AccountManagement`, `PronixServices`, `CaseStudySearch`, `PronixInsights`,
`ContactSupport`.

1. Create the six missing intents and paste their utterances.
2. Map `Greeting` to a new dialog task that offers Login and Register, then
   routes to the two existing tasks. This is where the choice nodes belong.
3. Map `AccountManagement` to the Modify and Delete paths from phases 2 and 3.
4. Map `PronixServices`, `CaseStudySearch`, and `PronixInsights` to Search AI
   answer generation rather than scripted dialogs.
5. Map `ContactSupport` to the agent transfer.

## Phase 5 — Search AI collection (25 min)

**Search AI** in the left nav.

1. Create the collection `Pronix Public Knowledge`.
2. Add the web crawler starting at `https://pronix.ai/`. The assignment URL
   `http://www.pronixinc.com` redirects there.
3. Upload `src/data/knowledge.json` as a document source so the 260 already
   crawled documents are indexed too.
4. Set retrieval to hybrid with a keyword ranker and a semantic ranker.
5. Add the metadata fields `content_type`, `service_type`, `category`, and
   `blog_tag`.
6. Build the three filters: service type, category, blog tag.
7. Wire the Search AI node to the `FallbackMsg` transition on the Fallback
   Task. The Playground currently answers a services question with
   "I could not understand that."

## Phase 6 — Publish and verify (10 min)

1. **Deploy > Publish**, include Dialog Tasks, FAQs, Natural language, and
   Settings, then Proceed.
2. Test in the **Playground**:
   - `What services do you offer?` must return a services answer, not a
     fallback apology.
   - `I want to register` must reach the signup flow.
   - `Login` with a known email must return the success greeting.
   - `Login` with an unknown email must offer Register Now, Retry, Cancel.
3. `npm run verify:copy` must report 7 of 7.

## Phase 7 — Channels (10 min)

- **Telegram**: already enabled as `@PronixAIChatbotSandeepBot`. Retest after
  publishing, since Telegram only serves the published version.
- **Web**: install the XO Web SDK snippet on the Pronix site. Open the
  Web/Mobile Client channel in the builder to copy the snippet.
- **WhatsApp**: blocked on Meta Business verification and a verified number
  owned by the project owner. Nothing to do until that exists.

## Phase 8 — Optional, and worth doing

Deploy this repository so there is a shareable link:

```bash
npm run build
```

Then deploy `dist/` to any static host. The React app is the tested reference
implementation and already satisfies most of the assignment on its own.
