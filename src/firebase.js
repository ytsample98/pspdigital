// Import Firebase SDKs
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCzAVjqvzqFyJv0GrK1OZN3W1EXOHEsglA",
  authDomain: "pspmahle.firebaseapp.com",
  projectId: "pspmahle",
  storageBucket: "pspmahle.firebasestorage.app",
  messagingSenderId: "404749824069",
  appId: "1:404749824069:web:8a6d5f52f3070d6b99732c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);


export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
