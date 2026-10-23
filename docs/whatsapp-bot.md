# WhatsApp bot

A chat version of the website's "set up by chatting". A manufacturer messages the Atlas WhatsApp number, answers four short questions, and gets the products their machines suit, with a link to continue on the website.

## What it does and does not do
- Reuses the website's chat logic (`src/lib/start/chat-flow.ts`) and opportunity engine, so both always agree.
- **No model is called** and nothing is written to the database. It reads answers by word matching (English, Hindi and Gujarati words).
- Remembers only the answers given so far, for 24 hours, under a hash of the phone number. "stop" deletes it at once.
- Replies are English only for now. Text messages only: voice notes and photos get a polite "please type".
- The result is capability fit from declared machines. It is not market demand and says so.

## Pieces
| File | Job |
| --- | --- |
| `src/lib/whatsapp/bot.ts` | the conversation, a pure function |
| `src/lib/whatsapp/session-store.ts` | memory store (dev) and Redis-over-REST store (production) |
| `src/lib/whatsapp/meta.ts` | signature check, message parsing, sending |
| `src/app/api/whatsapp/route.ts` | the webhook (GET verification, POST messages) |

## Set up (Meta WhatsApp Cloud API)
1. developers.facebook.com: create an app (type Business), add the **WhatsApp** product. It gives a free test number.
2. From WhatsApp > API Setup note the **Phone number ID** and a **temporary access token** (for a permanent one, create a System User token in Business Settings). From App settings > Basic note the **App secret**.
3. Add the test recipient (your own phone) on the same page.
4. In Vercel add: `WHATSAPP_VERIFY_TOKEN` (any long random string you choose), `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.
5. Add storage: Vercel > Storage > Marketplace > **Upstash Redis**. It adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Without it the bot works only while one server instance stays warm.
6. Redeploy, then in WhatsApp > Configuration set Callback URL to `https://<your-domain>/api/whatsapp` and the Verify token to the value from step 4. Subscribe to the **messages** field.
7. Message the test number "hi".

The route answers 503 until all four variables are set. Every POST must carry a valid `X-Hub-Signature-256`.

## Going public
The test number only talks to people you add. To message anyone you need a verified Meta business, your own number, and an approved display name. Replies inside 24 hours of a customer's message are free-form; anything later needs an approved template.

## Tests
`npm run test:whatsapp`
