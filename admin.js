import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db } from "./firebase.js";

let members = [
  { uid: "everyone", name: "Everyone" },
  { uid: "kingfordnabor@gmail.com", name: "Kingford Nabor" },
  { uid: "allancorral@gmail.com", name: "Allan Corral" },
  { uid: "phricksborebor@gmail.com", name: "Phricks Borebor" },
  { uid: "moezarperez@gmail.com", name: "Moezar Perez" },
  { uid: "rogelioledda@gmail.com", name: "Rogelio Ledda" }
];

let chart;

function loadMembers() {
  const select = document.getElementById("assignedTo");
  select.innerHTML = "";

  members.forEach(m => {
    select.innerHTML += `<option value="${m.uid}">${m.name}</option>`;
  });
}

loadMembers();

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

/* REALTIME + GRAPH */
onSnapshot(collection(db, "tasks"), (snap) => {
  let done = 0, pending = 0, overdue = 0;

  const now = Date.now();
  const container = document.getElementById("tasks");
  container.innerHTML = "";

  snap.forEach(docSnap => {
    const t = docSnap.data();

    if (new Date(t.deadline).getTime() < now && (t.status === "pending" || t.status === "pending validation")) {
      t.status = "overdue";
    }

    if (t.status === "done") done++;
    else if (t.status === "overdue") overdue++;
    else pending++;

    container.innerHTML += `
      <div class="card">
        <h3>${t.title}</h3>
        <p>Assigned To: ${t.assignedToName}</p>
        <p>Deadline: ${t.deadline}</p>
        ${t.description ? `<p><strong>Description:</strong> ${t.description}</p>` : ""}
        ${t.linkURL ? `<a href="${t.linkURL}" target="_blank">🔗 Open Link</a>` : ""}
        <p>Status: ${t.status}</p>
        <button onclick="markDone('${docSnap.id}')">Mark Done</button>
        <button onclick="deleteTask('${docSnap.id}')" class="btn-danger" style="margin-top: 0.5rem;">Delete</button>
      </div>
    `;
  });

  updateChart(done, pending, overdue);
});

/* GRAPH */
function updateChart(done, pending, overdue) {
  const ctx = document.getElementById("taskChart");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Done", "Pending", "Overdue"],
      datasets: [{
        data: [done, pending, overdue]
      }]
    }
  });
}
