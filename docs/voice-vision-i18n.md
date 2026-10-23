# Voice, photo and language support

Three features share one rule: **AI proposes, the person confirms, the existing form saves.** Nothing here writes to the database.

## Languages (English, Hindi, Gujarati)
- `src/lib/i18n/`: the English source string is the message key. `t("Save")` (client, `useT()`) or `const { t } = await getT()` (server, inside Suspense). A missing Hindi or Gujarati entry falls back to the English text.
- Dictionaries live in `src/lib/i18n/messages/` (`core.ts` plus one file per section, merged in `sections.ts`). Terminology: `docs/i18n-glossary.md`.
- The choice is stored in the `atlas-locale` cookie (read by the server) and in localStorage. Switching refreshes server-rendered text without a page reload, so typed form text is kept. Stored data is language-independent: only interface text is translated.
- Never translated: HS codes, polymer names and grades, units, currency codes, numbers, and the content of commercial invoices and packing lists.
- Fonts: Noto Sans Devanagari and Noto Sans Gujarati are the fallback for Plex Sans.
- Why not `next-intl`: the app uses cache components and cookie-based language without URL routing, which would make every public page dynamic. This small dictionary system keeps public pages static.
- `npm run test:i18n` fails if any `t("…")` string in the source lacks a Hindi or Gujarati entry, uses the wrong script, drops a `{placeholder}`, or changes a protected token.

## Photo and document reading
- `POST /api/ai-input/vision` (multipart: `file`, `kind`, `consent=1`, `locale`). Kinds: nameplate, machine photo, material label, product photo, drawing/specification sheet.
- Checks before anything is sent: signed-in company member, consent for this request, per-user hourly limit, file type from the first bytes, 4 MB limit. The browser shrinks photos to 1600 px JPEG, which also removes EXIF data.
- The image goes to the configured AI provider (Gemini) for this one request and is dropped: no storage, no logging of images, prompts or answers.
- Every answer is validated (`src/lib/ai-input/vision.ts`): fixed field table, labels from our table, HS codes, throughput, prices and compliance claims dropped, photos cannot claim to have "read" a specification, units kept exactly as printed, numbers with no unit flagged.
- The review screen marks each value *read from the image*, *AI guess* or *not readable*. Only ticked values are added to the form (`src/lib/ai-input/mappings.ts` chooses the field; it never converts units).

## Voice input
- Engine order: Gemini audio (best for Hindi, Gujarati and mixed speech, same on every browser) → the browser's own speech recognition when AI is off → typing. Recording starts only when the person presses the button (the browser asks for the microphone then), stops the moment they press Stop or after 60 seconds, and the microphone is released each time.
- Audio is converted in the browser to 16 kHz mono WAV. `POST /api/ai-input/voice` returns an editable transcript plus, for factory and product forms, proposed field rows with the phrase they came from.
- With no AI, a word matcher (`local-extract.ts`) finds known processes, polymers and number words in English, Hindi, Gujarati and Hinglish, and says exactly what it matched.
- Text is added after what a field already holds; proposed values go in only when ticked and confirmed.

## Credentials
- Supported providers: `gemini` (`GEMINI_API_KEY`), `anthropic` (`ANTHROPIC_API_KEY`; photos only, no audio) and `openrouter` (`OPENROUTER_API_KEY`, key prefix `sk-or-v1-`; default model `google/gemini-3.8-flash`, which reads images, PDFs and audio). Set `AI_PROVIDER`, the key and `AI_DATA_APPROVED=1` in `.env.local` only, never in the browser bundle.
- OpenRouter audio requests need at least $0.50 of account balance (a 402 error otherwise); images and text work with less.
