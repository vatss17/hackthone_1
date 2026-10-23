# Demo access: policy and how to use it safely

## What exists
A **synthetic demonstration company** ("DEMO · Sample Polymers Pvt Ltd (sample data)") with one factory, five machines, three materials and sample products. Every record is fictional and the app shows a "Demo scenario" banner whenever a DEMO company is open.

## How to get it (local or development project only)
```bash
npm run demo:create     # creates the demo account and company
npm run demo:reset      # deletes the demo account, archives its company, creates a fresh one
npm run demo:destroy    # removes it
npm run demo:status
npm run demo:preflight  # read-only checks before a presentation
```
The commands refuse to run unless the project is the designated development project, and they refuse to touch any account that is not marked as the synthetic demo account.

## Credentials: why there is no "Try the demo" button
The demo account has a **random password kept in the git-ignored `.env.demo.local`**, created on your machine and never printed or committed. An in-app one-click demo would need either a published shared password or a sign-in bypass. Both are refused on purpose: a shared password is a shared production credential, and a bypass is an authentication hole. So demo access stays an operator action: the person running the demonstration creates the account and signs in with the password from their own file.

## Reset policy
- Demo data is disposable. Reset it before every demonstration (`npm run demo:reset`) and after anyone has experimented with it.
- Saved work (calculator inputs, screening answers, roadmap notes, drafts) lives in the browser. It is not cleared by a reset of the database. Use a fresh browser profile, or the browser's site data controls, for a clean run.
- Never enter real company or customer information in the demo company.
- Never run the demo commands against a production project (they will refuse, and the app never runs them in production).
- Archived demo companies are kept, not deleted, in line with the rule that business records are archived rather than destroyed.

## For a public deployment
Do not publish demo credentials. If prospects need to try the product, give each of them their own account with their own email confirmation, or schedule a guided session.
