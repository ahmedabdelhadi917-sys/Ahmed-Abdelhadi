# Beyond the Pitch — Quiz Arena (starter MVP)

This is a real application starter, not a hosted public website yet. It includes:
- React + Vite frontend
- Firebase anonymous guest authentication
- Guest-to-email/password account upgrade (keeps the same Firebase UID)
- Cloud Functions for server-side quiz sessions and score validation
- Firestore live leaderboard listener
- Firestore security rules that prevent browsers from writing scores
- Navy & gold responsive interface

## Important current limits
- The included question bank has 5 reviewed starter questions, not 500.
- The first Cloud Function returns up to 5 questions because the starter bank is small.
- Weekly rankings, head-to-head matches, anti-cheat telemetry, moderation, and production analytics are not implemented yet.
- Do not advertise this as a live global competition until deployed and tested.

## 1. Create Firebase project
1. Open https://console.firebase.google.com/
2. Create a project named `beyond-the-pitch-quiz-arena`.
3. Add a Web App and copy its Firebase config into `src/firebase.js`.
4. Enable Authentication → Sign-in method → Anonymous and Email/Password.
5. Create a Cloud Firestore database.
6. Install Firebase CLI: `npm install -g firebase-tools`
7. Run `firebase login` then `firebase init` and select Firestore and Functions (JavaScript). Choose Node.js 20.
8. Replace the generated Firestore rules with `firestore.rules`; ensure the Functions source directory is `functions`.

## 2. Install and run locally
```bash
npm install
npm install --prefix functions
npm run dev
```

## 3. Deploy backend
```bash
firebase deploy --only firestore:rules,functions
```
Deploy the frontend to a static host such as Firebase Hosting after configuring Hosting:
```bash
npm run build
firebase deploy --only hosting
```

## 4. Add the remaining 495 questions
Add questions to `QUESTION_BANK` in `functions/index.js`, each with:
- unique stable `id`
- `level`: amateur | advanced | expert | legend
- concise `text`
- exactly four plausible `options`
- zero-based integer `answer`
- concise fact-checked `explanation`

Keep answer keys server-side. Never put correct answers in the frontend bundle or allow clients to write leaderboard scores.

## 5. Production checklist
- Add rate limiting and App Check before public launch.
- Add robust username uniqueness/reservation and profanity filtering.
- Add server-side weekly score aggregates and tie-break rules.
- Add account recovery and privacy/terms pages.
- Review football facts and image licensing.
- Configure billing alerts and monitor Firebase quotas.
- Test concurrent submissions and duplicate-session abuse.
- AdSense approval is separate; game pages may have limited ad eligibility. Build useful editorial content pages as well.
