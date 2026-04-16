import { collection, onSnapshot, doc, updateDoc, addDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { getStoredUserEmail, signOutUser } from "./auth.js";

window.signOutUser = signOutUser;

const userEmail = getStoredUserEmail();
const container = document.getElementById("tasks");
const emptyState = document.getElementById("emptyState");
const welcomeEl = document.getElementById("welcome");
const datetimeEl = document.getElementById("datetime");
const pollsContainer = document.getElementById("polls");
const pollsEmptyState = document.getElementById("pollsEmptyState");
const announcementsContainer = document.getElementById("announcements");
const announcementsEmptyState = document.getElementById("announcementsEmptyState");

const members = [
  { uid: "everyone", name: "Everyone" },
  { uid: "kingfordnabor@gmail.com", name: "Kingford Nabor" },
  { uid: "allancorral@gmail.com", name: "Allan Corral" },
  { uid: "phricksborebor@gmail.com", name: "Phricks Borebor" },
  { uid: "moezarperez@gmail.com", name: "Moezar Perez" },
  { uid: "rogelioledda@gmail.com", name: "Rogelio Ledda" }
];

function getUserName(email) {
  const member = members.find(m => m.uid === email);
  return member ? member.name : email;
}

function getDeadlineWarning(deadlineStr, status) {
  if (status === "done" || status === "pending validation") return { class: "", message: "" };
  
  const deadline = new Date(deadlineStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  
  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { class: "warning-overdue", message: "⚠️ Overdue!" };
  } else if (diffDays <= 3) {
    return { class: "warning-near", message: "⚠️ Due soon!" };
  }
  return { class: "", message: "" };
}

window.markDone = async function (id) {
  try {
    await updateDoc(doc(db, "tasks", id), {
      status: "pending validation"
    });
    alert("Task marked as submitted for validation!");
  } catch (error) {
    console.error("Error marking submitted:", error);
    alert("Failed to mark task as submitted. Please try again.");
  }
};

function updateDateTime() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  datetimeEl.textContent = now.toLocaleDateString('en-US', options);
}

window.votePoll = async function(pollId, optionIndex) {
  try {
    const pollRef = doc(db, "polls", pollId);
    const pollDoc = await getDoc(pollRef);
    
    if (pollDoc.exists()) {
      const pollData = pollDoc.data();
      const votes = pollData.votes || {};
      
      // Remove previous vote if exists
      for (const [key, voters] of Object.entries(votes)) {
        if (voters.includes(userEmail)) {
          votes[key] = voters.filter(email => email !== userEmail);
        }
      }
      
      // Add new vote
      if (!votes[optionIndex]) {
        votes[optionIndex] = [];
      }
      votes[optionIndex].push(userEmail);
      
      await updateDoc(pollRef, { votes });
      alert("Vote submitted successfully!");
    }
  } catch (error) {
    console.error("Error voting:", error);
    alert("Failed to submit vote. Please try again.");
  }
};

function loadPolls() {
  onSnapshot(collection(db, "polls"), (snap) => {
    pollsContainer.innerHTML = "";
    let pollCount = 0;

    snap.forEach(doc => {
      const poll = doc.data();
      pollCount++;
      
      const votes = poll.votes || {};
      const totalVotes = Object.values(votes).reduce((sum, voters) => sum + voters.length, 0);
      const userVoted = Object.values(votes).some(voters => voters.includes(userEmail));
      
      let optionsHtml = "";
      poll.options.forEach((option, index) => {
        const optionVotes = votes[index] ? votes[index].length : 0;
        const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
        const isUserVote = votes[index] && votes[index].includes(userEmail);
        
        optionsHtml += `
          <div class="poll-option ${isUserVote ? 'user-vote' : ''}" style="margin: 0.5rem 0; padding: 0.5rem; border: 1px solid #374151; border-radius: 0.375rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>${option}</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span>${optionVotes} votes (${percentage}%)</span>
                ${!userVoted ? `<button onclick="votePoll('${doc.id}', ${index})" style="background: #3b82f6; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 0.25rem; cursor: pointer;">Vote</button>` : ''}
              </div>
            </div>
            <div style="width: 100%; height: 8px; background: #374151; border-radius: 4px; margin-top: 0.25rem;">
              <div style="width: ${percentage}%; height: 100%; background: ${isUserVote ? '#10b981' : '#3b82f6'}; border-radius: 4px;"></div>
            </div>
          </div>
        `;
      });
      
      pollsContainer.innerHTML += `
        <div class="poll-item" style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #374151; border-radius: 0.5rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: #f3f4f6;">${poll.question}</h4>
          <p style="color: #9ca3af; margin: 0 0 1rem 0; font-size: 0.875rem;">Total votes: ${totalVotes}</p>
          ${optionsHtml}
        </div>
      `;
    });

    pollsEmptyState.style.display = pollCount === 0 ? "block" : "none";
  });
}

function loadAnnouncements() {
  onSnapshot(collection(db, "announcements"), (snap) => {
    announcementsContainer.innerHTML = "";
    let announcementCount = 0;

    snap.forEach(doc => {
      const announcement = doc.data();
      announcementCount++;
      
      announcementsContainer.innerHTML += `
        <div class="announcement-item" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #374151; border-radius: 0.5rem; background: #1f2937;">
          <h4 style="margin: 0 0 0.5rem 0; color: #f3f4f6;">${announcement.title}</h4>
          <p style="color: #9ca3af; margin: 0 0 0.5rem 0; font-size: 0.875rem;">Posted on ${new Date(announcement.createdAt.toDate()).toLocaleDateString()}</p>
          <p style="color: #d1d5db; margin: 0; white-space: pre-wrap;">${announcement.content}</p>
        </div>
      `;
    });

    announcementsEmptyState.style.display = announcementCount === 0 ? "block" : "none";
  });
}

if (!userEmail) {
  container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem;">Please log in to view your tasks.</p>';
  if (emptyState) emptyState.style.display = "none";
  if (welcomeEl) welcomeEl.style.display = "none";
} else {
  if (welcomeEl) welcomeEl.textContent = `Welcome, ${getUserName(userEmail)}`;
  
  // Update date and time every second
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Load tasks
  onSnapshot(collection(db, "tasks"), (snap) => {
    container.innerHTML = "";
    let taskCount = 0;

    snap.forEach(doc => {
      const t = doc.data();
      if (t.assignedTo !== "everyone" && t.assignedTo !== userEmail) return;

      taskCount++;
      const warning = getDeadlineWarning(t.deadline, t.status);
      container.innerHTML += `
        <div class="task-item ${warning.class} ${t.status === "needs action" ? "task-needs-action" : ""}">
          <div class="task-header">
            <h3 class="task-title">${t.title}</h3>
            <span class="task-status ${t.status === "done" ? "status-completed" : t.status === "pending validation" ? "status-validation" : t.status === "needs action" ? "status-needs-action" : "status-pending"}">${t.status === "needs action" ? "Needs Action" : t.status}</span>
            ${warning.message ? `<span class="task-warning">${warning.message}</span>` : ""}
          </div>
          ${t.description ? `<p style="color: #cbd5e1; margin: 0.75rem 0;">${t.description}</p>` : ""}
          ${t.status === "needs action" ? `<p style="color: #f59e0b; margin: 0.5rem 0; font-weight: bold;">⚠️ This task needs your immediate action from the admin.</p>` : ""}
          <div class="task-meta">
            <span>📅 ${t.deadline}</span>
          </div>
          ${t.linkURL ? `<a href="${t.linkURL}" target="_blank" style="display: inline-block; margin-top: 0.5rem;">🔗 Open Link</a>` : ""}
          ${t.status === "pending" ? `<button onclick="markDone('${doc.id}')" class="btn-submit">Already Submitted</button>` : ""}
        </div>
      `;
    });

    if (emptyState) {
      emptyState.style.display = taskCount === 0 ? "block" : "none";
    }

    if (taskCount === 0 && !emptyState) {
      container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem;">No tasks assigned yet. Check back soon!</p>';
    }
  });
  
  // Load polls and announcements
  loadPolls();
  loadAnnouncements();
}
