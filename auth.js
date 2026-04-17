// Firebase Auth imports
import { signInAnonymously, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
  { email: "test@example.com", password: "test000", role: "member" },
  { email: "johnpaulbugayong@gmail.com", password: "johnpaul001", role: "admin" }
];

// Get pre-registered role
function getPreRegisteredRole(email) {
  const account = PRE_REGISTERED_CREDENTIALS.find(account => account.email === email);
  return account ? account.role : null;
}

// Get stored user from localStorage or sessionStorage
function getStoredUser() {
  // Try localStorage first (persistent across sessions)
  let stored = localStorage.getItem("authUser");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error("Error parsing auth user from localStorage", error);
      localStorage.removeItem("authUser"); // Clear corrupted data
    }
  }

  // Try sessionStorage as fallback (persists during browser session)
  stored = sessionStorage.getItem("authUser");
  if (stored) {
    try {
      const user = JSON.parse(stored);
      // If we found it in sessionStorage, also save to localStorage for future sessions
      localStorage.setItem("authUser", stored);
      return user;
    } catch (error) {
      console.error("Error parsing auth user from sessionStorage", error);
      sessionStorage.removeItem("authUser"); // Clear corrupted data
    }
  }

  return null;
}

// Store user in both localStorage and sessionStorage for maximum persistence
function storeUser(user) {
  const userString = JSON.stringify(user);
  localStorage.setItem("authUser", userString);
  sessionStorage.setItem("authUser", userString);
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

    storeUser({ email: account.email, role: account.role });
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

export function isAuthenticated() {
  const storedUser = getStoredUser();
  return storedUser !== null;
}

export async function requireAuth(allowedRoles = null) {
  return new Promise((resolve) => {
    const storedUser = getStoredUser();

    if (!storedUser) {
      window.location.href = "login.html";
      resolve();
      return;
    }

    if (allowedRoles && !allowedRoles.includes(storedUser.role)) {
      window.location.href = "login.html";
      resolve();
      return;
    }

    // Check if Firebase auth is already available
    if (auth.currentUser) {
      // Firebase auth is ready, start maintenance
      maintainAuthPersistence();
      resolve();
      return;
    }

    // Wait for Firebase auth state to be determined
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Remove listener after first call

      if (user) {
        // Firebase auth restored, continue with maintenance
        maintainAuthPersistence();
        resolve();
      } else {
        // No Firebase auth, but we have stored user - try to restore
        console.log("Attempting to restore Firebase authentication...");
        signInAnonymously(auth).then(() => {
          maintainAuthPersistence();
          resolve();
        }).catch((error) => {
          console.error("Failed to restore authentication:", error);
          // Clear stored user if we can't restore Firebase auth
          localStorage.removeItem("authUser");
          window.location.href = "login.html";
          resolve();
        });
      }
    });

    // Timeout after 5 seconds to prevent hanging
    setTimeout(() => {
      unsubscribe();
      if (!auth.currentUser) {
        console.warn("Auth state determination timed out, checking stored user only");
        if (storedUser) {
          // Allow access with stored user only, but try to restore Firebase auth in background
          maintainAuthPersistence();
          resolve();
        } else {
          window.location.href = "login.html";
          resolve();
        }
      }
    }, 5000);
  });
}

export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out from Firebase:", error);
  }

  // Clear from both storages
  localStorage.removeItem("authUser");
  sessionStorage.removeItem("authUser");

  // Clean up auth state listener if it exists
  if (window.authStateUnsubscribe) {
    window.authStateUnsubscribe();
  }

  window.location.href = "login.html";
}

// Function to maintain persistent authentication
export async function maintainAuthPersistence() {
  const storedUser = getStoredUser();

  if (!storedUser) {
    // No stored user, redirect to login
    window.location.href = "login.html";
    return;
  }

  // Listen for Firebase auth state changes
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Firebase user is authenticated, all good
      console.log("User authenticated with Firebase");
    } else {
      // Firebase auth expired, re-authenticate anonymously
      console.log("Firebase auth expired, re-authenticating...");
      try {
        await signInAnonymously(auth);
        console.log("Re-authenticated anonymously");
      } catch (error) {
        console.error("Failed to re-authenticate:", error);
        // Don't clear stored user immediately - allow access with stored credentials
        // Only clear if multiple failures occur
        console.warn("Continuing with stored credentials despite Firebase auth failure");
      }
    }
  });

  // Store the unsubscribe function for cleanup if needed
  window.authStateUnsubscribe = unsubscribe;

  // Handle PWA visibility changes (when app is reopened)
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      // App became visible (PWA reopened)
      console.log("PWA became visible, checking authentication...");
      const storedUser = getStoredUser();
      if (storedUser && !auth.currentUser) {
        try {
          await signInAnonymously(auth);
          console.log("Restored Firebase auth on PWA resume");
        } catch (error) {
          console.error("Failed to restore auth on PWA resume:", error);
        }
      }
    }
  });

  // Also check periodically (every 30 minutes) if we need to refresh
  setInterval(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log("No current Firebase user, attempting re-auth...");
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Periodic re-auth failed:", error);
        // Don't redirect here - let the user continue with stored credentials
      }
    }
  }, 30 * 60 * 1000); // 30 minutes
}

// Clear all authentication data (for debugging/reset purposes)
export function clearAuthData() {
  localStorage.removeItem("authUser");
  sessionStorage.removeItem("authUser");
  if (window.authStateUnsubscribe) {
    window.authStateUnsubscribe();
  }
}

// Make clearAuthData available globally for debugging
window.clearAuthData = clearAuthData;
