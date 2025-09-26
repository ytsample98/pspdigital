// samplenative/app/utils/firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from "firebase/auth";
import { setPersistence, browserSessionPersistence } from "firebase/auth";



const firebaseConfig = {
  apiKey: "AIzaSyBftFr5Av5aMk59lhE01O4GH34LZ67pRbA",
  authDomain: "crm-yaanar-859e1.firebaseapp.com",
  projectId: "crm-yaanar-859e1",
  storageBucket: "crm-yaanar-859e1.appspot.com",
  messagingSenderId: "727761808386",
  appId: "1:727761808386:web:3702c7ded538addd628b1b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app); 
setPersistence(auth, browserSessionPersistence);
const db = getFirestore(app);
export { db };
export { auth };
    