const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();

// Starter content only. Expand this reviewed bank to 500 questions before public launch.
// Correct answers stay server-side and are never sent to the browser.
const QUESTION_BANK = [
  { id:"wc2010", level:"expert", text:"Which country won the 2010 FIFA World Cup?", options:["Germany","Spain","Netherlands","Brazil"], answer:1, explanation:"Spain defeated the Netherlands 1–0 in the final." },
  { id:"ballondor", level:"expert", text:"Who holds the record for the most men's Ballon d'Or awards?", options:["Cristiano Ronaldo","Lionel Messi","Michel Platini","Johan Cruyff"], answer:1, explanation:"Lionel Messi has won the men's Ballon d'Or eight times." },
  { id:"europeancup1956", level:"advanced", text:"Which club won the inaugural European Cup in 1956?", options:["AC Milan","Barcelona","Real Madrid","Liverpool"], answer:2, explanation:"Real Madrid defeated Stade de Reims in the 1956 final." },
  { id:"handofgod", level:"expert", text:"Who scored the famous 'Hand of God' goal at the 1986 World Cup?", options:["Pelé","Diego Maradona","Ronaldo Nazário","Roberto Baggio"], answer:1, explanation:"Maradona scored it against England in the quarter-final." },
  { id:"brazilwc", level:"advanced", text:"How many men's FIFA World Cups had Brazil won through the 2022 tournament?", options:["Four","Five","Six","Seven"], answer:1, explanation:"Brazil had won five men's World Cup titles through 2022." }
];

exports.startQuiz = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in as a guest or account first.");
  const displayName = String(request.data?.displayName || "Guest Player").trim().slice(0,24) || "Guest Player";
  const level = ["amateur","advanced","expert","legend"].includes(request.data?.level) ? request.data.level : "expert";
  const pool = QUESTION_BANK.filter(q => q.level === level || level === "expert");
  if (pool.length < 5) throw new HttpsError("failed-precondition", "Not enough questions in this level yet.");
  const selected = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(10, pool.length));
  const sessionId = crypto.randomUUID();
  const expiresAt = Timestamp.fromMillis(Date.now() + 30 * 60 * 1000);
  await db.collection("quizSessions").doc(sessionId).set({
    uid: request.auth.uid,
    displayName,
    level,
    questionIds: selected.map(q => q.id),
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    submitted: false
  });
  return {
    sessionId,
    questions: selected.map(q => ({ id:q.id, text:q.text, options:q.options }))
  };
});

exports.submitQuiz = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { sessionId, answers } = request.data || {};
  if (typeof sessionId !== "string" || !answers || typeof answers !== "object") {
    throw new HttpsError("invalid-argument", "A valid session and answers are required.");
  }
  const sessionRef = db.collection("quizSessions").doc(sessionId);
  const result = await db.runTransaction(async tx => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists) throw new HttpsError("not-found", "Quiz session not found.");
    const session = sessionSnap.data();
    if (session.uid !== request.auth.uid) throw new HttpsError("permission-denied", "This quiz belongs to another player.");
    if (session.submitted) throw new HttpsError("already-exists", "This challenge has already been submitted.");
    if (session.expiresAt.toMillis() < Date.now()) throw new HttpsError("deadline-exceeded", "This challenge has expired.");

    const bank = new Map(QUESTION_BANK.map(q => [q.id,q]));
    let score = 0;
    let correctCount = 0;
    for (const id of session.questionIds) {
      const q = bank.get(id);
      const value = answers[id];
      if (q && Number.isInteger(value) && value === q.answer) {
        score += 100;
        correctCount += 1;
      }
    }
    const playerRef = db.collection("players").doc(request.auth.uid);
    const playerSnap = await tx.get(playerRef);
    const old = playerSnap.exists ? playerSnap.data() : {};
    const totalPoints = (old.totalPoints || 0) + score;
    const displayName = session.displayName || old.displayName || "Player";
    tx.set(playerRef, {
      displayName, totalPoints,
      challengesPlayed: (old.challengesPlayed || 0) + 1,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge:true });
    tx.set(db.collection("leaderboard").doc(request.auth.uid), {
      displayName, totalPoints,
      challengesPlayed: (old.challengesPlayed || 0) + 1,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge:true });
    tx.update(sessionRef, { submitted:true, score, correctCount, submittedAt:FieldValue.serverTimestamp() });
    return { score, maxScore: session.questionIds.length * 100, correctCount };
  });
  return result;
});
