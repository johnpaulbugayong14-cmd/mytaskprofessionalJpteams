import { db, auth } from './firebase.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStoredUserRole } from './auth.js';

let jitsiApi = null;
let currentRoomId = null;
let currentUserName = null;
let currentSessionId = null;
let isInConference = false;
let participants = new Set();
let userRole = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication status
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Redirect to login if not authenticated
      window.location.href = 'login.html';
      return;
    }

    // Get user role
    userRole = await getStoredUserRole();
    console.log('User role:', userRole);

    // Initialize UI based on role
    initializeUIForRole(userRole);
  });
});

/**
 * Initialize UI based on user role
 */
async function initializeUIForRole(role) {
  const setupScreen = document.getElementById('setupScreen');
  const createSection = document.getElementById('createRoomSection');
  const joinSection = document.getElementById('joinRoomSection');
  const memberSection = document.getElementById('memberSection');

  if (role === 'admin') {
    // Admin: Show create room form
    if (createSection) createSection.style.display = 'block';
    if (joinSection) joinSection.style.display = 'none';
    if (memberSection) memberSection.style.display = 'none';
  } else {
    // Member: Show available rooms to join
    if (createSection) createSection.style.display = 'none';
    if (joinSection) joinSection.style.display = 'none';
    if (memberSection) memberSection.style.display = 'block';
    
    // Load active rooms
    await loadAvailableRooms();
  }
}

/**
 * Load all active rooms that members can join
 */
async function loadAvailableRooms() {
  try {
    const roomsList = document.getElementById('availableRoomsList');
    if (!roomsList) return;

    // Query for active and pending sessions
    const roomsQuery = query(
      collection(db, 'video_sessions'),
      where('status', 'in', ['pending', 'ongoing'])
    );
    
    const snapshot = await getDocs(roomsQuery);

    if (snapshot.empty) {
      roomsList.innerHTML = '<p style="color: #cbd5e1; text-align: center; padding: 2rem;">No available conferences at the moment. Check back later!</p>';
      return;
    }

    let html = '<div style="display: grid; gap: 1rem;">';
    
    snapshot.docs.forEach(doc => {
      const session = doc.data();
      const participantCount = session.participants ? session.participants.length : 0;
      const createdTime = session.createdAt?.toDate?.();
      const timeStr = createdTime ? createdTime.toLocaleTimeString() : 'Unknown';
      
      // Determine status badge
      let statusBadge = '';
      let statusColor = '';
      let canJoin = true;
      
      if (session.status === 'ongoing' && participantCount > 0) {
        statusBadge = '<span style="background: #22c55e; color: white; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;">🔴 ONGOING</span>';
        statusColor = '#22c55e';
      } else if (session.status === 'pending' || participantCount <= 1) {
        statusBadge = '<span style="background: #f59e0b; color: white; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;">⏳ PENDING</span>';
        statusColor = '#f59e0b';
      } else {
        statusBadge = '<span style="background: #ef4444; color: white; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;">✕ ENDED</span>';
        statusColor = '#ef4444';
        canJoin = false;
      }

      const joinButton = canJoin 
        ? `<button onclick="joinRoomAsGuest('${session.roomId}')" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; transition: background 0.2s;">
            <i class="fas fa-sign-in-alt"></i> Join
          </button>`
        : `<button disabled style="background: #64748b; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: not-allowed; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
            <i class="fas fa-times"></i> Ended
          </button>`;

      html += `
        <div style="background: #1e293b; padding: 1.5rem; border-radius: 0.5rem; border-left: 4px solid ${statusColor};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                <h3 style="margin: 0; color: #e2e8f0; word-break: break-all;">
                  <i class="fas fa-door-open"></i> ${session.roomId}
                </h3>
                ${statusBadge}
              </div>
              <p style="margin: 0.25rem 0; color: #cbd5e1; font-size: 0.9rem;">
                Hosted by: <strong>${session.creatorName}</strong>
              </p>
              <p style="margin: 0.25rem 0; color: #94a3b8; font-size: 0.85rem;">
                Started: ${timeStr} | Participants: <strong>${participantCount}</strong>
              </p>
            </div>
            ${joinButton}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    roomsList.innerHTML = html;

  } catch (error) {
    console.error('Error loading available rooms:', error);
    const roomsList = document.getElementById('availableRoomsList');
    if (roomsList) {
      roomsList.innerHTML = '<p style="color: #ef4444;">Error loading rooms. Please try again.</p>';
    }
  }
}

/**
 * Generate a unique room ID
 * Format: conference-YYYYMMDD-HHMMSS-RANDOM
 */
function generateRoomId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '');
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `conference-${dateStr}-${randomStr}`;
}

/**
 * Join a room as a guest (member)
 */
async function joinRoomAsGuest(roomId) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showAlert('Authentication error. Please log in again.', 'error');
      return;
    }

    // Get member's name from user email
    const displayName = currentUser.displayName || currentUser.email.split('@')[0];

    // Verify room exists
    const sessionQuery = query(
      collection(db, 'video_sessions'),
      where('roomId', '==', roomId),
      where('status', 'in', ['pending', 'ongoing'])
    );
    
    const sessionSnapshot = await getDocs(sessionQuery);
    
    if (sessionSnapshot.empty) {
      showAlert('Room not found or no longer available', 'error');
      // Refresh available rooms
      await loadAvailableRooms();
      return;
    }

    const sessionDoc = sessionSnapshot.docs[0];
    const sessionData = sessionDoc.data();
    currentSessionId = sessionDoc.id;
    
    // Update session with new participant
    const participants = sessionData.participants || [];
    const participantExists = participants.some(p => p.email === currentUser.email);
    
    if (!participantExists) {
      participants.push({
        email: currentUser.email,
        name: displayName,
        joinedAt: new Date()
      });
    }

    // Update status to 'ongoing' if not already, and update participants
    const updateData = {
      participants: participants,
      maxParticipants: Math.max(sessionData.maxParticipants || 0, participants.length)
    };

    // Mark as ongoing when first member joins (only if it was pending)
    if (sessionData.status === 'pending' && participants.length > 1) {
      updateData.status = 'ongoing';
      updateData.startedAt = serverTimestamp();
    }

    await updateDoc(sessionDoc.ref, updateData);

    currentUserName = displayName;
    showAlert(`Joining room: ${roomId}...`, 'success');
    setTimeout(() => {
      launchJitsiMeet(roomId, displayName);
    }, 500);

  } catch (error) {
    console.error('Error joining room:', error);
    showAlert(`Error joining room: ${error.message}`, 'error');
  }
}

/**
 * Show alert message in setup screen
 */
function showAlert(message, type = 'error') {
  const alertEl = document.getElementById('setupAlert');
  if (!alertEl) return;
  
  alertEl.textContent = message;
  alertEl.className = `alert show alert-${type}`;
  
  if (type === 'success') {
    setTimeout(() => alertEl.classList.remove('show'), 3000);
  }
}

/**
 * Create a new video conference room (Admin only)
 */
async function createNewRoom() {
  // Only admins can create rooms
  if (userRole !== 'admin') {
    showAlert('Only administrators can create rooms', 'error');
    return;
  }

  const userName = document.getElementById('userName').value.trim();
  
  if (!userName) {
    showAlert('Please enter your name', 'error');
    return;
  }

  try {
    const roomId = generateRoomId();
    currentUserName = userName;
    
    // Get current user
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showAlert('Authentication error. Please log in again.', 'error');
      return;
    }

    // Create session record in Firestore (optional tracking)
    const sessionRef = await addDoc(collection(db, 'video_sessions'), {
      roomId: roomId,
      creatorEmail: currentUser.email,
      creatorName: userName,
      createdAt: serverTimestamp(),
      startedAt: null, // Will be set when first participant joins
      status: 'pending', // pending, ongoing, ended
      participants: [{ email: currentUser.email, name: userName, joinedAt: new Date() }],
      maxParticipants: 1
    });

    currentSessionId = sessionRef.id;
    
    showAlert(`Room created! Starting conference...`, 'success');
    setTimeout(() => {
      launchJitsiMeet(roomId, userName);
    }, 500);
    
  } catch (error) {
    console.error('Error creating room:', error);
    showAlert(`Error creating room: ${error.message}`, 'error');
  }
}

/**
 * Join an existing video conference room
 */
async function joinExistingRoom() {
  const roomId = document.getElementById('roomIdInput').value.trim();
  const userName = document.getElementById('joinUserName').value.trim();
  
  if (!roomId || !userName) {
    showAlert('Please enter both room ID and your name', 'error');
    return;
  }

  try {
    currentUserName = userName;
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      showAlert('Authentication error. Please log in again.', 'error');
      return;
    }

    // Check if room exists in Firestore and update participants (optional)
    const sessionQuery = query(
      collection(db, 'video_sessions'),
      where('roomId', '==', roomId),
      where('status', '==', 'active')
    );
    
    const sessionSnapshot = await getDocs(sessionQuery);
    
    if (sessionSnapshot.empty) {
      showAlert('Room not found or session is no longer active', 'error');
      return;
    }

    const sessionDoc = sessionSnapshot.docs[0];
    currentSessionId = sessionDoc.id;
    
    // Update session with new participant
    const participants = sessionDoc.data().participants || [];
    participants.push({
      email: currentUser.email,
      name: userName,
      joinedAt: serverTimestamp()
    });

    await updateDoc(sessionDoc.ref, {
      participants: participants,
      maxParticipants: Math.max(sessionDoc.data().maxParticipants || 0, participants.length)
    });

    showAlert(`Joining room: ${roomId}...`, 'success');
    setTimeout(() => {
      launchJitsiMeet(roomId, userName);
    }, 500);

  } catch (error) {
    console.error('Error joining room:', error);
    showAlert(`Error joining room: ${error.message}`, 'error');
  }
}

/**
 * Launch Jitsi Meet embedded conference
 */
function launchJitsiMeet(roomId, displayName) {
  currentRoomId = roomId;
  isInConference = true;

  // Hide setup screen and show Jitsi container
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('jitsiContainer').style.display = 'flex';
  document.getElementById('controlPanel').style.display = 'flex';
  document.getElementById('roomInfo').style.display = 'flex';
  document.getElementById('displayRoomId').textContent = roomId;

  // Jitsi Meet options
  const options = {
    roomName: roomId,
    width: '100%',
    height: '100%',
    parentNode: document.querySelector('#jitsi-iframe'),
    userInfo: {
      displayName: displayName,
      email: auth.currentUser?.email || 'anonymous@example.com'
    },
    configOverwrite: {
      startWithAudioMuted: false,
      startWithVideoMuted: false,
      disableSimulcast: false,
      p2p: {
        enabled: true
      },
      prejoinPageEnabled: false,
      defaultLanguage: 'en'
    },
    interfaceConfigOverwrite: {
      MOBILE_APP_PROMO: false,
      SHOW_JITSI_WATERMARK: false,
      DEFAULT_BACKGROUND: '#0f172a'
    },
    jwt: undefined // You can optionally add JWT token for better security
  };

  // Initialize Jitsi Meet API
  jitsiApi = new window.JitsiMeetExternalAPI('meet.jit.si', options);

  // Handle various Jitsi events
  jitsiApi.addEventListener('participantJoined', onParticipantJoined);
  jitsiApi.addEventListener('participantLeft', onParticipantLeft);
  jitsiApi.addEventListener('readyToClose', onReadyToClose);
  jitsiApi.addEventListener('displayNameChange', onDisplayNameChange);
  jitsiApi.addEventListener('participantKicked', onParticipantKicked);

  console.log(`✓ Jitsi Meet conference launched in room: ${roomId}`);
}

/**
 * Handle participant joined event
 */
function onParticipantJoined(event) {
  console.log('Participant joined:', event.participantId);
  participants.add(event.participantId);
  updateParticipantCount();
  updateParticipantsList();
}

/**
 * Handle participant left event
 */
function onParticipantLeft(event) {
  console.log('Participant left:', event.participantId);
  participants.delete(event.participantId);
  updateParticipantCount();
  updateParticipantsList();
}

/**
 * Handle display name change
 */
function onDisplayNameChange(event) {
  console.log('Display name changed:', event.displayname);
}

/**
 * Handle participant kicked
 */
function onParticipantKicked(event) {
  console.log('Participant kicked:', event);
}

/**
 * Handle ready to close event
 */
async function onReadyToClose() {
  console.log('Conference ended');
  await cleanupSession();
  leaveRoom();
}

/**
 * Update participant count
 */
function updateParticipantCount() {
  const count = participants.size + 1; // +1 for current user
  document.getElementById('participantCount').textContent = count;
}

/**
 * Update participants list
 */
function updateParticipantsList() {
  const list = document.getElementById('participantsList');
  if (jitsiApi) {
    try {
      const info = jitsiApi.getAvailableDevices();
      console.log('Participant info:', info);
      // Note: Getting individual participant details requires additional API calls
      // This is a simplified implementation
    } catch (e) {
      console.log('Could not fetch participant details');
    }
  }
}

/**
 * Toggle participants list visibility
 */
function toggleParticipants() {
  const list = document.getElementById('participantsList');
  list.style.display = list.style.display === 'none' ? 'block' : 'none';
}

/**
 * Copy room ID to clipboard
 */
async function copyRoomId() {
  if (!currentRoomId) return;
  
  try {
    await navigator.clipboard.writeText(currentRoomId);
    const btn = event.target.closest('button');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy room ID:', error);
  }
}

/**
 * Leave the video conference
 */
async function leaveRoom() {
  try {
    if (jitsiApi) {
      jitsiApi.dispose();
      jitsiApi = null;
    }

    await cleanupSession();

    // Reset UI
    isInConference = false;
    currentRoomId = null;
    participants.clear();

    document.getElementById('jitsiContainer').style.display = 'none';
    document.getElementById('controlPanel').style.display = 'none';
    document.getElementById('roomInfo').style.display = 'none';
    document.getElementById('setupScreen').style.display = 'flex';
    
    // Clear inputs
    document.getElementById('userName').value = '';
    document.getElementById('roomIdInput').value = '';
    document.getElementById('joinUserName').value = '';

    showAlert('You left the conference', 'success');

  } catch (error) {
    console.error('Error leaving room:', error);
  }
}

/**
 * Cleanup session in Firestore
 */
async function cleanupSession() {
  if (!currentSessionId) return;

  try {
    // Update session status to ended
    await updateDoc(doc(db, 'video_sessions', currentSessionId), {
      status: 'ended',
      endedAt: serverTimestamp()
    });

    currentSessionId = null;
    console.log('✓ Session ended and marked in database');

  } catch (error) {
    console.error('Error cleaning up session:', error);
  }
}

/**
 * Navigate back to member page
 */
function goBack() {
  if (isInConference) {
    if (confirm('You are currently in a conference. Do you want to leave?')) {
      leaveRoom();
      setTimeout(() => {
        window.location.href = 'member.html';
      }, 500);
    }
  } else {
    window.location.href = 'member.html';
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', async (e) => {
  if (isInConference) {
    e.preventDefault();
    e.returnValue = 'You are currently in a conference. Are you sure you want to leave?';
    await leaveRoom();
  }
});

// Export functions for global access
window.createNewRoom = createNewRoom;
window.joinRoomAsGuest = joinRoomAsGuest;
window.loadAvailableRooms = loadAvailableRooms;
window.leaveRoom = leaveRoom;
window.toggleParticipants = toggleParticipants;
window.copyRoomId = copyRoomId;
window.goBack = goBack;
