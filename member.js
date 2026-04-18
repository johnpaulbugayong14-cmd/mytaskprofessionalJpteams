import { collection, onSnapshot, doc, updateDoc, addDoc, getDoc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { getStoredUserEmail, signOutUser } from "./auth.js";
import { initializeNotifications } from "./notifications.js";

window.signOutUser = signOutUser;

let userEmail = null;
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

const progressReportCollection = "progressReports";
const progressReportDocId = "thesisProgress";

function getUserName(email) {
  const member = members.find(m => m.uid === email);
  return member ? member.name : email;
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

function getSafePollOptions(poll) {
  return Array.isArray(poll.options) ? poll.options : [];
}

function getSafePollVotes(poll) {
  const votes = poll.votes || {};
  return typeof votes === 'object' && votes !== null ? votes : {};
}

function renderMemberProgressReport(sections) {
  const container = document.getElementById("progressReport");
  const emptyState = document.getElementById("progressEmptyState");

  if (!container) return;
  if (!Array.isArray(sections) || sections.length === 0) {
    container.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  container.innerHTML = sections.map(section => `
    <div style="margin-bottom: 1.25rem;">
      <h3 style="margin: 0 0 0.75rem 0; color: #3b82f6;">${section.title}</h3>
      ${Array.isArray(section.items) ? section.items.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.75rem; background: #111827; border: 1px solid #374151; border-radius: 0.5rem; margin-bottom: 0.5rem;">
          <span style="color: #d1d5db;">${item.name}</span>
          <span style="color: ${item.status === 'Completed' ? '#22c55e' : item.status === 'Pending' ? '#f59e0b' : '#94a3b8'}; font-weight: 600;">${item.status || 'Not Started'}</span>
        </div>
      `).join('') : ''}
    </div>
  `).join('');
}

function loadProgressReport() {
  const progressRef = doc(db, progressReportCollection, progressReportDocId);
  onSnapshot(progressRef, (snap) => {
    const sections = snap.exists() && Array.isArray(snap.data()?.sections) ? snap.data().sections : getDefaultProgressStructure();
    renderMemberProgressReport(sections);
  });
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
  if (!userEmail) {
    alert("Please wait for the page to load completely.");
    return;
  }
  
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

    const docs = [];
    snap.forEach(doc => docs.push(doc));
    docs.sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis());

    docs.forEach(doc => {
      const poll = doc.data() || {};
      pollCount++;
      
      const votes = getSafePollVotes(poll);
      const options = getSafePollOptions(poll);
      const totalVotes = Object.values(votes).reduce((sum, voters) => sum + (Array.isArray(voters) ? voters.length : 0), 0);
      const userVoted = Object.values(votes).some(voters => Array.isArray(voters) && voters.includes(userEmail));
      
      let optionsHtml = "";
      options.forEach((option, index) => {
        const optionVotes = Array.isArray(votes[index]) ? votes[index].length : 0;
        const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
        const isUserVote = Array.isArray(votes[index]) && votes[index].includes(userEmail);
        
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
          <h4 style="margin: 0 0 0.5rem 0; color: #f3f4f6;">${poll.question || "Untitled Poll"}</h4>
          <p style="color: #9ca3af; margin: 0 0 1rem 0; font-size: 0.875rem;">Total votes: ${totalVotes}</p>
          ${optionsHtml}
        </div>
      `;
    });

    pollsEmptyState.style.display = pollCount === 0 ? "block" : "none";
  });
}

function formatAnnouncementDate(dateValue) {
  if (!dateValue) return "Unknown date";
  if (dateValue.toDate) return dateValue.toDate().toLocaleString();
  if (dateValue instanceof Date) return dateValue.toLocaleString();
  return new Date(dateValue).toLocaleString();
}

window.addAnnouncementComment = async function(announcementId) {
  if (!userEmail) {
    alert("Please wait for the page to load completely.");
    return;
  }
  
  const input = document.getElementById(`commentInput-${announcementId}`);
  if (!input) return;

  const commentText = input.value.trim();
  if (!commentText) {
    alert("Please enter a comment.");
    return;
  }

  try {
    await updateDoc(doc(db, "announcements", announcementId), {
      comments: arrayUnion({
        author: getUserName(userEmail),
        email: userEmail,
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

window.deleteAnnouncementComment = async function(announcementId, commentIndex) {
  try {
    const announcementRef = doc(db, "announcements", announcementId);
    const announcementSnap = await getDoc(announcementRef);
    if (!announcementSnap.exists()) return;

    const announcement = announcementSnap.data();
    const comments = Array.isArray(announcement.comments) ? [...announcement.comments] : [];
    if (commentIndex < 0 || commentIndex >= comments.length) return;

    const comment = comments[commentIndex];
    if (!comment || comment.email !== userEmail) {
      alert("You can only delete your own comments.");
      return;
    }

    comments.splice(commentIndex, 1);
    await updateDoc(announcementRef, { comments });
    alert("Comment deleted successfully.");
  } catch (error) {
    console.error("Error deleting comment:", error);
    alert("Failed to delete comment. Please try again.");
  }
};

function renderAnnouncementComments(announcementId, comments) {
  const safeComments = Array.isArray(comments) ? comments : [];
  if (safeComments.length === 0) {
    return `<p style="color: #9ca3af; margin: 0 0 0.75rem 0;">No comments yet. Be the first to respond.</p>`;
  }

  return safeComments.map((comment, index) => `
    <div style="margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #4b5563; border-radius: 0.375rem; background: #111827;">
      <div style="display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem; align-items: center;">
        <div>
          <span style="font-weight: 600; color: #f3f4f6;">${comment.author || comment.email || 'Member'}</span>
          <div style="font-size: 0.8rem; color: #9ca3af;">${formatAnnouncementDate(comment.createdAt)}</div>
        </div>
        ${comment.email === userEmail ? `<button onclick="deleteAnnouncementComment('${announcementId}', ${index})" style="background: #ef4444 !important; color: white !important; border: none !important; padding: 0.15rem 0.35rem !important; border-radius: 0.25rem !important; cursor: pointer !important; font-size: 0.65rem !important; line-height: 1 !important; width: auto !important; min-width: 0 !important; margin-top: 0 !important; box-shadow: none !important;">Delete</button>` : ''}
      </div>
      <p style="margin: 0; color: #d1d5db; white-space: pre-wrap;">${comment.content}</p>
    </div>
  `).join('');
}

function loadAnnouncements() {
  onSnapshot(collection(db, "announcements"), (snap) => {
    announcementsContainer.innerHTML = "";
    let announcementCount = 0;

    const docs = [];
    snap.forEach(doc => docs.push(doc));
    docs.sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis());

    docs.forEach(doc => {
      const announcement = doc.data();
      const assignedTo = Array.isArray(announcement.assignedTo) ? announcement.assignedTo : ["everyone"];
      if (!assignedTo.includes("everyone") && !assignedTo.includes(userEmail)) return;
      
      const announcementDate = formatAnnouncementDate(announcement.createdAt);
      const commentsEnabled = announcement.commentsEnabled !== false;
      const commentHtml = renderAnnouncementComments(doc.id, announcement.comments);
      const assignedToNames = Array.isArray(announcement.assignedToNames) ? announcement.assignedToNames : ["Everyone"];
      const assignedToText = assignedToNames.length > 1 ? `Assigned to: ${assignedToNames.join(", ")}` : `Assigned to: ${assignedToNames[0]}`;
      announcementCount++;
      
      announcementsContainer.innerHTML += `
        <div class="announcement-item" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #374151; border-radius: 0.5rem; background: #1f2937;">
          <h4 style="margin: 0 0 0.5rem 0; color: #f3f4f6;">${announcement.title}</h4>
          <p style="color: #9ca3af; margin: 0 0 0.5rem 0; font-size: 0.875rem;">Posted on ${announcementDate}</p>
          <p style="color: #60a5fa; margin: 0 0 0.5rem 0; font-size: 0.85rem;">${assignedToText}</p>
          <p style="color: #d1d5db; margin: 0 0 1rem 0; white-space: pre-wrap;">${announcement.content}</p>
          <div style="margin-top: 1rem;">
            <h5 style="margin: 0 0 0.75rem 0; color: #f3f4f6;">Comments</h5>
            ${commentHtml}
            ${commentsEnabled ? `
              <textarea id="commentInput-${doc.id}" rows="3" placeholder="Write a comment..." style="width: 100%; padding: 0.75rem; border-radius: 0.375rem; border: 1px solid #4b5563; background: #111827; color: #f3f4f6; margin-bottom: 0.75rem;"></textarea>
              <button onclick="addAnnouncementComment('${doc.id}')" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1rem; border-radius: 0.375rem; cursor: pointer;">Post Comment</button>
            ` : `<p style="color: #f59e0b; margin-top: 0.5rem;">Comments are disabled for this announcement.</p>`}
          </div>
        </div>
      `;
    });

    announcementsEmptyState.style.display = announcementCount === 0 ? "block" : "none";
  });
}

(async () => {
  userEmail = await getStoredUserEmail();

  if (!userEmail) {
    container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem;">Please log in to view your tasks.</p>';
    if (emptyState) emptyState.style.display = "none";
    if (welcomeEl) welcomeEl.style.display = "none";
  } else {
    if (welcomeEl) welcomeEl.textContent = `Welcome, ${getUserName(userEmail)}`;
    
    // Initialize notifications
    initializeNotifications();
    
    // Update date and time every second
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Load tasks
    onSnapshot(collection(db, "tasks"), (snap) => {
      container.innerHTML = "";
      let taskCount = 0;

      const docs = [];
      snap.forEach(doc => docs.push(doc));
      docs.sort((a, b) => b.data().createdAt - a.data().createdAt);

      docs.forEach(doc => {
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
            ${t.status === "pending" || t.status === "needs action" ? `<button onclick="markDone('${doc.id}')" class="btn-submit">Already Submitted</button>` : ""}
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
    loadProgressReport();
  }
})();
