import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

export const firebaseConfig = {
  apiKey: "AIzaSyDDpjLpP5b9HOVAzVXAmUvlBoDvEJG5qys",
  authDomain: "coachap-novo.firebaseapp.com",
  databaseURL: "https://coachap-novo-default-rtdb.firebaseio.com",
  projectId: "coachap-novo",
  storageBucket: "coachap-novo.firebasestorage.app",
  messagingSenderId: "162179285430",
  appId: "1:162179285430:web:b42a79cc3d771dff67c117"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
