// Firebase Auth imports
import { signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth } from "./firebase.js";

// Show message function
function showMessage(text, type = "error") {
  const message = document.getElementById("loginMessage");
  if (!message) return;
  message.textContent = text;
  message.style.display = "block";
  message.style.color = type === "error" ? "#fecaca" : "#d1fae5";
  message.style.background = type === "error" ? "rgba(248, 113, 113, 0.15)" : "rgba(16, 185, 129, 0.15)";
  message.style.border = type === "error" ? "1px solid rgba(248, 113, 113, 0.35)" : "1px solid rgba(16, 185, 129, 0.35)";
}

// Pre-registered credentials
const PRE_REGISTERED_CREDENTIALS = [
  { email: "kingfordnabor@gmail.com", password: "kingford002", role: "member" },
  { email: "allancorral@gmail.com", password: "allan003", role: "member" },
  { email: "phricksborebor@gmail.com", password: "phricks004", role: "member" },
  { email: "moezarperez@gmail.com", password: "moezar005", role: "member" },
  { email: "rogelioledda@gmail.com", password: "rogelio006", role: "member" },
  { email: "johnpaulbugayong@gmail.com", password: "johnpaul001", role: "admin" }
];

// Get pre-registered role
function getPreRegisteredRole(email) {
  const account = PRE_REGISTERED_CREDENTIALS.find(account => account.email === email);
  return account ? account.role : null;
}

// Get stored user from localStorage
function getStoredUser() {
  const stored = localStorage.getItem("authUser");
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error("Error parsing auth user from localStorage", error);
    return null;
  }
}

// Login function - attached to window for global access
window.login = async function() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const account = PRE_REGISTERED_CREDENTIALS.find(a => a.email === email && a.password === password);

  if (!account) {
    showMessage("Invalid login credentials. Please try again.");
    return;
  }

  try {
    // Sign in anonymously with Firebase Auth
    await signInAnonymously(auth);

    localStorage.setItem("authUser", JSON.stringify({ email: account.email, role: account.role }));
    window.location.href = account.role === "admin" ? "admin.html" : "member.html";
  } catch (error) {
    console.error("Firebase Auth error:", error);
    showMessage("Authentication failed. Please try again.");
  }
};

// Exported functions for other modules
export function getStoredUserEmail() {
  const user = getStoredUser();
  return user ? user.email : null;
}

export function getStoredUserRole() {
  const user = getStoredUser();
  return user ? user.role : null;
}

export function requireAuth(allowedRoles = null) {
  const authUser = getStoredUser();
  if (!authUser) {
    window.location.href = "login.html";
    return;
  }

  if (allowedRoles && !allowedRoles.includes(authUser.role)) {
    window.location.href = "login.html";
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out from Firebase:", error);
  }
  localStorage.removeItem("authUser");
  window.location.href = "login.html";
}
