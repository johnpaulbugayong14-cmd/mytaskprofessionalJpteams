import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db } from "./firebase.js";
import { signOutUser } from "./auth.js";

window.signOutUser = signOutUser;

let members = [
  { uid: "everyone", name: "Everyone" },
  { uid: "kingfordnabor@gmail.com", name: "Kingford Nabor" },
  { uid: "allancorral@gmail.com", name: "Allan Corral" },
  { uid: "phricksborebor@gmail.com", name: "Phricks Borebor" },
  { uid: "moezarperez@gmail.com", name: "Moezar Perez" },
  { uid: "rogelioledda@gmail.com", name: "Rogelio Ledda" }
];

let chart;

const progressReportCollection = "progressReports";
const progressReportDocId = "thesisProgress";
const progressStatuses = ["Not Started", "Pending", "Completed"];

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
        { name: "Background of the Study", status: "Not Started" },
        { name: "Statement of the Problem", status: "Not Started" },
        { name: "Objectives of the Study", status: "Not Started" },
        { name: "Scope and Delimitation", status: "Not Started" },
        { name: "Significance of the Study", status: "Not Started" },
        { name: "Definition of Terms", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 2 – Review of Related Literature (RRL)",
      items: [
        { name: "Related studies and literature", status: "Not Started" },
        { name: "Theoretical framework (if required)", status: "Not Started" },
        { name: "Conceptual framework", status: "Not Started" }
      ]
    },
    {
      title: "Chapter 3 – Methodology",
      items: [
        { name: "Research design", status: "Not Started" },
        { name: "Materials / instruments", status: "Not Started" },
        { name: "Procedure / implementation", status: "Not Started" },
        { name: "Data gathering method", status: "Not Started" },
        { name: "Statistical treatment (if applicable)", status: "Not Started" }
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
  const container = document.getElementById("progressReportPanel");
  if (!container) return;

  if (!Array.isArray(sections) || sections.length === 0) {
    container.innerHTML = '<p style="color: #94a3b8; text-align: center;">No progress report data yet.</p>';
    return;
  }

  container.innerHTML = sections.map((section, sectionIndex) => `
    <div style="margin-bottom: 1.25rem;">
      <h3 style="margin: 0 0 0.75rem 0; color: #0ea5e9;">${section.title}</h3>
      ${Array.isArray(section.items) ? section.items.map((item, itemIndex) => `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.65rem; padding: 0.75rem; background: #111827; border: 1px solid #374151; border-radius: 0.5rem;">
          <span style="color: #d1d5db;">${item.name}</span>
          <select id="progress-${sectionIndex}-${itemIndex}" style="background: #0f172a; color: #f8fafc; border: 1px solid #4b5563; border-radius: 0.375rem; padding: 0.45rem 0.6rem;">
            ${progressStatuses.map(statusOption => `
              <option value="${statusOption}" ${statusOption === (item.status || "Not Started") ? "selected" : ""}>${statusOption}</option>
            `).join('')}
          </select>
        </div>
      `).join('') : ''}
    </div>
  `).join('');
}

function getProgressFormValues() {
  const defaultSections = getDefaultProgressStructure();
  return defaultSections.map((section, sectionIndex) => ({
    title: section.title,
    items: section.items.map((item, itemIndex) => {
      const select = document.getElementById(`progress-${sectionIndex}-${itemIndex}`);
      return {
        name: item.name,
        status: select ? select.value : item.status
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

function loadProgressReport() {
  const progressRef = doc(db, progressReportCollection, progressReportDocId);
  onSnapshot(progressRef, (snap) => {
    let sections = getDefaultProgressStructure();
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.sections)) {
        sections = data.sections;
      } else {
        setDoc(progressRef, { sections }, { merge: true });
      }
    } else {
      setDoc(progressRef, { sections }, { merge: true });
    }
    renderAdminProgressReport(sections);
  });
}

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
      createdAt: Date.now()
    };

    await addDoc(collection(db, "tasks"), taskData);

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
    await updateDoc(doc(db, "tasks", id), {
      status: "done"
    });
  } catch (error) {
    console.error("Error marking done:", error);
    alert("Failed to mark task done. Please try again.");
  }
};

/* NEED ACTION */
window.needAction = async function (id) {
  if (confirm("Are you sure you want to mark this task as needing action? This will notify the assigned member(s).")) {
    try {
      await updateDoc(doc(db, "tasks", id), {
        status: "needs action"
      });
      alert("Task has been marked as needing action. The member(s) will see the notification in their task list.");
    } catch (error) {
      console.error("Error marking task as needing action:", error);
      alert("Failed to mark task as needing action. Please try again.");
    }
  }
};

/* REALTIME + GRAPH */
onSnapshot(collection(db, "tasks"), (snap) => {
  let done = 0, pending = 0, overdue = 0, needsAction = 0, pendingValidation = 0;

  const now = Date.now();
  const container = document.getElementById("tasks");
  container.innerHTML = "";

  const docs = [];
  snap.forEach(docSnap => docs.push(docSnap));
  docs.sort((a, b) => b.data().createdAt - a.data().createdAt);

  docs.forEach(docSnap => {
    const t = docSnap.data();

    if (new Date(t.deadline).getTime() < now && (t.status === "pending" || t.status === "pending validation")) {
      t.status = "overdue";
    }

    if (t.status === "done") done++;
    else if (t.status === "overdue") overdue++;
    else if (t.status === "needs action") needsAction++;
    else if (t.status === "pending validation") pendingValidation++;
    else pending++;

    container.innerHTML += `
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

  updateChart(done, pending, overdue, needsAction, pendingValidation);
});

/* GRAPH */
function updateChart(done, pending, overdue, needsAction, pendingValidation) {
  const ctx = document.getElementById("taskChart");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Done", "Pending", "Overdue", "Needs Action", "Pending Validation"],
      datasets: [{
        data: [done, pending, overdue, needsAction, pendingValidation]
      }]
    }
  });
}

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
      createdAt: new Date()
    };

    await addDoc(collection(db, "polls"), pollData);

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
      commentsEnabled: true
    };

    await addDoc(collection(db, "announcements"), announcementData);

    document.getElementById("announcementTitle").value = "";
    document.getElementById("announcementContent").value = "";
    document.querySelectorAll(".announcement-assign-checkbox").forEach(cb => cb.checked = false);

    alert("Announcement created successfully!");
  } catch (error) {
    console.error("Error creating announcement:", error);
    alert(`Failed to create announcement: ${error.message}`);
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
  container.innerHTML = "";

  if (snap.empty) {
    container.innerHTML = "<p style='color: #94a3b8; text-align: center;'>No polls created yet.</p>";
    return;
  }

  const docs = [];
  snap.forEach(docSnap => docs.push(docSnap));
  docs.sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis());

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
              <span class="poll-option-text">${option}</span>
              <span class="poll-option-votes">${Array.isArray(votes[index]) ? votes[index].length : 0} votes</span>
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
  docs.sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis());

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
            <p style="margin: 0; color: #d1d5db; white-space: pre-wrap;">${comment.content}</p>
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
        </div>
        <button onclick="deleteAnnouncement('${docSnap.id}')" class="btn-danger" style="margin-top: 0.75rem;">🗑️ Delete Announcement</button>
      </div>
    `;
  });
});

loadProgressReport();
