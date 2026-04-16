import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJt3bCDYaqzLe_vGiFqvCMehJedZFvSJs",
  authDomain: "task-edd4d.firebaseapp.com",
  projectId: "task-edd4d",
  storageBucket: "task-edd4d.firebasestorage.app",
  messagingSenderId: "372695845973",
  appId: "1:372695845973:web:23b25b0de8ca2b72dfd8dc"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
