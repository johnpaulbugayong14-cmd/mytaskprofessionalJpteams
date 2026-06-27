import { collection, doc, getDoc, onSnapshot, orderBy, query, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { requireAuth, getStoredUserEmail } from "./auth.js";

const members = [
  { uid: "everyone", name: "Everyone" },
  { uid: "kingfordnabor@gmail.com", name: "Kingford Nabor" },
  { uid: "allancorral@gmail.com", name: "Allan Corral" },
  { uid: "phricksborebor@gmail.com", name: "Phricks Borebor" },
  { uid: "moezarperez@gmail.com", name: "Moezar Perez" },
  { uid: "rogelioledda@gmail.com", name: "Rogelio Ledda" },
  { uid: "johnpaulbugayong@gmail.com", name: "Admin" }
];

let selectedChatId = null;
let chatMessagesUnsubscribe = null;
let selectedChatImageData = null;
let selectedChatImageName = null;
let chatMessagesById = {};
let currentUserEmail = null;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getUserName(email) {
  const normalized = normalizeEmail(email);
  const member = members.find(m => normalizeEmail(m.uid) === normalized);
  return member ? member.name : email;
}

function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function showError(message) {
  const errorEl = document.getElementById('chatError');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function clearError() {
  const errorEl = document.getElementById('chatError');
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.style.display = 'none';
}

function renderChatMessages(messages) {
  const chatMessagesEl = document.getElementById('chatMessages');
  if (!chatMessagesEl) return;

  if (!messages || messages.length === 0) {
    chatMessagesEl.innerHTML = '<p style="color: #94a3b8; text-align: center; margin: 1rem 0;">No messages yet. Start the conversation!</p>';
    return;
  }

  chatMessagesEl.innerHTML = '';
  chatMessagesById = {};

  messages.forEach((msg) => {
    chatMessagesById[msg.id] = msg;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message';
    msgDiv.style.opacity = msg.deleted ? '0.75' : '1';

    const sender = msg.senderName || getUserName(msg.senderEmail) || 'Unknown';
    const timestamp = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const messageText = msg.deleted ? 'This message was unsent.' : msg.text || '';
    const safeText = escapeHtml(messageText);
    const renderedText = safeText;
    const imageMarkup = !msg.deleted && msg.imageData ? `<div style="margin: 0.75rem 0;"><img class="chat-image" src="${escapeHtml(msg.imageData)}" alt="Chat image" loading="lazy" /></div>` : '';
    const normalizedCurrentUserEmail = normalizeEmail(currentUserEmail || '');
    const isOwnMessage = normalizedCurrentUserEmail && normalizeEmail(msg.senderEmail) === normalizedCurrentUserEmail;
    const unsendButton = isOwnMessage && !msg.deleted ? `<button type="button" class="chat-unsend-btn" data-message-id="${msg.id}" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(248, 113, 113, 0.12); color: #f97316; border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">Unsend</button>` : '';
    const actionButtons = [unsendButton].filter(Boolean).join('<span style="margin: 0 0.35rem; color: #374151;">|</span>');

    msgDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.35rem;">
        <div style="font-size: 0.9rem; color: #94a3b8;">${escapeHtml(sender)}</div>
        <div style="font-size: 0.8rem; color: #6b7280;">${timestamp}</div>
      </div>
      <div style="color: ${msg.deleted ? '#9ca3af' : '#e5e7eb'}; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">
        ${imageMarkup}${renderedText}
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; margin-bottom: ${msg.reactions && Object.keys(msg.reactions).length > 0 ? '0.5rem' : '0'};">
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">${actionButtons}</div>
        ${!msg.deleted ? `<button type="button" class="chat-react-btn" data-message-id="${msg.id}" style="display: inline-flex; align-items: center; justify-content: center; width: auto; background: rgba(249, 115, 22, 0.12); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.35); border-radius: 9999px; cursor: pointer; padding: 0.2rem 0.5rem; font-size: 0.75rem; line-height: 1; white-space: nowrap;">😊 React</button>` : ''}
      </div>
      ${msg.reactions && Object.keys(msg.reactions).length > 0 ? `
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; padding-top: 0.5rem; border-top: 1px solid #374151;">
          ${Object.entries(msg.reactions).map(([emoji, users]) => `
            <div class="chat-reaction-badge" data-message-id="${msg.id}" data-emoji="${emoji}" data-users='${JSON.stringify(users)}' style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 9999px; font-size: 0.8rem; cursor: pointer;">
              <span>${emoji}</span>
              <span style="color: #94a3b8;">${users.length}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;

    chatMessagesEl.appendChild(msgDiv);
  });

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

  const reactBtns = chatMessagesEl.querySelectorAll('.chat-react-btn');
  reactBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const messageId = this.dataset.messageId;
      showReactionMenu(messageId, e);
    });
  });

  const unsendBtns = chatMessagesEl.querySelectorAll('.chat-unsend-btn');
  unsendBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const messageId = this.dataset.messageId;
      unsendChatMessage(selectedChatId, messageId);
    });
  });

  const reactionBadges = chatMessagesEl.querySelectorAll('.chat-reaction-badge');
  reactionBadges.forEach(badge => {
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      const emoji = this.dataset.emoji;
      const users = JSON.parse(this.dataset.users);
      showReactionDetails(emoji, users);
    });
    badge.addEventListener('mouseover', function() {
      this.style.background = 'rgba(96, 165, 250, 0.2)';
    });
    badge.addEventListener('mouseout', function() {
      this.style.background = 'rgba(96, 165, 250, 0.1)';
    });
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showReactionDetails(emoji, users) {
  let modal = document.getElementById('chatReactionDetailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'chatReactionDetailsModal';
    modal.style.cssText = 'position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(15, 23, 42, 0.9); z-index: 100000;';
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.remove();
    });
    const content = document.createElement('div');
    content.style.cssText = 'width: min(420px, 100%); background: #0f172a; border: 1px solid #374151; border-radius: 1rem; padding: 1.25rem; color: #e5e7eb;';
    content.id = 'chatReactionDetailsContent';
    modal.appendChild(content);
    document.body.appendChild(modal);
  }

  const content = document.getElementById('chatReactionDetailsContent');
  if (!content) return;

  content.innerHTML = `
    <div style="font-size: 2.5rem; text-align: center; margin-bottom: 0.75rem;">${escapeHtml(emoji)}</div>
    <div style="text-align: center; color: #94a3b8; margin-bottom: 1rem;">${users.length} ${users.length === 1 ? 'person reacted' : 'people reacted'}</div>
    <div style="display: grid; gap: 0.5rem; max-height: 280px; overflow-y: auto; margin-bottom: 1rem;">
      ${users.map(user => `<div style="padding: 0.75rem 0.85rem; border-radius: 0.75rem; background: #111827; color: #e5e7eb;">${escapeHtml(user)}</div>`).join('')}
    </div>
    <button type="button" onclick="document.getElementById('chatReactionDetailsModal')?.remove();" style="width: 100%; padding: 0.85rem 1rem; border: none; border-radius: 0.75rem; background: #3b82f6; color: white; cursor: pointer;">Close</button>
  `;
}

function showReactionMenu(messageId, event) {
  let menu = document.getElementById('chatReactionMenu');
  if (menu) menu.remove();

  const emojis = ['😀', '😂', '😢', '😠', '❤️', '👍', '🎉'];
  menu = document.createElement('div');
  menu.id = 'chatReactionMenu';
  menu.style.cssText = 'position: fixed; z-index: 100000; display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 0.75rem; background: #0f172a; border: 1px solid #374151; border-radius: 1rem; box-shadow: 0 10px 40px rgba(0,0,0,0.25);';

  emojis.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = emoji;
    btn.style.cssText = 'width: 2.5rem; height: 2.5rem; font-size: 1.2rem; border: none; border-radius: 0.75rem; background: #111827; color: #f8fafc; cursor: pointer;';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMessageReaction(messageId, emoji);
      menu.remove();
    });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  const x = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 16);
  const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 16);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const removeMenu = () => menu?.remove();
  setTimeout(() => {
    window.addEventListener('click', removeMenu, { once: true });
  }, 0);
}

async function toggleMessageReaction(messageId, emoji) {
  if (!selectedChatId || !messageId || !currentUserEmail) return;

  const messageRef = doc(db, 'liveChats', selectedChatId, 'messages', messageId);
  try {
    const messageSnap = await getDoc(messageRef);
    if (!messageSnap.exists()) return;

    const messageData = messageSnap.data();
    const reactions = messageData.reactions || {};
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    const normalizedUsers = reactions[emoji].map(normalizeEmail);
    const current = normalizeEmail(currentUserEmail);
    const userIndex = normalizedUsers.indexOf(current);
    if (userIndex >= 0) {
      reactions[emoji] = reactions[emoji].filter(u => normalizeEmail(u) !== current);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji].push(currentUserEmail);
    }

    await updateDoc(messageRef, { reactions });
  } catch (error) {
    console.error('Failed to update reaction:', error);
  }
}

async function unsendChatMessage(chatId, messageId) {
  if (!chatId || !messageId || !currentUserEmail) return;

  const messageRef = doc(db, 'liveChats', chatId, 'messages', messageId);
  try {
    await updateDoc(messageRef, {
      deleted: true,
      text: 'This message was unsent.',
      unsentAt: Date.now()
    });
  } catch (error) {
    console.error('Failed to unsend chat message:', error);
  }
}

function updateChatImagePreview() {
  const preview = document.getElementById('chatImagePreview');
  if (!preview) return;

  if (!selectedChatImageData) {
    preview.style.display = 'none';
    preview.innerHTML = '';
    return;
  }

  preview.style.display = 'block';
  preview.innerHTML = `
    <img src="${escapeHtml(selectedChatImageData)}" alt="Selected image preview" />
    <button id="clearImageSelection" type="button" style="background: rgba(248, 113, 113, 0.15); color: #f97316; border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 9999px; padding: 0.6rem 1rem; cursor: pointer;">Remove</button>
  `;

  const clearButton = document.getElementById('clearImageSelection');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      selectedChatImageData = null;
      selectedChatImageName = null;
      const input = document.getElementById('chatImageInput');
      if (input) input.value = '';
      updateChatImagePreview();
    });
  }
}

function triggerChatImageInput() {
  const input = document.getElementById('chatImageInput');
  if (input) input.click();
}

function handleChatImageInputChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    selectedChatImageData = null;
    selectedChatImageName = null;
    updateChatImagePreview();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    selectedChatImageData = reader.result;
    selectedChatImageName = file.name;
    updateChatImagePreview();
  };
  reader.readAsDataURL(file);
}

async function subscribeChatMessages(chatId) {
  if (chatMessagesUnsubscribe) {
    chatMessagesUnsubscribe();
  }

  const messagesQuery = query(collection(db, 'liveChats', chatId, 'messages'), orderBy('createdAt', 'asc'));
  chatMessagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
    const messages = [];
    snapshot.forEach((docSnap) => messages.push({ id: docSnap.id, ...docSnap.data() }));
    renderChatMessages(messages);
  }, (error) => {
    console.error('Chat messages listener error:', error);
    showError('Unable to load chat messages right now.');
  });
}

async function sendChatMessage(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (!selectedChatId) return;

  const messageInput = document.getElementById('chatMessageInput');
  if (!messageInput) return;

  const message = messageInput.value.trim();
  if (!message && !selectedChatImageData) return;

  const currentEmail = currentUserEmail || await getStoredUserEmail();
  const messageData = {
    senderEmail: currentEmail,
    senderName: getUserName(currentEmail),
    text: message || '',
    createdAt: Date.now(),
    deleted: false
  };

  if (selectedChatImageData) {
    messageData.imageData = selectedChatImageData;
    if (selectedChatImageName) messageData.imageName = selectedChatImageName;
  }

  try {
    await addDoc(collection(db, 'liveChats', selectedChatId, 'messages'), messageData);
    messageInput.value = '';
    selectedChatImageData = null;
    selectedChatImageName = null;
    updateChatImagePreview();
  } catch (error) {
    console.error('Failed to send chat message:', error);
    showError('Unable to send message. Please try again.');
  }
}

async function loadChatRoomInfo(chatId) {
  const chatDoc = await getDoc(doc(db, 'liveChats', chatId));
  if (!chatDoc.exists()) {
    showError('Chat room not found.');
    return;
  }

  const data = chatDoc.data();
  const titleEl = document.getElementById('chatTitle');
  const metaEl = document.getElementById('chatMeta');
  const statusEl = document.getElementById('chatStatus');

  if (titleEl) titleEl.textContent = data.title || 'Live Chat';
  if (metaEl) metaEl.textContent = `Created by ${data.createdByName || getUserName(data.createdByEmail)} • ${new Date(data.createdAt).toLocaleString()}`;
  if (statusEl) {
    statusEl.textContent = `Status: ${data.status || 'Active'}`;
    statusEl.style.background = data.status === 'Closed' ? '#7f1d1d' : '#1f2937';
  }

  clearError();
  subscribeChatMessages(chatId);
}

function setupBackButton(from) {
  const backButton = document.getElementById('backButton');
  if (!backButton) return;
  if (from === 'admin') {
    backButton.addEventListener('click', () => { window.location.href = 'admin.html'; });
  } else {
    backButton.addEventListener('click', () => { window.location.href = 'member.html'; });
  }
}

async function init() {
  await requireAuth(['member', 'admin']);
  currentUserEmail = await getStoredUserEmail();

  selectedChatId = getQueryParam('chatId');
  const from = getQueryParam('from') || 'member';

  if (!selectedChatId) {
    showError('Chat room ID is missing.');
    return;
  }

  setupBackButton(from);
  document.getElementById('attachImageButton')?.addEventListener('click', triggerChatImageInput);
  document.getElementById('chatImageInput')?.addEventListener('change', handleChatImageInputChange);
  document.getElementById('chatMessageForm')?.addEventListener('submit', sendChatMessage);

  await loadChatRoomInfo(selectedChatId);
}

init().catch((error) => {
  console.error('Chat page initialization failed:', error);
  showError('Unable to initialize chat page. Please try again.');
});
