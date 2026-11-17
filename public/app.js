const socket = io();
const $ = id => document.getElementById(id);
const screens = ["home","host-setup","join-setup","host-lobby","player-lobby","host-game","player-game","finished"];
let currentRole = null;
let timerInterval = null;
let currentSeconds = 0;

function showScreen(id) {
  screens.forEach(s => $(s).classList.toggle("hidden", s !== id));
}
function renderPlayers(players) {
  $("player-count").textContent = `${players.length} người`;
  $("lobby-players").innerHTML = players.length
    ? players.map(p => `<span class="chip">🌸 ${escapeHtml(p.name)}</span>`).join("")
    : '<p class="muted">Đang chờ người chơi...</p>';
  $("start-game").disabled = players.length === 0;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function renderAnswers(container, answers, disabled = true, onChoose = null) {
  container.innerHTML = "";
  answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.className = "answer";
    button.textContent = `${["A","B","C","D"][index]}. ${answer}`;
    button.disabled = disabled;
    if (onChoose) button.addEventListener("click", () => onChoose(index));
    container.appendChild(button);
  });
}
function renderLeaderboard(container, players) {
  container.classList.remove("hidden");
  container.innerHTML = `<h3>🏆 Bảng xếp hạng</h3>` + (players.length
    ? players.map((p,i) => `<div class="rank-row"><span class="rank">${["🥇","🥈","🥉"][i] || (i+1)}</span><span class="rank-name">${escapeHtml(p.name)}</span><span class="rank-score">${p.score} điểm</span></div>`).join("")
    : '<p class="muted">Chưa có người chơi.</p>');
}
function startTimer(seconds, target) {
  clearInterval(timerInterval);
  currentSeconds = seconds;
  $(target).textContent = currentSeconds;
  timerInterval = setInterval(() => {
    currentSeconds = Math.max(0, currentSeconds - 1);
    $(target).textContent = currentSeconds;
    if (currentSeconds <= 0) clearInterval(timerInterval);
  }, 1000);
}

$("show-host").onclick = () => showScreen("host-setup");
$("show-join").onclick = () => showScreen("join-setup");
document.querySelectorAll("[data-back]").forEach(b => b.onclick = () => showScreen("home"));

$("create-room").onclick = () => {
  currentRole = "host";
  $("create-room").disabled = true;
  socket.emit("host-create");
};
$("join-room").onclick = () => {
  $("join-error").textContent = "";
  socket.emit("player-join", { pin: $("pin-input").value, name: $("name-input").value });
};
$("pin-input").addEventListener("input", e => e.target.value = e.target.value.replace(/\D/g,"").slice(0,6));
$("copy-pin").onclick = async () => {
  try { await navigator.clipboard.writeText($("room-pin").textContent); $("copy-pin").textContent = "Đã sao chép!"; }
  catch { $("copy-pin").textContent = "Hãy sao chép mã"; }
};
$("start-game").onclick = () => socket.emit("host-start");
$("reveal-answer").onclick = () => socket.emit("host-reveal");
$("next-question").onclick = () => socket.emit("host-next");

socket.on("room-created", ({pin}) => {
  $("room-pin").textContent = pin;
  $("create-room").disabled = false;
  renderPlayers([]);
  showScreen("host-lobby");
});
socket.on("join-error", message => $("join-error").textContent = message);
socket.on("host-error", message => $("host-error").textContent = message);
socket.on("joined-room", ({pin,name}) => {
  $("player-name").textContent = name;
  $("player-pin").textContent = pin;
  showScreen("player-lobby");
});
socket.on("players-update", players => {
  if (currentRole === "host") renderPlayers(players);
});
socket.on("new-question", q => {
  clearInterval(timerInterval);
  if (currentRole === "host") {
    showScreen("host-game");
    $("host-progress").textContent = `Câu ${q.index+1}/${q.total}`;
    $("host-question").textContent = q.text;
    $("host-answer-count").textContent = "0 người đã trả lời";
    $("host-result").classList.add("hidden");
    $("host-leaderboard").classList.add("hidden");
    $("reveal-answer").classList.remove("hidden");
    $("next-question").classList.add("hidden");
    renderAnswers($("host-options"), q.answers, true);
    startTimer(q.seconds, "host-timer");
  } else {
    showScreen("player-game");
    $("player-progress").textContent = `Câu ${q.index+1}/${q.total}`;
    $("player-question").textContent = q.text;
    $("player-feedback").textContent = "Chọn đáp án đúng nhé!";
    $("player-result").classList.add("hidden");
    $("player-leaderboard").classList.add("hidden");
    renderAnswers($("player-options"), q.answers, false, index => {
      socket.emit("submit-answer", {answer:index});
      [...$("player-options").children].forEach(b => b.disabled = true);
      $("player-feedback").textContent = "Đã ghi nhận đáp án! Chờ kết quả nhé 💗";
    });
  }
});
socket.on("answer-count", data => {
  $("host-answer-count").textContent = `${data.answered}/${data.total} người đã trả lời`;
});
socket.on("answer-received", data => {
  $("player-feedback").textContent = data.correct
    ? `Chính xác! +${data.points} điểm 🌟`
    : "Đã nhận đáp án! Cùng chờ kết quả nhé 💗";
});
socket.on("question-result", data => {
  clearInterval(timerInterval);
  if (currentRole === "host") {
    $("host-result").textContent = `Đáp án đúng: ${data.correctText}`;
    $("host-result").classList.remove("hidden");
    $("reveal-answer").classList.add("hidden");
    $("next-question").classList.remove("hidden");
    renderLeaderboard($("host-leaderboard"), data.leaderboard);
  } else {
    $("player-result").textContent = `Đáp án đúng: ${data.correctText}`;
    $("player-result").classList.remove("hidden");
    renderLeaderboard($("player-leaderboard"), data.leaderboard);
  }
});
socket.on("game-finished", data => {
  clearInterval(timerInterval);
  renderLeaderboard($("final-leaderboard"), data.leaderboard);
  showScreen("finished");
});
socket.on("room-closed", () => {
  alert("Quản trò đã đóng phòng.");
  location.reload();
});
socket.on("connect_error", () => {
  alert("Không thể kết nối máy chủ. Hãy tải lại trang nhé.");
});
