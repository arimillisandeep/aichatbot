# Submission package

Everything to hand in, in one place. Verified 1 October 2026.

---

## 1. Links to paste into the submission

| What | Link | Notes |
| --- | --- | --- |
| **Live application** | `https://aicharbot.vercel.app` | Public, no login. Primary deliverable link. |
| **Telegram bot** | `https://t.me/PronixAIChatbotSandeepBot` | Say "Start" in the chat to open it. |
| **Kore.ai builder** | `https://platform.kore.ai/builder/app/automationdialoggpt/automationconversationorchestration` | Requires the signed-in Kore account. |
| **Kore.ai publish page** | `https://platform.kore.ai/builder/app/publish` | Shows published dialog tasks. |
| **Source repository** | *not yet available* | See section 5 — no commits, no remote. |

Copy-paste block:

```
Live app:     https://aicharbot.vercel.app
Telegram:     https://t.me/PronixAIChatbotSandeepBot
Kore builder: https://platform.kore.ai/builder/app/automationdialoggpt/automationconversationorchestration
```

---

## 2. Files to attach

| File | Purpose |
| --- | --- |
| `output/Pronix-Kore-XO-Assignment.pdf` | The report — read-only, submit this |
| `output/Pronix-Kore-XO-Assignment.pptx` | Slide deck, 16 slides, editable |
| `output/Pronix-Kore-XO-Assignment-Report.docx` | The report in Word, if editable format is required |
| `README.md` | Setup and architecture |
| `docs/assignment-status.md` | Full evidence log for every requirement |

Prefer the **PDF** for the report. If the submission asks for one document plus
one deck, send the PDF and the PPTX.

---

## 3. One-paragraph summary

> A Kore.ai XO virtual assistant for the Pronix platform, deployed at
> `https://aicharbot.vercel.app`. It answers from a 260-document knowledge base
> crawled live from the Pronix site using hybrid retrieval with source
> citations, routes across eight trained intents, and handles login,
> registration and account CRUD against a live REST resource. Verified by 101
> passing automated tests, a clean lint and production build, and a smoke test
> that exercises real registration and login. The Telegram channel is enabled;
> WhatsApp is blocked pending Meta Business verification.

---

## 4. What to say if asked about gaps

Be direct — the documentation already states these, so there is no version of
the conversation where claiming otherwise survives contact with the builder.

- **Required copy is 2 of 7 verified in Kore XO.** All seven are implemented and
  asserted in the deployed app. The remainder still need applying in the builder.
- **Search AI collection and intent training are mapped but not trained in Kore.**
  The retrieval and classification logic is built, tested and deployed locally.
- **The Kore builder's write APIs are unreliable** — dialog updates return 412,
  component edits silently discard text, published dialogs cannot be unpublished
  due to a platform privilege limit. Documented with reproduction evidence in
  `docs/assignment-status.md`.
- **Welcome Chat Flow is in draft**, so Telegram still serves the older greeting
  until it is republished.
- **WhatsApp is blocked** on Meta Business verification, which needs a verified
  business account the project owner must complete.

---

## 5. Repository link — needs action

There is currently **no source repository link** to submit:

- The local git repo has **no commits at all** (`master`, empty history).
- **No remote is configured.**
- **GitHub CLI (`gh`) is not installed**, so this could not be automated.

To produce a link, do this:

```bash
cd "C:\Users\Arimilli sandeep\Documents\ChatGPT\aicharbot"

git add .
git commit -m "Pronix Kore.ai XO virtual assistant: build, tests, docs, deployment"

gh repo create pronix-xo-assistant --private --source=. --push
```

If you would rather not install `gh`, the equivalent by hand is: create an empty
repository on github.com, then

```bash
git remote add origin https://github.com/<your-user>/<repo>.git
git push -u origin master
```

A **private** repository is usually the right call for employer work. Add the
repository link to the table in section 1 once it exists.

---

## 6. Before you submit — checklist

- [ ] Open the live URL on a phone, on mobile data, to confirm it is not just
      working on your own Wi-Fi.
- [ ] Scroll the slide PDF end to end — geometry was machine-verified, but text
      wrapping and spacing were not visually checked.
- [ ] Create the repository and add its link.
- [ ] Confirm which deck you are submitting: the 16-slide one from this session,
      or the 30 Sep `..._Final_Audited_v2.pptx` from the earlier pass. Both sit in
      `output/` and they are not the same file.
- [ ] If submitting Kore.ai evidence, screenshot the builder showing the dialog
      tasks and the publish page — access needs your account, so a reviewer cannot
      follow the link unaided.