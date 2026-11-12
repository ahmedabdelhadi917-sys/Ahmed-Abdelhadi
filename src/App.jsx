import React, { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged, signInAnonymously, linkWithCredential,
  EmailAuthProvider, updateProfile
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db, functions } from "./firebase";

const startQuiz = httpsCallable(functions, "startQuiz");
const submitQuiz = httpsCallable(functions, "submitQuiz");

export default function App() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState(localStorage.getItem("bptName") || "Guest Player");
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [leaders, setLeaders] = useState([]);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");

  useEffect(() => onAuthStateChanged(auth, async current => {
    if (current) setUser(current);
    else {
      try { await signInAnonymously(auth); }
      catch (e) { setError("Authentication setup is incomplete. Check Firebase configuration."); }
    }
  }), []);

  useEffect(() => {
    const q = query(collection(db, "leaderboard"), orderBy("totalPoints", "desc"), limit(20));
    return onSnapshot(q, snap => setLeaders(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setLeaders([]));
  }, []);

  const currentQuestion = quiz?.questions?.[questionIndex];
  const selected = currentQuestion ? answers[currentQuestion.id] : undefined;

  async function begin() {
    setBusy(true); setError(""); setResult(null); setAnswers({}); setQuestionIndex(0);
    localStorage.setItem("bptName", name.trim() || "Guest Player");
    try {
      const response = await startQuiz({ displayName: name.trim() || "Guest Player", level: "expert" });
      setQuiz(response.data);
    } catch (e) { setError(e.message || "Could not start the challenge."); }
    finally { setBusy(false); }
  }

  function choose(value) {
    if (!currentQuestion || selected !== undefined) return;
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
  }

  async function next() {
    if (selected === undefined) return;
    if (questionIndex < quiz.questions.length - 1) setQuestionIndex(i => i + 1);
    else {
      setBusy(true); setError("");
      try {
        const response = await submitQuiz({ sessionId: quiz.sessionId, answers });
        setResult(response.data);
        setQuiz(null);
      } catch (e) { setError(e.message || "Could not submit your score."); }
      finally { setBusy(false); }
    }
  }

  async function createAccount(e) {
    e.preventDefault(); setError("");
    if (!user?.isAnonymous) return;
    try {
      const credential = EmailAuthProvider.credential(accountEmail, accountPassword);
      await linkWithCredential(user, credential);
      await updateProfile(auth.currentUser, { displayName: name.trim() || "Football Fan" });
      setError("Account created. Your guest account is now upgraded.");
    } catch (e) { setError(e.message || "Account creation failed."); }
  }

  const progress = quiz ? ((questionIndex + 1) / quiz.questions.length) * 100 : 0;

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="crest">B</span><div><b>BEYOND THE PITCH</b><small>FOOTBALL QUIZ ARENA</small></div></div>
      <span className="live"><i /> PLAYER ARENA</span>
    </header>

    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">THE ULTIMATE FOOTBALL KNOWLEDGE TEST</p>
        <h1>ARE YOU A<br/><em>FOOTBALL MASTER?</em></h1>
        <p className="intro">Challenge your knowledge. Climb the rankings. Earn your place among the legends.</p>
        <div className="stats"><div><b>500+</b><span>QUESTIONS</span></div><div><b>4</b><span>DIFFICULTY LEVELS</span></div><div><b>GLOBAL</b><span>RANKINGS</span></div></div>
      </div>
      <div className="hero-ball" aria-hidden="true">⚽</div>
    </section>

    {error && <div className="notice">{error}</div>}

    <section className="layout">
      <div className="main-panel">
        {!quiz && !result && <div className="card">
          <div className="section-heading"><div><p className="eyebrow">YOUR NEXT CHALLENGE</p><h2>Enter the Arena</h2></div><span className="pill">GUEST MODE</span></div>
          <label className="field-label">PLAYER NAME</label>
          <input value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Choose your player name"/>
          <p className="muted">Play instantly as a guest. Create an account later to keep your progress across devices.</p>
          <button className="gold-button" onClick={begin} disabled={busy || !user}>{busy ? "PREPARING..." : "START EXPERT CHALLENGE →"}</button>
          <div className="account-box">
            <h3>Save your progress permanently</h3>
            <p className="muted">Upgrade this guest session to an email account.</p>
            <form onSubmit={createAccount} className="account-form">
              <input type="email" required placeholder="Email address" value={accountEmail} onChange={e => setAccountEmail(e.target.value)}/>
              <input type="password" required minLength="6" placeholder="Password (6+ characters)" value={accountPassword} onChange={e => setAccountPassword(e.target.value)}/>
              <button className="outline-button" disabled={!user?.isAnonymous}>CREATE ACCOUNT</button>
            </form>
          </div>
        </div>}

        {quiz && currentQuestion && <div className="card">
          <div className="section-heading"><div><p className="eyebrow">EXPERT CHALLENGE</p><h2>Question {questionIndex + 1} <span className="muted">/ {quiz.questions.length}</span></h2></div><span className="pill">10 QUESTIONS</span></div>
          <div className="progress"><span style={{width: `${progress}%`}}/></div>
          <h3 className="question">{currentQuestion.text}</h3>
          <div className="options">{currentQuestion.options.map((option, i) =>
            <button key={i} onClick={() => choose(i)} disabled={selected !== undefined}
              className={`option ${selected === i ? "selected" : ""}`}>
              <span>{String.fromCharCode(65 + i)}</span>{option}
            </button>)}</div>
          <button className="gold-button" disabled={selected === undefined || busy} onClick={next}>
            {busy ? "SUBMITTING..." : questionIndex === quiz.questions.length - 1 ? "FINISH CHALLENGE →" : "NEXT QUESTION →"}
          </button>
        </div>}

        {result && <div className="card result-card">
          <p className="eyebrow">CHALLENGE COMPLETE</p><h2>Your result</h2>
          <div className="score">{result.score}<small> / {result.maxScore}</small></div>
          <p className="muted">Your verified score has been submitted to the leaderboard.</p>
          <button className="gold-button" onClick={() => setResult(null)}>PLAY ANOTHER CHALLENGE →</button>
        </div>}
      </div>

      <aside className="card leaderboard">
        <div className="section-heading"><div><p className="eyebrow">THE BEST OF THE BEST</p><h2>Leaderboard</h2></div><span className="live"><i/> LIVE</span></div>
        <p className="muted">Top players by total verified points.</p>
        {leaders.length === 0 ? <p className="empty">The global rankings will appear here as players complete challenges.</p> :
          leaders.map((p, i) => <div className="leader" key={p.id}><b className="rank">{String(i+1).padStart(2,"0")}</b><span className="avatar">{(p.displayName || "P").slice(0,1).toUpperCase()}</span><span className="player-name">{p.displayName || "Player"}</span><b className="points">{p.totalPoints || 0} pts</b></div>)}
        <div className="leader-note">Rankings update automatically when verified scores are saved.</div>
      </aside>
    </section>
    <footer>BEYOND THE PITCH <span>·</span> FOOTBALL HAS STORIES BEYOND THE GAME</footer>
  </main>;
}
