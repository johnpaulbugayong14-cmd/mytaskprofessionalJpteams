/**
 * Notification System for My Thesis Hub
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to Firebase Console > Project Settings > Cloud Messaging
 * 2. Generate a new key pair for Web Push certificates
 * 3. Copy the public key and replace 'YOUR_VAPID_PUBLIC_KEY_HERE' below
 * 4. For server-side push delivery, you'll need to set up Firebase Cloud Functions
 *    or another push service to send notifications to subscribed devices
 *
 * CURRENT IMPLEMENTATION:
 * - Local notifications as fallback
 * - Push notification subscription (requires VAPID key)
 * - Notification queuing in Firestore (for server processing)
 */

// Notification management for My Thesis Hub
import { db } from "./firebase.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// IMPORTANT: Replace with your actual VAPID public key from Firebase Console
// Go to Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';

// Request notification permission
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  return false;
}

// Subscribe to push notifications
export async function subscribeToNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return null;
  }

  if (VAPID_PUBLIC_KEY === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
    console.log('VAPID key not configured. Push notifications will not work.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log('Successfully subscribed to push notifications');
    return subscription;
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    return null;
  }
}

// Convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Send notification to specific users
export async function sendNotificationToUsers(userEmails, title, body, type = 'general') {
  try {
    // Store notification in Firestore for server-side processing
    const notificationData = {
      title,
      body,
      type, // 'task', 'announcement', 'poll'
      recipients: userEmails,
      timestamp: new Date(),
      sent: false
    };

    await addDoc(collection(db, 'notifications'), notificationData);
    console.log('Notification queued for delivery');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// Show local notification (fallback for when push doesn't work)
export function showLocalNotification(title, body, icon = null) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body: body,
      icon: icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%233b82f6"/><text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">✓</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%233b82f6"/><text x="256" y="280" font-family="Arial, sans-serif" font-size="200" font-weight="bold" text-anchor="middle" fill="white">✓</text></svg>'
    });

    notification.onclick = function() {
      window.focus();
      notification.close();
    };

    // Auto close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
  }
}

// Initialize notifications on app start
export async function initializeNotifications() {
  const permissionGranted = await requestNotificationPermission();
  if (permissionGranted) {
    await subscribeToNotifications();
  }
}