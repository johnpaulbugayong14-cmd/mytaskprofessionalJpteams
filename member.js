import { collection, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { getStoredUserEmail } from "./auth.js";

const userEmail = getStoredUserEmail();
const container = document.getElementById("tasks");
const emptyState = document.getElementById("emptyState");
const welcomeEl = document.getElementById("welcome");

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

if (!userEmail) {
  container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem;">Please log in to view your tasks.</p>';
  if (emptyState) emptyState.style.display = "none";
  if (welcomeEl) welcomeEl.style.display = "none";
} else {
  if (welcomeEl) welcomeEl.textContent = `Welcome, ${getUserName(userEmail)}`;
  onSnapshot(collection(db, "tasks"), (snap) => {
    container.innerHTML = "";
    let taskCount = 0;

    snap.forEach(doc => {
      const t = doc.data();
      if (t.assignedTo !== "everyone" && t.assignedTo !== userEmail) return;

      taskCount++;
      const warning = getDeadlineWarning(t.deadline, t.status);
      container.innerHTML += `
        <div class="task-item ${warning.class}">
          <div class="task-header">
            <h3 class="task-title">${t.title}</h3>
            <span class="task-status ${t.status === "done" ? "status-completed" : t.status === "pending validation" ? "status-validation" : "status-pending"}">${t.status}</span>
            ${warning.message ? `<span class="task-warning">${warning.message}</span>` : ""}
          </div>
          ${t.description ? `<p style="color: #cbd5e1; margin: 0.75rem 0;">${t.description}</p>` : ""}
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
}
