// Push Notifications Manager for cross-platform compatibility
class PushNotificationsManager {
  constructor() {
    this.isCapacitor = false;
    this.pushNotifications = null;
    this.initialized = false;

    // Check for Capacitor more reliably
    this.checkCapacitorAvailability();
  }

  async checkCapacitorAvailability() {
    // Wait a bit for Capacitor to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    this.isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

    if (this.isCapacitor) {
      try {
        const module = await import('@capacitor/push-notifications');
        this.pushNotifications = module.PushNotifications;
        console.log('Capacitor PushNotifications loaded successfully');
      } catch (err) {
        console.warn('Capacitor PushNotifications not available:', err);
        this.isCapacitor = false;
      }
    } else {
      console.log('Running in browser, push notifications disabled');
    }

    this.initialized = true;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.checkCapacitorAvailability();
    }
  }

  async requestPermissions() {
    await this.ensureInitialized();

    if (this.isCapacitor && this.pushNotifications) {
      try {
        return await this.pushNotifications.requestPermissions();
      } catch (error) {
        console.error('Error requesting push notification permissions:', error);
        return { granted: false };
      }
    }
    return { granted: false };
  }

  async register() {
    await this.ensureInitialized();

    if (this.isCapacitor && this.pushNotifications) {
      try {
        return await this.pushNotifications.register();
      } catch (error) {
        console.error('Error registering for push notifications:', error);
      }
    }
  }

  addListener(event, callback) {
    if (this.isCapacitor && this.pushNotifications) {
      try {
        return this.pushNotifications.addListener(event, callback);
      } catch (error) {
        console.error('Error adding push notification listener:', error);
      }
    }
  }
}

import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db } from "./firebase.js";
import { signOutUser, getStoredUserEmail, getStoredUserRole } from "./auth.js";
import { sendNotificationToUsers, showLocalNotification, initializeNotifications } from "./notifications.js";

window.signOutUser = signOutUser;

const pushNotificationsManager = new PushNotificationsManager();

let chart;
let chartUpdateTimeout;
let lastMemberProgress = {};

window.lastMemberProgress = lastMemberProgress;

const progressReportCollection = "progressReports";
const progressReportDocId = "thesisProgress";
const progressStatuses = ["Not Started", "Pending", "Completed"];

let members = [
  { uid: "everyone", name: "Everyone" },
  { uid: "kingfordnabor@gmail.com", name: "Kingford Nabor" },
  { uid: "allancorral@gmail.com", name: "Allan Corral" },
  { uid: "phricksborebor@gmail.com", name: "Phricks Borebor" },
  { uid: "moezarperez@gmail.com", name: "Moezar Perez" },
  { uid: "test@example.com", name: "Test User" },
  { uid: "rogelioledda@gmail.com", name: "Rogelio Ledda" }
];

(async () => {
  // Retry getting admin credentials if first attempt fails (to handle timing issues)
  let adminEmail = await getStoredUserEmail();
  let adminRole = await getStoredUserRole();
  let retries = 0;
  
  while ((!adminEmail || !adminRole) && retries < 5) {
    if (!adminEmail) adminEmail = await getStoredUserEmail();
    if (!adminRole) adminRole = await getStoredUserRole();
    if (!adminEmail || !adminRole) {
      retries++;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

function getDefaultProgressStructure() {
  return [
    {
      title: "Front Matter",
      items: [
        { name: "Title Page", status: "Not Started" },
        { name: "Approval Sheet", status: "Not Started" },
        { name: "Abstract", status: "Not Started" },
        { name: "Acknowledgement", status: "Not Started" },
        { name: "Table of Contents", status: "Not Started" },
        { name: "List of Tables (if applicable)", status: "Not Started" },
        { name: "List of Figures (if applicable)", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 1 – Introduction",
      items: [
        { name: "Introduction", status: "Not Started" },
        { name: "Background of the Study", status: "Not Started" },
        { name: "Theoretical Framework", status: "Not Started" },
        { name: "Conceptual Framework", status: "Not Started" },
        { name: "Statement of the Problem", status: "Not Started" },
        { name: "Objectives of the Study", status: "Not Started" },
        { name: "Scope and limitation", status: "Not Started" },
        { name: "Significance of the Study", status: "Not Started" },
        { name: "Definition of Terms", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 2 – Review of Related Literature (RRL)",
      items: [
        { name: "Introduction", status: "Not Started" },
        { name: "Thematic Arrangement of Articles", status: "Not Started" },
        { name: "Research Gaps", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 3 – Methodology",
      items: [
        { name: "Introduction", status: "Not Started" },
        { name: "Research design", status: "Not Started" },
        { name: "Diagram (Flowchart or Block Diagram)", status: "Not Started" },
        { name: "Material and Instrument", status: "Not Started" },
        { name: "Locale and Population of Research", status: "Not Started" },
        { name: "Statistical treatment of Research", status: "Not Started" },
        { name: "Design of Prototype", status: "Not Started" },
        { name: "Cost Benefit Analysis", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 4 – Results and Discussion",
      items: [
        { name: "Presentation of data", status: "Not Started" },
        { name: "Analysis and interpretation", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 5 – Conclusion and Recommendations",
      items: [
        { name: "Summary of findings", status: "Not Started" },
        { name: "Conclusion", status: "Not Started" },
        { name: "Recommendations", status: "Not Started" }
      ]
    },
    {
      title: "Back Matter",
      items: [
        { name: "References / Bibliography", status: "Not Started" },
        { name: "Appendices (survey forms, codes, drawings, etc.)", status: "Not Started" }
      ]
    }
  ];
}

function renderAdminProgressReport(sections) {
  console.log('=== RENDER ADMIN PROGRESS REPORT CALLED ===');
  console.log('Sections to render:', sections);
  const container = document.getElementById("progressReportPanel");
  console.log('Progress report panel element:', container);

  if (!container) {
    console.error('Progress report panel not found!');
    return;
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    console.log('No sections to render');
    container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No progress report data yet.</p>';
    return;
  }

  console.log('Rendering', sections.length, 'sections');
  container.innerHTML = sections.map((section, sectionIndex) => `
    <div style="margin-bottom: 1.25rem;">
      <h3 style="margin: 0 0 0.75rem 0; color: #0ea5e9;">${section.title}</h3>
      ${Array.isArray(section.items) ? section.items.map((item, itemIndex) => {
        const assignedToValue = Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []);
        return `
          <div style="display: grid; gap: 0.75rem; margin-bottom: 0.65rem; padding: 0.75rem; background: #111827; border: 1px solid #374151; border-radius: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
              <span style="color: #d1d5db;">${item.name}</span>
              <select id="progress-${sectionIndex}-${itemIndex}" style="background: #0f172a; color: #f8fafc; border: 1px solid #4b5563; border-radius: 0.375rem; padding: 0.25rem 0.5rem; font-size: 0.875rem;">
                <option value="Not Started" ${item.status === 'Not Started' || !item.status ? 'selected' : ''}>Not Started</option>
                <option value="Pending" ${item.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Completed" ${item.status === 'Completed' ? 'selected' : ''}>Completed</option>
              </select>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;">
              <label style="color: #cbd5e1; font-size: 0.9rem; min-width: 120px;">Assign to:</label>
              <select id="assignedTo-${sectionIndex}-${itemIndex}" multiple style="background: #0f172a; color: #f8fafc; border: 1px solid #4b5563; border-radius: 0.375rem; padding: 0.45rem 0.6rem; min-width: 180px; min-height: 40px;">
                <option value="" ${Array.isArray(assignedToValue) ? (!assignedToValue.includes('') && assignedToValue.length === 0) : assignedToValue === '' ? 'selected' : ''}>Unassigned</option>
                ${members.filter(member => member.uid !== 'everyone').map(member => `
                  <option value="${member.uid}" ${Array.isArray(assignedToValue) ? (assignedToValue.includes(member.uid) ? 'selected' : '') : (member.uid === assignedToValue ? 'selected' : '')}>${member.name}</option>
                `).join('')}
              </select>
            </div>
          </div>
        `;
      }).join('') : ''}
    </div>
  `).join('');
}

function getProgressFormValues() {
  const defaultSections = getDefaultProgressStructure();
  return defaultSections.map((section, sectionIndex) => ({
    title: section.title,
    items: section.items.map((item, itemIndex) => {
      const statusSelect = document.getElementById(`progress-${sectionIndex}-${itemIndex}`);
      const assignedSelect = document.getElementById(`assignedTo-${sectionIndex}-${itemIndex}`);
      const assignedTo = assignedSelect ? Array.from(assignedSelect.selectedOptions).map(option => option.value).filter(v => v !== '') : (Array.isArray(item.assignedTo) ? item.assignedTo : []);
      const assignedToName = assignedSelect ? Array.from(assignedSelect.selectedOptions).map(option => members.find(m => m.uid === option.value)?.name).filter(Boolean) : (Array.isArray(item.assignedToName) ? item.assignedToName : []);
      return {
        name: item.name,
        status: statusSelect ? statusSelect.value : item.status,
        assignedTo,
        assignedToName
      };
    })
  }));
}

window.saveProgressReport = async function() {
  try {
    const sections = getProgressFormValues();
    await setDoc(doc(db, progressReportCollection, progressReportDocId), { sections }, { merge: true });
    alert("Thesis progress saved successfully!");
  } catch (error) {
    console.error("Error saving progress report:", error);
    alert("Failed to save thesis progress. Please try again.");
  }
};

function loadMembers() {
  const select = document.getElementById("assignedTo");
  select.innerHTML = "";

  members.forEach(m => {
    select.innerHTML += `<option value="${m.uid}">${m.name}</option>`;
  });
}

function loadAnnouncementAssignTo() {
  const container = document.getElementById("announcementAssignTo");
  container.innerHTML = "";

  members.forEach(m => {
    container.innerHTML += `
      <label style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.9rem;">
        <input type="checkbox" value="${m.uid}" class="announcement-assign-checkbox">
        ${m.name}
      </label>
    `;
  });
}

loadMembers();
loadAnnouncementAssignTo();

  // Initialize notifications
  initializeNotifications();

  // Initialize native push notifications
  pushNotificationsManager.requestPermissions().then(result => {
    if (result.granted) {
      pushNotificationsManager.register();
    } else {
      console.log('Push notification permission denied');
    }
  });

  pushNotificationsManager.addListener('registration', token => {
    console.log('Push registration success, token: ', token.value);
    import('./notifications.js').then(m => {
      m.saveFcmTokenForCurrentUser(token.value);
    });
  });

  pushNotificationsManager.addListener('registrationError', err => {
    console.error('Registration error: ', err.error);
  });

  pushNotificationsManager.addListener('pushNotificationReceived', notification => {
    console.log('Push received: ', notification);
    showLocalNotification(notification.title, notification.body);
  });

  pushNotificationsManager.addListener('pushNotificationActionPerformed', notification => {
    console.log('Push action performed: ', notification);
  });

  // Set up listeners after authentication
  console.log('=== SETTING UP ADMIN LISTENERS ===');
  console.log('Admin authenticated, email:', adminEmail, 'role:', adminRole);

  /* LOAD TICKETS */
  onSnapshot(collection(db, "tickets"), (snap) => {
    console.log('=== ADMIN TICKETS LISTENER TRIGGERED ===');
    console.log('Tickets snapshot received, docs count:', snap.size);
    const container = document.getElementById("ticketsList");
    if (!container) return;
    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = "<p style='color: #94a3b8; text-align: center;'>No support tickets submitted yet.</p>";
      return;
    }

    const docs = [];
    snap.forEach(docSnap => docs.push(docSnap));
    docs.sort((a, b) => {
      const timeA = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() : (a.data().createdAt || 0);
      const timeB = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() : (b.data().createdAt || 0);
      return timeB - timeA;
    });

    docs.forEach(docSnap => {
      const ticket = docSnap.data();
      const createdDate = ticket.createdAt?.toDate?.() ? ticket.createdAt.toDate().toLocaleDateString() : "Unknown date";
      const responses = Array.isArray(ticket.responses) ? ticket.responses : [];
      const status = ticket.status || "open";

      const statusColor = status === "open" ? "#ef4444" : status === "pending validation" ? "#f59e0b" : "#10b981";
      const statusBg = status === "open" ? "rgba(239, 68, 68, 0.1)" : status === "pending validation" ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)";

      const responseHtml = responses.length > 0 ? responses.map(response => `
        <div style="margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #4b5563; border-radius: 0.375rem; background: #1f2937;">
          <div style="margin-bottom: 0.5rem;">
            <span style="font-weight: 600; color: #f3f4f6;">${response.author || 'Admin'}</span>
            <span style="font-size: 0.8rem; color: #9ca3af; margin-left: 0.5rem;">${formatCommentDate(response.createdAt)}</span>
          </div>
          <p class="comment-content" style="margin: 0; color: #d1d5db; white-space: pre-wrap;">${response.content}</p>
        </div>
      `).join('') : '';

      const closeButton = status !== 'closed' ? `
              <button onclick="window.changeTicketStatus('${docSnap.id}', 'closed')" style="background: #ef4444; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer;">Close Ticket</button>
      ` : '';
      const reopenButton = status === 'closed' ? `
              <button onclick="window.changeTicketStatus('${docSnap.id}', 'open')" style="background: #10b981; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer;">Reopen Ticket</button>
      ` : '';
      const pendingButton = status === 'open' ? `
              <button onclick="window.changeTicketStatus('${docSnap.id}', 'pending validation')" style="background: #f59e0b; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer;">Mark Pending</button>
      ` : '';

      const statusButtons = [pendingButton, closeButton, reopenButton].filter(Boolean).join('');

      const html = `
        <div style="margin-bottom: 1.5rem; padding: 1.5rem; border: 1px solid #374151; border-radius: 0.5rem; background: #1e293b;">
          <div style="margin-bottom: 1rem;">
            <h4 style="margin: 0 0 0.5rem 0; color: #f3f4f6;">${ticket.title}</h4>
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem;">
              <span style="font-size: 0.85rem; color: #9ca3af;">Submitted by: ${ticket.submittedByName || ticket.submittedBy}</span>
              <span style="font-size: 0.85rem; color: #9ca3af;">${createdDate}</span>
              <span style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: ${statusBg}; color: ${statusColor}; text-transform: uppercase;">${status}</span>
            </div>
          </div>
          
          <p style="margin: 0 0 1rem 0; color: #d1d5db; white-space: pre-wrap;">${ticket.description}</p>
          
          ${responseHtml ? `
            <div style="margin-bottom: 1rem;">
              <h5 style="margin: 0 0 0.75rem 0; color: #f3f4f6;">Responses (${responses.length})</h5>
              ${responseHtml}
            </div>
          ` : ''}
          
          <div style="padding: 1rem; background: #0f172a; border-radius: 0.5rem; border: 1px solid #374151;">
            <textarea id="responseInput-${docSnap.id}" rows="3" placeholder="Type your response..." style="width: 100%; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid #4b5563; background: #111827; color: #f3f4f6; margin-bottom: 0.75rem;"></textarea>
            <div style="display: flex; gap: 0.5rem;">
              <button onclick="window.respondToTicket('${docSnap.id}')" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer; flex: 1;">Send Response</button>
              ${statusButtons}
              <button onclick="window.deleteTicket('${docSnap.id}')" class="btn-danger" style="padding: 0.75rem 1rem;">Delete Ticket</button>
            </div>
          </div>
        </div>
      `;
      console.log('Generated ticket HTML:', html.substring(0, 200) + '...');
      container.innerHTML += html;
    });
  });

  /* LOAD RESOURCES */
  onSnapshot(collection(db, "resources"), (snap) => {
    console.log('=== ADMIN RESOURCES LISTENER TRIGGERED ===');
    console.log('Resources snapshot received, docs count:', snap.size);
    const container = document.getElementById("resourcesList");
    if (!container) return;
    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = "<p style='color: #94a3b8; text-align: center;'>No resources created yet.</p>";
      return;
    }

    const docs = [];
    snap.forEach(docSnap => docs.push(docSnap));
    docs.sort((a, b) => {
      const timeA = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() : (a.data().createdAt || 0);
      const timeB = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() : (b.data().createdAt || 0);
      return timeB - timeA;
    });

    docs.forEach(docSnap => {
      const resource = docSnap.data();
      const createdDate = resource.createdAt?.toDate?.() ? resource.createdAt.toDate().toLocaleDateString() : "Unknown date";

      container.innerHTML += `
        <div class="card" style="margin-bottom: 1rem;">
          <h4 style="margin-bottom: 0.5rem;">${resource.title}</h4>
          <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.75rem;">Posted: ${createdDate}</p>
          <p style="margin: 0.5rem 0; line-height: 1.4; color: #d1d5db;">${resource.description}</p>
          <div style="margin-top: 1rem;">
            <a href="${resource.link}" target="_blank" style="background: #10b981; color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; text-decoration: none; display: inline-block;">🔗 Open Resource</a>
            <button onclick="window.deleteResource('${docSnap.id}')" class="btn-danger" style="margin-left: 0.5rem; padding: 0.5rem 1rem;">🗑️ Delete</button>
          </div>
        </div>
      `;
    });
  });

function loadProgressReport() {
  console.log('=== LOAD PROGRESS REPORT CALLED ===');
  const container = document.getElementById("progressReportPanel");
  console.log('Progress report container element:', container);

  const progressRef = doc(db, progressReportCollection, progressReportDocId);
  console.log('Progress report reference:', progressRef);

  onSnapshot(progressRef, (snap) => {
    console.log('Progress report snapshot received:', snap.exists());
    let sections = getDefaultProgressStructure();
    if (snap.exists()) {
      const data = snap.data();
      console.log('Progress report data:', data);
      if (Array.isArray(data.sections)) {
        sections = data.sections.map(section => ({
          ...section,
          items: Array.isArray(section.items) ? section.items.map(item => ({
            assignedTo: Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []),
            assignedToName: Array.isArray(item.assignedToName) ? item.assignedToName : (item.assignedToName ? [item.assignedToName] : []),
            ...item
          })) : []
        }));
      } else {
        setDoc(progressRef, { sections }, { merge: true });
      }
    } else {
      console.log('Progress report document does not exist, creating default');
      setDoc(progressRef, { sections }, { merge: true });
    }
    renderAdminProgressReport(sections);
  });
}

/* CREATE TASK */
window.createTask = async function () {
  const title = document.getElementById("title").value.trim();
  const deadline = document.getElementById("deadline").value;
  const description = document.getElementById("description").value.trim();
  const assignedTo = document.getElementById("assignedTo").value;
  const link = document.getElementById("linkInput").value.trim();

  if (!title || !deadline || !assignedTo) {
    alert("Please fill all required fields.");
    return;
  }

  try {
    const member = members.find(m => m.uid === assignedTo) || members[0];

    const taskData = {
      title,
      description: description || "",
      deadline,
      assignedTo,
      assignedToName: member.name,
      linkURL: link || null,
      status: "pending",
      emailNotificationSent: false,
      createdAt: Date.now()
    };

    await addDoc(collection(db, "tasks"), taskData);

    // Send notification to assigned user
    if (assignedTo !== "everyone") {
      const notificationTitle = "New Task Assigned";
      const notificationBody = `You have been assigned a new task: "${title}"`;
      await sendNotificationToUsers([assignedTo], notificationTitle, notificationBody, 'task');
      showLocalNotification(notificationTitle, notificationBody);
    }

    document.getElementById("title").value = "";
    document.getElementById("deadline").value = "";
    document.getElementById("description").value = "";
    document.getElementById("assignedTo").value = "";
    document.getElementById("linkInput").value = "";

    alert("Task created successfully!");
  } catch (error) {
    console.error("Error creating task:", error);
    alert(`Failed to create task: ${error.message}`);
  }
};

/* DELETE TASK */
window.deleteTask = async function (id) {
  if (confirm("Are you sure you want to delete this task?")) {
    try {
      await deleteDoc(doc(db, "tasks", id));
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task. Please try again.");
    }
  }
};

/* MARK DONE */
window.markDone = async function (id) {
  try {
    const taskRef = doc(db, "tasks", id);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) {
      alert("Task not found.");
      return;
    }

    const task = taskSnap.data();
    const recipientEmail = task.assignedTo;
    const notificationTitle = "Task Marked Complete";
    const notificationBody = `Your task \"${task.title}\" has been marked as done by Admin.`;

    await updateDoc(taskRef, {
      status: "done",
      statusEmailNotificationSent: false,
      statusNotificationReason: "done",
      statusNotificationTitle: notificationTitle,
      statusNotificationMessage: notificationBody,
      statusNotificationAt: new Date()
    });

    if (recipientEmail) {
      await sendNotificationToUsers([recipientEmail], notificationTitle, notificationBody, 'task');
    }
  } catch (error) {
    console.error("Error marking done:", error);
    alert("Failed to mark task done. Please try again.");
  }
};

/* NEED ACTION */
window.needAction = async function (id) {
  if (confirm("Are you sure you want to mark this task as needing action? This will notify the assigned member(s).")) {
    try {
      const taskRef = doc(db, "tasks", id);
      const taskSnap = await getDoc(taskRef);
      if (!taskSnap.exists()) {
        alert("Task not found.");
        return;
      }

      const task = taskSnap.data();
      const recipientEmail = task.assignedTo;
      const notificationTitle = "Task Needs Your Attention";
      const notificationBody = `Your task \"${task.title}\" has been marked as needing action by Admin.`;

      await updateDoc(taskRef, {
        status: "needs action",
        statusEmailNotificationSent: false,
        statusNotificationReason: "needs_action",
        statusNotificationTitle: notificationTitle,
        statusNotificationMessage: notificationBody,
        statusNotificationAt: new Date()
      });

      if (recipientEmail) {
        await sendNotificationToUsers([recipientEmail], notificationTitle, notificationBody, 'task');
      }

      alert("Task has been marked as needing action. The member(s) will see the notification in their task list.");
    } catch (error) {
      console.error("Error marking task as needing action:", error);
      alert("Failed to mark task as needing action. Please try again.");
    }
  }
};

/* REALTIME + GRAPH */
onSnapshot(collection(db, "tasks"), (snap) => {
  const now = Date.now();
  const container = document.getElementById("tasks");

  const docs = [];
  snap.forEach(docSnap => docs.push(docSnap));
  docs.sort((a, b) => b.data().createdAt - a.data().createdAt);

  // Track progress by member for analytics
  const memberProgress = {};

  docs.forEach(docSnap => {
    const t = docSnap.data();
    const memberName = t.assignedToName || t.assignedTo || "Unassigned";

    let status = (t.status || "pending").toLowerCase().trim();
    if (new Date(t.deadline).getTime() < now && (status === "pending" || status === "pending validation")) {
      status = "overdue";
    }

    if (!memberProgress[memberName]) {
      memberProgress[memberName] = { done: 0, pending: 0, overdue: 0, needsAction: 0, pendingValidation: 0 };
    }

    if (status === "done") memberProgress[memberName].done++;
    else if (status === "overdue") memberProgress[memberName].overdue++;
    else if (status === "needs action") memberProgress[memberName].needsAction++;
    else if (status === "pending validation") memberProgress[memberName].pendingValidation++;
    else memberProgress[memberName].pending++;
  });

  // Update chart data store
  lastMemberProgress = memberProgress;
  window.lastMemberProgress = memberProgress;

  // Only update chart if analytics is currently active (no constant polling)
  if (document.getElementById('task-analytics')?.classList.contains('active')) {
    clearTimeout(chartUpdateTimeout);
    chartUpdateTimeout = setTimeout(() => {
      updateChart(lastMemberProgress);
    }, 100); // Reduced delay for immediate updates when active
  }

  // Only rebuild task list if we're not on analytics page (to avoid lag)
  if (!document.getElementById('task-analytics')?.classList.contains('active')) {
    let html = "";
    docs.forEach(docSnap => {
      const t = docSnap.data();
      html += `
        <div class="card" style="${t.status === 'pending validation' ? 'border: 2px solid #f59e0b; background: rgba(245, 158, 11, 0.1);' : ''}">
          <h3>${t.title}</h3>
          <p>Assigned To: ${t.assignedToName}</p>
          <p>Deadline: ${t.deadline}</p>
          ${t.description ? `<p><strong>Description:</strong> ${t.description}</p>` : ""}  
          ${t.linkURL ? `<a href="${t.linkURL}" target="_blank">🔗 Open Link</a>` : ""}
          <p>Status: <span style="${t.status === 'pending validation' ? 'color: #f59e0b; font-weight: bold;' : ''}">${t.status}</span></p>
          ${t.status === 'pending validation' ? '<p style="color: #f59e0b; font-weight: bold;">⚠️ Member has submitted this task for validation!</p>' : ''}
          <button onclick="markDone('${docSnap.id}')">Mark Done</button>
          ${(t.status === "pending" || t.status === "overdue" || t.status === "pending validation") ? `<button onclick="needAction('${docSnap.id}')" class="btn-warning" style="margin-top: 0.5rem;">Need an Action</button>` : ""}
          <button onclick="deleteTask('${docSnap.id}')" class="btn-danger" style="margin-top: 0.5rem;">Delete</button>
        </div>
      `;
    });
    container.innerHTML = html;
  }
});

// Update chart only when analytics is visible and data changed
function updateChartIfNeeded() {
  // This function is deprecated - chart updates are now handled directly in onSnapshot when analytics is active
  if (document.getElementById('task-analytics')?.classList.contains('active')) {
    updateChart(lastMemberProgress);
  }
}

let lastChartData = null;

/* GRAPH */
function updateChart(memberProgress) {
  const ctx = document.getElementById("taskChart");
  if (!ctx) {
    console.error('Chart canvas element not found');
    return;
  }

  if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded yet.');
    return;
  }

  const parent = ctx.parentElement;
  const placeholderClass = 'chart-placeholder';
  const existingPlaceholder = parent ? parent.querySelector(`.${placeholderClass}`) : null;

  // Handle empty data
  if (!memberProgress || Object.keys(memberProgress).length === 0) {
    if (chart) {
      chart.destroy();
      chart = null;
    }

    if (parent && !existingPlaceholder) {
      const msg = document.createElement('p');
      msg.className = placeholderClass;
      msg.textContent = 'No task data available. Create a task to see analytics.';
      msg.style.color = '#94a3b8';
      msg.style.textAlign = 'center';
      msg.style.padding = '2rem';
      parent.appendChild(msg);
    }
    return;
  }

  if (existingPlaceholder) {
    existingPlaceholder.remove();
  }

  const memberNames = Object.keys(memberProgress).filter(name => name && name !== "");
  
  if (memberNames.length === 0) {
    return;
  }

  const doneData = memberNames.map(member => memberProgress[member].done);
  const pendingData = memberNames.map(member => memberProgress[member].pending);
  const overdueData = memberNames.map(member => memberProgress[member].overdue);
  const needsActionData = memberNames.map(member => memberProgress[member].needsAction);
  const pendingValidationData = memberNames.map(member => memberProgress[member].pendingValidation);

  const currentData = {
    labels: memberNames,
    datasets: [doneData, pendingData, overdueData, needsActionData, pendingValidationData]
  };

  const dataChanged = !lastChartData ||
    JSON.stringify(lastChartData.labels) !== JSON.stringify(currentData.labels) ||
    JSON.stringify(lastChartData.datasets) !== JSON.stringify(currentData.datasets);

  if (!dataChanged) {
    return; // No need to update if data hasn't changed
  }

  lastChartData = currentData;

  // Update existing chart
  if (chart && chart.data && !chart.destroyed) {
    chart.data.labels = memberNames;
    chart.data.datasets[0].data = doneData;
    chart.data.datasets[1].data = pendingData;
    chart.data.datasets[2].data = overdueData;
    chart.data.datasets[3].data = needsActionData;
    chart.data.datasets[4].data = pendingValidationData;
    chart.update('none');
    return;
  }

  // Destroy any existing chart before creating new one
  if (chart && !chart.destroyed) {
    chart.destroy();
  }

  // Create new chart
  try {
    const datasets = [
      {
        label: 'Done',
        data: memberNames.map(member => memberProgress[member].done),
        backgroundColor: '#16a34a',
        borderColor: '#15803d',
        borderWidth: 1
      },
      {
        label: 'Pending',
        data: memberNames.map(member => memberProgress[member].pending),
        backgroundColor: '#2563eb',
        borderColor: '#1d4ed8',
        borderWidth: 1
      },
      {
        label: 'Overdue',
        data: memberNames.map(member => memberProgress[member].overdue),
        backgroundColor: '#dc2626',
        borderColor: '#b91c1c',
        borderWidth: 1
      },
      {
        label: 'Needs Action',
        data: memberNames.map(member => memberProgress[member].needsAction),
        backgroundColor: '#f59e0b',
        borderColor: '#d97706',
        borderWidth: 1
      },
      {
        label: 'Pending Validation',
        data: memberNames.map(member => memberProgress[member].pendingValidation),
        backgroundColor: '#8b5cf6',
        borderColor: '#7c3aed',
        borderWidth: 1
      }
    ];

    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: memberNames,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        animation: false,
        layout: {
          padding: {
            left: 8,
            right: 8,
            top: 8,
            bottom: 8
          }
        },
        elements: {
          bar: {
            borderRadius: 4,
            barThickness: 16,
            maxBarThickness: 18
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              color: '#cbd5e1',
              maxTicksLimit: 5
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.12)'
            }
          },
          y: {
            ticks: {
              color: '#cbd5e1',
              font: {
                size: 12
              },
              padding: 6
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#cbd5e1',
              boxWidth: 12,
              boxHeight: 12,
              padding: 12
            }
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.x;
              }
            }
          }
        }
      }
    });
    window.adminTaskChart = chart;
    window.updateChart = updateChart;
  } catch (err) {
    console.error('Chart initialization error:', err);
  }
}

// Expose updateChart and lastMemberProgress globally
window.updateChart = updateChart;
window.updateChartIfNeeded = function() {
  if (window.lastMemberProgress) {
    updateChart(window.lastMemberProgress);
  }
};

/* CREATE POLL */
window.createPoll = async function () {
  const question = document.getElementById("pollQuestion").value.trim();
  const optionInputs = document.querySelectorAll(".poll-option-input");
  const options = Array.from(optionInputs).map(input => input.value.trim()).filter(option => option !== "");

  if (!question || options.length < 2) {
    alert("Please enter a question and at least 2 options.");
    return;
  }

  try {
    const pollData = {
      question,
      options,
      votes: {},
      emailNotificationSent: false,
      createdAt: new Date()
    };

    await addDoc(collection(db, "polls"), pollData);

    // Send notification to all members
    const notificationTitle = "New Poll Created";
    const notificationBody = `A new poll has been created: "${question}"`;
    const allMemberEmails = members.map(m => m.uid).filter(email => email !== "everyone");
    await sendNotificationToUsers(allMemberEmails, notificationTitle, notificationBody, 'poll');
    showLocalNotification(notificationTitle, notificationBody);

    document.getElementById("pollQuestion").value = "";
    optionInputs.forEach(input => input.value = "");
    
    // Reset to 2 options
    const pollOptionsDiv = document.getElementById("pollOptions");
    pollOptionsDiv.innerHTML = `
      <div class="form-group">
        <label>Option 1</label>
        <input type="text" class="poll-option-input" placeholder="Enter option" required>
      </div>
      <div class="form-group">
        <label>Option 2</label>
        <input type="text" class="poll-option-input" placeholder="Enter option" required>
      </div>
    `;

    alert("Poll created successfully!");
  } catch (error) {
    console.error("Error creating poll:", error);
    alert(`Failed to create poll: ${error.message}`);
  }
};

/* ADD POLL OPTION */
window.addPollOption = function () {
  const pollOptionsDiv = document.getElementById("pollOptions");
  const optionCount = pollOptionsDiv.querySelectorAll(".poll-option-input").length + 1;
  
  const newOptionDiv = document.createElement("div");
  newOptionDiv.className = "form-group";
  newOptionDiv.innerHTML = `
    <label>Option ${optionCount}</label>
    <input type="text" class="poll-option-input" placeholder="Enter option" required>
  `;
  
  pollOptionsDiv.appendChild(newOptionDiv);
};

function getSafePollOptions(poll) {
  return Array.isArray(poll.options) ? poll.options : [];
}

function getPollCreatedDate(createdAt) {
  if (!createdAt) return "Unknown date";
  if (createdAt.toDate) return createdAt.toDate().toLocaleDateString();
  if (createdAt instanceof Date) return createdAt.toLocaleDateString();
  return String(createdAt);
}

function formatCommentDate(dateValue) {
  if (!dateValue) return "Unknown date";
  if (dateValue.toDate) return dateValue.toDate().toLocaleString();
  if (dateValue instanceof Date) return dateValue.toLocaleString();
  return new Date(dateValue).toLocaleString();
}

window.deleteAnnouncementComment = async function(announcementId, commentIndex) {
  try {
    const announcementRef = doc(db, "announcements", announcementId);
    const announcementSnap = await getDoc(announcementRef);
    if (!announcementSnap.exists()) return;

    const announcement = announcementSnap.data();
    const comments = Array.isArray(announcement.comments) ? [...announcement.comments] : [];
    if (commentIndex < 0 || commentIndex >= comments.length) return;

    comments.splice(commentIndex, 1);
    await updateDoc(announcementRef, { comments });
    alert("Comment deleted successfully.");
  } catch (error) {
    console.error("Error deleting comment:", error);
    alert("Failed to delete comment. Please try again.");
  }
};

window.toggleAnnouncementComments = async function(announcementId, currentState) {
  try {
    await updateDoc(doc(db, "announcements", announcementId), {
      commentsEnabled: !currentState
    });
    alert(`Comments have been ${currentState ? 'disabled' : 'enabled'} for this announcement.`);
  } catch (error) {
    console.error("Error toggling comment status:", error);
    alert("Failed to update comment status. Please try again.");
  }
};

window.addAnnouncementComment = async function(announcementId) {
  const input = document.getElementById(`adminCommentInput-${announcementId}`);
  if (!input) return;

  const commentText = input.value.trim();
  if (!commentText) {
    alert("Please enter a comment.");
    return;
  }

  try {
    await updateDoc(doc(db, "announcements", announcementId), {
      comments: arrayUnion({
        author: "Admin",
        email: adminEmail,
        content: commentText,
        createdAt: new Date()
      })
    });

    input.value = "";
    alert("Comment posted successfully!");
  } catch (error) {
    console.error("Error posting comment:", error);
    alert("Failed to post comment. Please try again.");
  }
};

/* CREATE ANNOUNCEMENT */
window.createAnnouncement = async function () {
  const title = document.getElementById("announcementTitle").value.trim();
  const content = document.getElementById("announcementContent").value.trim();
  const checkboxes = document.querySelectorAll(".announcement-assign-checkbox:checked");
  const assignedTo = Array.from(checkboxes).map(cb => cb.value);

  if (!title || !content) {
    alert("Please fill all fields.");
    return;
  }

  if (assignedTo.length === 0) {
    alert("Please select at least one recipient.");
    return;
  }

  try {
    const assignedToNames = assignedTo.map(uid => {
      const member = members.find(m => m.uid === uid);
      return member ? member.name : uid;
    });

    const announcementData = {
      title,
      content,
      assignedTo,
      assignedToNames,
      createdAt: new Date(),
      commentsEnabled: true,
      emailNotificationSent: false
    };

    await addDoc(collection(db, "announcements"), announcementData);

    // Send notifications to assigned users
    const notificationTitle = "New Announcement";
    const notificationBody = `New announcement: "${title}"`;
    await sendNotificationToUsers(assignedTo, notificationTitle, notificationBody, 'announcement');
    showLocalNotification(notificationTitle, notificationBody);

    document.getElementById("announcementTitle").value = "";
    document.getElementById("announcementContent").value = "";
    document.querySelectorAll(".announcement-assign-checkbox").forEach(cb => cb.checked = false);

    alert("Announcement created successfully!");
  } catch (error) {
    console.error("Error creating announcement:", error);
    alert(`Failed to create announcement: ${error.message}`);
  }
};

/* CREATE RESOURCE */
window.createResource = async function () {
  console.log('createResource called');
  const title = document.getElementById("resourceTitle").value.trim();
  const description = document.getElementById("resourceDescription").value.trim();
  const link = document.getElementById("resourceLink").value.trim();

  console.log('Resource data:', { title, description, link });

  if (!title || !description || !link) {
    alert("Please fill all fields.");
    return;
  }

  try {
    const resourceData = {
      title,
      description,
      link,
      createdAt: new Date()
    };

    console.log('Adding resource to Firestore...');
    await addDoc(collection(db, "resources"), resourceData);
    console.log('Resource added successfully');

    // Send notification to all members (non-blocking)
    try {
      const notificationTitle = "New Resource Added";
      const notificationBody = `New resource: "${title}"`;
      const allMemberEmails = members.map(m => m.uid).filter(email => email !== "everyone");
      console.log('Sending notification to members:', allMemberEmails);
      await sendNotificationToUsers(allMemberEmails, notificationTitle, notificationBody, 'resource');
      showLocalNotification(notificationTitle, notificationBody);
      console.log('Notification sent successfully');
    } catch (notificationError) {
      console.warn("Notification failed, but resource was created successfully:", notificationError);
    }

    document.getElementById("resourceTitle").value = "";
    document.getElementById("resourceDescription").value = "";
    document.getElementById("resourceLink").value = "";

    alert("Resource created successfully!");
  } catch (error) {
    console.error("Error creating resource:", error);
    alert(`Failed to create resource: ${error.message}`);
  }
};

/* DELETE POLL */
window.deletePoll = async function (id) {
  if (confirm("Are you sure you want to delete this poll? This action cannot be undone.")) {
    try {
      await deleteDoc(doc(db, "polls", id));
      alert("Poll deleted successfully!");
    } catch (error) {
      console.error("Error deleting poll:", error);
      alert("Failed to delete poll. Please try again.");
    }
  }
};

/* DELETE ANNOUNCEMENT */
window.deleteAnnouncement = async function (id) {
  if (confirm("Are you sure you want to delete this announcement? This action cannot be undone.")) {
    try {
      await deleteDoc(doc(db, "announcements", id));
      alert("Announcement deleted successfully!");
    } catch (error) {
      console.error("Error deleting announcement:", error);
      alert("Failed to delete announcement. Please try again.");
    }
  }
};

/* LOAD POLLS */
onSnapshot(collection(db, "polls"), (snap) => {
  const container = document.getElementById("pollsList");
  if (!container) return;
  container.innerHTML = "";

  if (snap.empty) {
    container.innerHTML = "<p style='color: #94a3b8; text-align: center;'>No polls created yet.</p>";
    return;
  }

  const docs = [];
  snap.forEach(docSnap => docs.push(docSnap));
  docs.sort((a, b) => {
    const timeA = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() : (a.data().createdAt || 0);
    const timeB = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() : (b.data().createdAt || 0);
    return timeB - timeA;
  });

  docs.forEach(docSnap => {
    const poll = docSnap.data() || {};
    const createdDate = getPollCreatedDate(poll.createdAt);
    const options = getSafePollOptions(poll);
    const votes = poll.votes || {};

    container.innerHTML += `
      <div class="card" style="margin-bottom: 1rem;">
        <h4 class="poll-question">${poll.question || "Untitled Poll"}</h4>
        <p class="poll-created-date">Created: ${createdDate}</p>
        <div style="margin: 0.5rem 0;">
          ${options.map((option, index) => `
            <div class="poll-option-row" style="display: flex; justify-content: space-between; padding: 0.25rem; background: #f8fafc; border-radius: 0.25rem; margin-bottom: 0.25rem;">
              <span class="poll-option-text" style="color: #334155;">${option}</span>
              <span class="poll-option-votes" style="color: #475569;">${Array.isArray(votes[index]) ? votes[index].length : 0} votes</span>
            </div>
          `).join('')}
        </div>
        <button onclick="deletePoll('${docSnap.id}')" class="btn-danger" style="margin-top: 0.5rem;">🗑️ Delete Poll</button>
      </div>
    `;
  });
});

/* LOAD ANNOUNCEMENTS */
onSnapshot(collection(db, "announcements"), (snap) => {
  const container = document.getElementById("announcementsList");
  container.innerHTML = "";

  if (snap.empty) {
    container.innerHTML = "<p style='color: #94a3b8; text-align: center;'>No announcements created yet.</p>";
    return;
  }

  const docs = [];
  snap.forEach(docSnap => docs.push(docSnap));
  docs.sort((a, b) => {
    const timeA = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() : (a.data().createdAt || 0);
    const timeB = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() : (b.data().createdAt || 0);
    return timeB - timeA;
  });

  docs.forEach(docSnap => {
    const announcement = docSnap.data();
    const createdDate = announcement.createdAt?.toDate?.() ? announcement.createdAt.toDate().toLocaleDateString() : "Unknown date";
    const commentsEnabled = announcement.commentsEnabled !== false;
    const comments = Array.isArray(announcement.comments) ? announcement.comments : [];
    const assignedToNames = Array.isArray(announcement.assignedToNames) ? announcement.assignedToNames : [];
    const assignedToText = assignedToNames.length > 0 ? `Assigned to: ${assignedToNames.join(", ")}` : "Assigned to: Everyone";
      const commentHtml = comments.length > 0 ? comments.map((comment, index) => `
          <div style="margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.375rem; background: #111827;">
            <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem; align-items: center;">
              <div>
                <span style="font-weight: 600; color: #f3f4f6;">${comment.author || comment.email || 'Member'}</span>
                <div style="font-size: 0.8rem; color: #9ca3af;">${formatCommentDate(comment.createdAt)}</div>
              </div>
              <button onclick="deleteAnnouncementComment('${docSnap.id}', ${index})" style="background: #ef4444 !important; color: white !important; border: none !important; padding: 0.15rem 0.35rem !important; border-radius: 0.25rem !important; cursor: pointer !important; font-size: 0.65rem !important; line-height: 1 !important; width: auto !important; min-width: 0 !important; margin-top: 0 !important; box-shadow: none !important;">Delete</button>
            </div>
            <p class="comment-content" style="margin: 0; color: #d1d5db; white-space: pre-wrap;">${comment.content}</p>
          </div>
        `).join('') : `<p style='color: #9ca3af; margin: 0;'>No comments yet.</p>`;

    container.innerHTML += `
      <div class="card" style="margin-bottom: 1rem;">
        <h4>${announcement.title}</h4>
        <p style="color: #94a3b8; font-size: 0.8rem;">Created: ${createdDate}</p>
        <p style="color: #60a5fa; font-size: 0.85rem; margin: 0.25rem 0;">${assignedToText}</p>
        <p style="margin: 0.5rem 0; line-height: 1.4;">${announcement.content}</p>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
          <button onclick="toggleAnnouncementComments('${docSnap.id}', ${commentsEnabled})" class="btn-secondary" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; min-width: auto;">${commentsEnabled ? 'Disable Comments' : 'Enable Comments'}</button>
          <span style="align-self: center; color: ${commentsEnabled ? '#10b981' : '#f59e0b'}; font-size: 0.85rem;">Comments ${commentsEnabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <div style="margin-top: 1rem; padding: 0.75rem; background: #111827; border-radius: 0.5rem; border: 1px solid #374151;">
          <h5 style="margin: 0 0 0.75rem 0; color: #f3f4f6;">Comments (${comments.length})</h5>
          ${commentHtml}
          <div style="margin-top: 1rem;">
            <textarea id="adminCommentInput-${docSnap.id}" rows="3" placeholder="Add a comment as Admin..." style="width: 100%; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid #4b5563; background: #0f172a; color: #f3f4f6; margin-bottom: 0.75rem;"></textarea>
            <button onclick="addAnnouncementComment('${docSnap.id}')" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer;">Post Comment as Admin</button>
          </div>
        </div>
        <button onclick="deleteAnnouncement('${docSnap.id}')" class="btn-danger" style="margin-top: 0.75rem;">🗑️ Delete Announcement</button>
      </div>
    `;
  });
});

loadProgressReport();

/* TICKET MANAGEMENT FUNCTIONS */
window.respondToTicket = async function(ticketId) {
  console.log('=== RESPOND TO TICKET CALLED ===');
  console.log('ticketId:', ticketId, 'type:', typeof ticketId);
  console.log('window.respondToTicket is defined:', typeof window.respondToTicket);
  const responseText = document.getElementById(`responseInput-${ticketId}`).value.trim();
  if (!responseText) {
    alert("Please enter a response.");
    return;
  }

  try {
    const ticketRef = doc(db, "tickets", ticketId);
    const ticketSnap = await getDoc(ticketRef);
    if (!ticketSnap.exists()) {
      alert("Ticket not found.");
      return;
    }

    const ticket = ticketSnap.data();
    const recipientEmail = ticket.assignedTo || ticket.submittedBy;
    const notificationTitle = "Admin Replied to Your Ticket";
    const notificationBody = `Your ticket \"${ticket.title}\" has a new response from Admin.`;

    await updateDoc(ticketRef, {
      responses: arrayUnion({
        author: "Admin",
        email: adminEmail,
        content: responseText,
        createdAt: new Date()
      }),
      memberEmailNotificationSent: false,
      memberNotificationReason: "admin_response",
      memberNotificationTitle: notificationTitle,
      memberNotificationMessage: responseText,
      memberNotificationAt: new Date()
    });

    if (recipientEmail) {
      await sendNotificationToUsers([recipientEmail], notificationTitle, notificationBody, 'ticket');
    }

    document.getElementById(`responseInput-${ticketId}`).value = "";
    alert("Response sent successfully and notification queued.");
  } catch (error) {
    console.error("Error responding to ticket:", error);
    alert("Failed to send response. Please try again.");
  }
};

window.changeTicketStatus = async function(ticketId, newStatus) {
  console.log('=== CHANGE TICKET STATUS CALLED ===');
  console.log('ticketId:', ticketId, 'newStatus:', newStatus);

  try {
    const ticketRef = doc(db, "tickets", ticketId);
    const ticketSnap = await getDoc(ticketRef);
    if (!ticketSnap.exists()) {
      alert("Ticket not found.");
      return;
    }

    const ticket = ticketSnap.data();
    const recipientEmail = ticket.assignedTo || ticket.submittedBy;
    const notificationTitle = "Ticket Status Updated";
    const notificationBody = `Your ticket \"${ticket.title}\" status has been changed to ${newStatus}.`;

    await updateDoc(ticketRef, {
      status: newStatus,
      memberEmailNotificationSent: false,
      memberNotificationReason: "status_changed",
      memberNotificationTitle: notificationTitle,
      memberNotificationMessage: notificationBody,
      memberNotificationAt: new Date()
    });

    if (recipientEmail) {
      await sendNotificationToUsers([recipientEmail], notificationTitle, notificationBody, 'ticket');
    }

    alert(`Ticket status changed to ${newStatus}! Notification queued.`);
  } catch (error) {
    console.error("Error changing ticket status:", error);
    alert("Failed to change ticket status. Please try again.");
  }
};

window.deleteTicket = async function(ticketId) {
  console.log('deleteTicket called with ticketId:', ticketId);
  if (confirm("Are you sure you want to delete this ticket? This action cannot be undone.")) {
    try {
      await deleteDoc(doc(db, "tickets", ticketId));
      alert("Ticket deleted successfully!");
    } catch (error) {
      console.error("Error deleting ticket:", error);
      alert("Failed to delete ticket. Please try again.");
    }
  }
};

/* DELETE RESOURCE */
/* DELETE RESOURCE */
window.deleteResource = async function (id) {
  console.log('deleteResource called with id:', id);
  if (confirm("Are you sure you want to delete this resource? This action cannot be undone.")) {
    try {
      await deleteDoc(doc(db, "resources", id));
      alert("Resource deleted successfully!");
    } catch (error) {
      console.error("Error deleting resource:", error);
      alert("Failed to delete resource. Please try again.");
    }
  }
};

console.log('=== ADMIN.JS FUNCTIONS LOADED ===');
console.log('window.respondToTicket:', typeof window.respondToTicket);
console.log('window.changeTicketStatus:', typeof window.changeTicketStatus);
console.log('window.deleteTicket:', typeof window.deleteTicket);
console.log('window.deleteResource:', typeof window.deleteResource);

})();
