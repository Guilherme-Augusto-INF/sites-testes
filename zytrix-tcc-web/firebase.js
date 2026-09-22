import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, updateProfile,
  sendSignInLinkToEmail, isSignInWithEmailLink, EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore, collection, query, where, limit, getDocs, onSnapshot,
  doc, getDoc, setDoc, updateDoc, addDoc, serverTimestamp, runTransaction,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDLUogDD_G98mDO7SqEA_U6JX1HlRuseUE",
  authDomain: "zytrix-ca4f2.firebaseapp.com",
  projectId: "zytrix-ca4f2",
  storageBucket: "zytrix-ca4f2.firebasestorage.app",
  messagingSenderId: "538535719632",
  appId: "1:538535719632:web:b8a5de998ca8d1db00a4d5",
  measurementId: "G-422Y8YEZYX"
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = "pt-BR";
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export {
  onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  signOut, updateProfile, sendSignInLinkToEmail, isSignInWithEmailLink,
  EmailAuthProvider, reauthenticateWithCredential,
  collection, query, where, limit, getDocs, onSnapshot, doc, getDoc, setDoc,
  updateDoc, addDoc, serverTimestamp, runTransaction, writeBatch
};