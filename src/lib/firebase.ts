import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA3JKht8FApoY6OUN5odH9VsVYvqPCm5Vc",
  authDomain: "flow-bca44.firebaseapp.com",
  projectId: "flow-bca44",
  storageBucket: "flow-bca44.firebasestorage.app",
  messagingSenderId: "904006603284",
  appId: "1:904006603284:web:466745bc96ba7cb7ea4d01"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
