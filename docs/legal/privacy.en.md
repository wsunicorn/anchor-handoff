# Privacy Policy — Anchor

*Updated 18 September 2026. Vietnamese version: privacy.vi.md.*

Anchor is a study app: you import documents (PDF), ask questions answered with citations, review with flashcards and get feedback on essays. Your documents are yours. This policy says what data is processed, where, and how you stay in control.

## 1. Data we store

| Data | Purpose | Where |
|---|---|---|
| Email address | Sign-in with a one-time code (no password) | Supabase (Singapore) |
| Documents you import: original file, page images, extracted text and embeddings | Q&A, quiz generation, essay feedback — only on your own documents | Supabase Storage + Postgres, isolated per account (RLS) |
| Questions, answers, verification results | Show history; measure citation quality | Supabase |
| Review cards and schedule | Offline review and sync across devices | Your device (SQLite) + Supabase |
| Essays and feedback | Revisit feedback | Supabase |
| Token counts and estimated cost per AI call | Quotas, abuse prevention, pricing | Supabase |
| A pseudonymous id (SHA-256 of your account id) and app events (open document, ask, review) | Bug fixing, funnel metrics | Sentry, PostHog (USA) — **never** with email or document content |

We do not collect location, contacts, or photos other than the ones you deliberately take of handwritten essays, and we show no ads.

## 2. Third parties and when they receive data

- **Google (Gemini API)** — receives your **document text** and **questions/essays** to answer, generate quizzes, grade essays and transcribe handwriting. Only after you tap **Agree** on the "Before you use AI features" screen; you can turn it off anytime in the **Me** tab — after that nothing leaves your device. Under Google's paid API terms, data sent through the API is not used to train models.
- **Supabase** — database, file storage and authentication; servers in Singapore.
- **Sentry** (crash reports) and **PostHog** (analytics) — pseudonymous ids and events only; no document content.
- **RevenueCat** with **Google Play / Apple App Store** — payment processing; we never see card numbers.
- **Brevo** — sends sign-in code emails.

## 3. Your rights

- **View and delete documents** anytime in the Library.
- **Delete your account** in **Me → Delete account**: everything in section 1 is deleted immediately; system backups are purged within 30 days. There is no undo.
- **Turn off AI features** in the Me tab.
- Other requests (data export, complaints): email privacy@anchor.app. We reply within 7 days.

## 4. Children

Anchor is for people aged 13 and over. If you learn that a child under 13 has created an account, tell us and we will delete it.

## 5. Changes

When we change AI provider or collect new data, we update the in-app consent screen and the date at the top of this page.
