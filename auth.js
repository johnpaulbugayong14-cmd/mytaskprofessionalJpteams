// Firebase Auth imports
import { signInAnonymously, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

// Storage utility for cross-platform compatibility
class StorageManager {
  constructor() {
    this.isCapacitor = false;
    this.preferences = null;
    this.initialized = false;
    this.initializationPromise = null;

    // Check for Capacitor more reliably
    this.initializationPromise = this.checkCapacitorAvailability();
  }

  async checkCapacitorAvailability() {
    // Wait a bit for Capacitor to initialize
    if (typeof window !== 'undefined') {
      let retryCount = 0;
      while (retryCount < 5 && !window.Capacitor) {
        await new Promise(resolve => setTimeout(resolve, 50));
        retryCount++;
      }
    }

    this.isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

    if (this.isCapacitor) {
      try {
        const module = await import('@capacitor/preferences');
        this.preferences = module.Preferences;
        console.log('Capacitor Preferences loaded successfully');
      } catch (err) {
        console.warn('Capacitor Preferences not available, falling back to localStorage:', err);
        this.isCapacitor = false;
      }
    } else {
      console.log('Running in browser, using localStorage');
    }

    this.initialized = true;
  }

  async ensureInitialized() {
    if (this.initializationPromise) {
      await this.initializationPromise;
      this.initializationPromise = null; // Clear to avoid re-awaiting
    }
    if (!this.initialized) {
      await this.checkCapacitorAvailability();
    }
  }

  async get(key) {
    console.log(`StorageManager.get: Requesting key "${key}"`);
    await this.ensureInitialized();

    // Attempt multiple retries for Capacitor Preferences on cold start
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      if (this.isCapacitor && this.preferences) {
        try {
          console.log(`StorageManager.get: Trying Capacitor Preferences (Attempt ${attempts + 1})`);
          const result = await this.preferences.get({ key });
          if (result && result.value) {
            console.log(`StorageManager.get: Success from Capacitor`);
            return result;
          }
        } catch (error) {
          console.error('StorageManager.get: Capacitor error:', error);
        }
      }

      if (attempts < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Small wait before retry
      }
      attempts++;
    }

    // Fallback to localStorage
    console.log(`StorageManager.get: Falling back to localStorage for "${key}"`);
    const value = localStorage.getItem(key);
    return value ? { value } : { value: null };
  }

  async set(key, value) {
    console.log(`StorageManager.set: Setting key "${key}" with value:`, value);
    await this.ensureInitialized();
    console.log(`StorageManager.set: Initialized. Saving to localStorage...`);

    // Save to both for maximum reliability
    if (this.isCapacitor && this.preferences) {
      try {
        console.log(`StorageManager.set: Also saving to Capacitor Preferences`);
        await this.preferences.set({ key, value });
      } catch (error) {
        console.error('StorageManager.set: Error setting in Capacitor Preferences:', error);
      }
    }
    localStorage.setItem(key, value);
    console.log(`StorageManager.set: Successfully saved to localStorage`);
  }

  async remove(key) {
    await this.ensureInitialized();

    if (this.isCapacitor && this.preferences) {
      try {
        await this.preferences.remove({ key });
      } catch (error) {
        console.error('Error removing from Capacitor Preferences:', error);
      }
    }
    localStorage.removeItem(key);
  }
}

const storage = new StorageManager();

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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export async function getEffectiveRole(email) {
  if (!email) return null;

  const normalized = normalizeEmail(email);
  try {
    const roleRef = doc(db, "userRoles", normalized);
    const roleSnap = await getDoc(roleRef);
    if (roleSnap.exists()) {
      const data = roleSnap.data();
      if (data && data.role) {
        return data.role;
      }
    }
  } catch (error) {
    console.warn("Unable to read custom role from Firestore:", error);
  }

  const account = PRE_REGISTERED_CREDENTIALS.find(account => normalizeEmail(account.email) === normalized);
  return account ? account.role : null;
}

export async function setUserRole(email, role) {
  if (!email) return;
  const normalized = normalizeEmail(email);
  try {
    const roleRef = doc(db, "userRoles", normalized);
    await setDoc(roleRef, { role }, { merge: true });
  } catch (error) {
    console.error("Error setting user role in Firestore:", error);
    throw error;
  }
}

export async function getUserAccessDetails(email) {
  if (!email) return { accessAllowed: true, accessReason: '' };

  const normalized = normalizeEmail(email);
  try {
    const roleRef = doc(db, "userRoles", normalized);
    const roleSnap = await getDoc(roleRef);
    if (roleSnap.exists()) {
      const data = roleSnap.data() || {};
      return {
        accessAllowed: typeof data.accessAllowed === 'boolean' ? data.accessAllowed : true,
        accessReason: typeof data.accessReason === 'string' ? data.accessReason : ''
      };
    }
  } catch (error) {
    console.warn("Unable to read account access from Firestore:", error);
  }

  return { accessAllowed: true, accessReason: '' };
}

export async function getUserAccessStatus(email) {
  const { accessAllowed } = await getUserAccessDetails(email);
  return accessAllowed;
}

export async function getUserAccessReason(email) {
  const { accessReason } = await getUserAccessDetails(email);
  return accessReason;
}

export async function setUserAccess(email, isAccessAllowed, reason = '') {
  if (!email) return;
  const normalized = normalizeEmail(email);
  try {
    const roleRef = doc(db, "userRoles", normalized);
    await setDoc(roleRef, {
      accessAllowed: Boolean(isAccessAllowed),
      accessReason: String(reason || '')
    }, { merge: true });
  } catch (error) {
    console.error("Error setting user access in Firestore:", error);
    throw error;
  }
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

// Get stored user from storage
async function getStoredUser() {
  try {
    console.log('getStoredUser: Attempting to retrieve authUser from localStorage...');
    const value = localStorage.getItem('authUser');
    console.log('getStoredUser: Retrieved value:', value);
    
    if (value) {
      const parsed = JSON.parse(value);
      console.log('getStoredUser: Parsed user:', parsed);
      return parsed;
    } else {
      console.log('getStoredUser: No value found in localStorage');
    }
  } catch (error) {
    console.error("Error getting auth user from localStorage", error);
  }
  return null;
}

// Store user in storage
async function storeUser(user) {
  try {
    console.log('storeUser: Storing user:', user);
    const userString = JSON.stringify(user);
    console.log('storeUser: Serialized to:', userString);
    localStorage.setItem('authUser', userString);
    console.log('storeUser: Successfully saved to localStorage');
  } catch (error) {
    console.error("Error storing auth user to localStorage", error);
  }
}

// Login function - attached to window for global access
window.login = async function() {
  console.log('=== LOGIN FUNCTION CALLED ===');
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  console.log('Login attempt for email:', email);
  
  const account = PRE_REGISTERED_CREDENTIALS.find(a => a.email === email && a.password === password);

  if (!account) {
    console.log('Login failed: Invalid credentials');
    showMessage("Invalid login credentials. Please try again.");
    return;
  }

  console.log('Credentials valid, account found:', account);

  try {
    console.log('Signing in with Firebase Auth (anonymously)...');
    await signInAnonymously(auth);
    console.log('Firebase Auth successful');

    console.log('Resolving effective user role...');
    const roleOverride = await getEffectiveRole(account.email);
    const role = roleOverride || account.role;
    const accessDetails = await getUserAccessDetails(account.email);
    const accessAllowed = accessDetails.accessAllowed;
    const accessReason = accessDetails.accessReason || '';

    console.log('Storing user in storage...');
    await storeUser({ email: account.email, role, accessAllowed, accessReason });
    const destination = role === "admin" ? "admin.html" : "member.html";
    console.log('User stored, redirecting to:', destination);
    
    window.location.href = destination;
  } catch (error) {
    console.error("Firebase Auth error:", error);
    showMessage("Authentication failed. Please try again.");
  }
};

// Exported functions for other modules
export async function getStoredUserEmail() {
  console.log('getStoredUserEmail: Called');
  const user = await getStoredUser();
  console.log('getStoredUserEmail: Got user:', user);
  const email = user ? user.email : null;
  console.log('getStoredUserEmail: Returning email:', email);
  return email;
}

export async function getStoredUserRole() {
  const user = await getStoredUser();
  if (!user) return null;

  try {
    const effectiveRole = await getEffectiveRole(user.email);
    if (effectiveRole && effectiveRole !== user.role) {
      await storeUser({ email: user.email, role: effectiveRole, accessAllowed: user.accessAllowed !== false, accessReason: user.accessReason || '' });
      return effectiveRole;
    }
  } catch (error) {
    console.warn('Failed to resolve effective role from Firestore, using stored role:', error);
  }

  return user.role;
}

export async function getStoredUserAccess() {
  const user = await getStoredUser();
  if (!user) return true;

  try {
    const effectiveAccess = await getUserAccessStatus(user.email);
    if (typeof effectiveAccess === 'boolean' && effectiveAccess !== (user.accessAllowed !== false)) {
      await storeUser({ ...user, accessAllowed: effectiveAccess });
    }
    return effectiveAccess;
  } catch (error) {
    console.warn('Failed to resolve account access from Firestore, using stored access:', error);
  }

  return user.accessAllowed !== false;
}

export async function getStoredUserAccessReason() {
  const user = await getStoredUser();
  if (!user) return '';

  try {
    const effectiveReason = await getUserAccessReason(user.email);
    if (typeof effectiveReason === 'string' && effectiveReason !== (user.accessReason || '')) {
      await storeUser({ ...user, accessReason: effectiveReason });
    }
    return effectiveReason;
  } catch (error) {
    console.warn('Failed to resolve account access reason from Firestore, using stored reason:', error);
  }

  return user.accessReason || '';
}

export async function isAuthenticated() {
  const storedUser = await getStoredUser();
  return storedUser !== null;
}

export async function requireAuth(allowedRoles = null) {
  const storedUser = await getStoredUser();

  if (!storedUser) {
    window.location.href = "login.html";
    return;
  }

  const accessAllowed = await getStoredUserAccess();
  if (accessAllowed === false && allowedRoles && allowedRoles.includes('member')) {
    // Restricted members are allowed to enter the member experience with limited access.
  } else if (accessAllowed === false) {
    await clearAuthData();
    window.location.href = "login.html";
    return;
  }

  let effectiveRole = storedUser.role;
  if (allowedRoles) {
    effectiveRole = await getStoredUserRole();
  }

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    window.location.href = "login.html";
    return;
  }

  // Initialize Firebase auth in background for Firestore access
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
      console.log("Initialized anonymous Firebase auth");
    } catch (error) {
      console.error("Failed to initialize Firebase auth:", error);
      // Continue anyway - Firestore might work without auth
    }
  }

  // Start maintenance for auth persistence
  maintainAuthPersistence();

  // Also initialize notifications
  safeInitializeNotifications();
}

// Ensure init runs after the script is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Helper to safely initialize notifications
async function safeInitializeNotifications() {
  try {
    const { initializeNotifications } = await import("./notifications.js");
    await initializeNotifications();
  } catch (err) {
    console.error("Failed to initialize notifications:", err);
  }
}

// Global initialization for all pages
async function init() {
  console.log('Init: Starting...');
  await storage.ensureInitialized();

  // On Android, give the native bridge an extra moment to settle
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const path = window.location.pathname.toLowerCase();
  const isLoginPage = path.endsWith('login.html') || path.endsWith('index.html') || path === '/' || path === '';

  const user = await getStoredUser();
  console.log('Init: user found:', user, 'isLoginPage:', isLoginPage, 'path:', path);

  if (user) {
    const accessAllowed = await getStoredUserAccess();
    if (accessAllowed === false && path.endsWith('login.html')) {
      window.location.href = "member.html";
      return;
    }
  }

  // Initialize notifications if user is logged in
  if (user) {
    console.log('User logged in, initializing notifications...');
    safeInitializeNotifications();
  }

  if (user && isLoginPage) {
    // If logged in and on login page, redirect to dashboard
    console.log('Redirecting to dashboard...');
    window.location.href = user.role === "admin" ? "admin.html" : "member.html";
  } else if (!user && !isLoginPage) {
    // If not logged in and on a protected page, redirect to login
    console.log('Redirecting to login...');
    window.location.href = "login.html";
  }
}


export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out from Firebase:", error);
  }

  await clearAuthData();

  window.location.href = "login.html";
}

window.signOutUser = signOutUser;

// Function to maintain persistent authentication
export async function maintainAuthPersistence() {
  const storedUser = await getStoredUser();

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
        // Don't redirect - allow access with stored credentials
        console.warn("Continuing with stored credentials despite Firebase auth failure");
      }
    }
  });

  // Store the unsubscribe function for cleanup if needed
  window.authStateUnsubscribe = unsubscribe;

  // Handle app resume (when app is reopened from background)
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      // App became visible
      console.log("App became visible, checking authentication...");
      const storedUser = await getStoredUser();
      if (storedUser && !auth.currentUser) {
        try {
          await signInAnonymously(auth);
          console.log("Restored Firebase auth on app resume");
        } catch (error) {
          console.error("Failed to restore auth on app resume:", error);
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
export async function clearAuthData() {
  try {
    await storage.remove('authUser');
  } catch (error) {
    console.error("Error clearing auth data", error);
  }
  localStorage.removeItem("authUser");
  sessionStorage.removeItem("authUser");
  if (window.authStateUnsubscribe) {
    window.authStateUnsubscribe();
  }
}

// Make clearAuthData available globally for debugging
window.clearAuthData = clearAuthData;
