import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Copy your Firebase web app configuration from Firebase Console.
// Never put Admin SDK credentials or service-account keys in this file.
const firebaseConfig = {
  apiKey: "AIzaSyBvUDNeBWbGCXOFEfh5XM-i-S8QvWInoBk",
  authDomain: "beyond-the-pitch-quiz-arena.firebaseapp.com",
  projectId: "beyond-the-pitch-quiz-arena",
  appId: "1:896803945229:web:859fcf5f1fef5085b50e44"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
