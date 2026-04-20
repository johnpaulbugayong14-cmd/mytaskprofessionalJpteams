import { db, messaging } from "./firebase.js";
import { getStoredUserEmail } from "./auth.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const VAPID_PUBLIC_KEY = 'BBu_m1NKUZO5bp6k5q29DgzYpmjVWe8z1C6KojHrq7RDqOJ0O01txWvzqKWrnLMAGlrm8eOcdTn_O1wDnf5OZB8';

// Robust Capacitor check
const getCapacitor = () => {
  if (typeof window !== 'undefined' && window.Capacitor) {
    return window.Capacitor;
  }
  return null;
};

const isNative = () => {
  const cap = getCapacitor();
  return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
};

async function getPushPlugin() {
  const cap = getCapacitor();
  if (!cap) return null;

  // Wait a bit for plugins to load if needed
  let retries = 0;
  while (retries < 10) {
    if (cap.Plugins && cap.Plugins.PushNotifications) {
      return cap.Plugins.PushNotifications;
    }
    await new Promise(r => setTimeout(r, 100));
    retries++;
  }
  return null;
}

export async function requestNotificationPermission() {
  console.log('Requesting notification permission...');

  if (isNative()) {
    try {
      const PushNotifications = await getPushPlugin();
      if (PushNotifications) {
        console.log('Using Native PushNotifications plugin for permission');
        const permission = await PushNotifications.requestPermissions();
        console.log('Native permission result:', permission);
        return permission.receive === 'granted';
      } else {
        console.warn('Native PushNotifications plugin not found after retries');
      }
    } catch (error) {
      console.error('Error requesting native notification permission:', error);
    }
  }

  // Fallback to Web API
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') return true;

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting web notification permission:', error);
    return false;
  }
}

async function getFcmToken(registration) {
  if (isNative()) {
    return new Promise(async (resolve) => {
      try {
        const PushNotifications = await getPushPlugin();
        if (!PushNotifications) {
          console.error('PushNotifications plugin unavailable for token retrieval');
          resolve(null);
          return;
        }

        // Remove existing listeners to avoid duplicates
        await PushNotifications.removeAllListeners();

        await PushNotifications.addListener('registration', (token) => {
          console.log('Native Push registration success, token:', token.value);
          resolve(token.value);
        });

        await PushNotifications.addListener('registrationError', (err) => {
          console.error('Native Push registration error:', err.error);
          resolve(null);
        });

        console.log('Calling PushNotifications.register()...');
        await PushNotifications.register();

        // Timeout if registration takes too long
        setTimeout(() => resolve(null), 10000);
      } catch (error) {
        console.error('Error in native token retrieval:', error);
        resolve(null);
      }
    });
  }

  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.length < 50) return null;

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });
    return token;
  } catch (error) {
    console.error('Failed to get web FCM token:', error);
    return null;
  }
}

export async function saveFcmTokenForCurrentUser(token) {
  const email = await getStoredUserEmail();
  if (!email || !token) return;

  try {
    const tokenDoc = doc(db, 'fcmTokens', email);
    await setDoc(tokenDoc, {
      email,
      token,
      updatedAt: new Date(),
      platform: isNative() ? 'android' : 'web',
      lastSeen: new Date()
    }, { merge: true });
    console.log('Saved FCM token for user:', email);
  } catch (error) {
    console.error('Failed to save FCM token to Firestore:', error);
  }
}

export async function subscribeToNotifications() {
  if (isNative()) {
    console.log('Subscribing to native notifications...');
    return await getFcmToken();
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return null;
  }

  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('service-worker.js');
    await navigator.serviceWorker.ready;
    return await getFcmToken(registration);
  } catch (error) {
    console.error('Error subscribing to web notifications:', error);
    return null;
  }
}

export function showLocalNotification(title, body, icon = null) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%233b82f6"/><text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">✓</text></svg>'
    });
    notification.onclick = () => { window.focus(); notification.close(); };
    setTimeout(() => notification.close(), 5000);
  }
}

export async function sendNotificationToUsers(userEmails, title, body, type = 'general') {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;

  // Only send from GitHub Pages (production)
  if (window.location.hostname !== 'johnpaulbugayong14-cmd.github.io') return;

  try {
    // GitHub Actions configuration
    const GITHUB_CONFIG = {
      owner: 'johnpaulbugayong14-cmd',
      repo: 'mytaskprofessionalJpteams',
      token: localStorage.getItem('github_token') || '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'
    };

    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/actions/workflows/send-push-notification.yml/dispatches`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_CONFIG.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          userEmails: JSON.stringify(userEmails),
          title: title,
          body: body,
          type: type
        }
      })
    });

    if (!response.ok) {
      console.warn('Push notification trigger failed with status:', response.status);
    } else {
      console.log('Push notification triggered via GitHub Actions');
    }
  } catch (error) {
    console.error('Error triggering push notification:', error);
  }
}

export async function initializeNotifications() {
  console.log('Initializing Notifications system...');

  // Ensure we wait for Capacitor if it's there
  if (typeof window !== 'undefined' && !window.Capacitor && isNative()) {
     await new Promise(r => setTimeout(r, 500));
  }

  const permissionGranted = await requestNotificationPermission();
  if (!permissionGranted) {
    console.warn('Notification permission was denied');
    return null;
  }

  const token = await subscribeToNotifications();
  if (!token) {
    console.warn('Failed to retrieve FCM token');
    return null;
  }

  console.log('Successfully obtained token, saving to database...');
  await saveFcmTokenForCurrentUser(token);

  if (isNative()) {
    const PushNotifications = await getPushPlugin();
    if (PushNotifications) {
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Native push received in foreground:', notification);
        // On Android, foreground notifications don't show by default unless you use LocalNotifications
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action performed:', notification);
      });
    }
  } else {
    onMessage(messaging, (payload) => {
      console.log('Web foreground message:', payload);
      const title = payload.notification?.title || 'My Thesis Hub';
      const body = payload.notification?.body || 'New message';
      showLocalNotification(title, body);
    });
  }

  return token;
}
