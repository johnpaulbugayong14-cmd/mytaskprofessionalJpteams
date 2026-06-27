import { collection, doc, getDoc, onSnapshot, orderBy, query, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';

    const sender = msg.senderName || getUserName(msg.senderEmail) || 'Unknown';
    const timestamp = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const text = msg.deleted ? 'This message was unsent.' : msg.text || '';

    let html = `<strong>${sender}</strong>`;
    html += `<div>${escapeHtml(text)}</div>`;

    if (msg.imageData) {
      html += `<img class="chat-image" src="${escapeHtml(msg.imageData)}" alt="Chat image" loading="lazy" />`;
    }

    html += `<div class="chat-message-time">${timestamp}</div>`;
    messageDiv.innerHTML = html;

    chatMessagesEl.appendChild(messageDiv);
  });

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

  const currentEmail = await getStoredUserEmail();
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
