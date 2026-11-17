const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const QUESTIONS = [
  {
    text: "Thủ đô của Việt Nam là thành phố nào?",
    answers: ["TP. Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Huế"],
    correct: 1,
    seconds: 20
  },
  {
    text: "Một năm thường có bao nhiêu tháng?",
    answers: ["10 tháng", "11 tháng", "12 tháng", "13 tháng"],
    correct: 2,
    seconds: 15
  },
  {
    text: "Hành tinh nào được gọi là Hành tinh Đỏ?",
    answers: ["Sao Kim", "Sao Mộc", "Sao Hỏa", "Sao Thổ"],
    correct: 2,
    seconds: 20
  }
];

function makePin() {
  let pin;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(pin));
  return pin;
}

function publicPlayers(room) {
  return [...room.players.values()]
    .map(p => ({ id: p.id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

function sendLobby(pin, room) {
  io.to(pin).emit("players-update", publicPlayers(room));
}

function sendLeaderboard(pin, room) {
  io.to(pin).emit("leaderboard", publicPlayers(room));
}

io.on("connection", socket => {
  socket.on("host-create", () => {
    const pin = makePin();
    const room = {
      hostId: socket.id,
      players: new Map(),
      state: "lobby",
      questionIndex: -1,
      questionStartedAt: null,
      answers: new Map(),
      revealed: false
    };
    rooms.set(pin, room);
    socket.join(pin);
    socket.data.pin = pin;
    socket.data.role = "host";
    socket.emit("room-created", { pin });
  });

  socket.on("player-join", ({ pin, name }) => {
    pin = String(pin || "").trim();
    name = String(name || "").trim().slice(0, 18);

    const room = rooms.get(pin);
    if (!room) return socket.emit("join-error", "Không tìm thấy phòng. Hãy kiểm tra mã PIN nhé!");
    if (room.state !== "lobby") return socket.emit("join-error", "Phòng đã bắt đầu, bạn không thể tham gia lúc này.");
    if (!name) return socket.emit("join-error", "Bạn hãy nhập nickname trước nhé!");
    if (room.players.size >= 60) return socket.emit("join-error", "Phòng đã đủ 60 người chơi.");

    const duplicate = [...room.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase());
    if (duplicate) return socket.emit("join-error", "Nickname này đã có người sử dụng. Hãy chọn tên khác nhé!");

    room.players.set(socket.id, { id: socket.id, name, score: 0 });
    socket.join(pin);
    socket.data.pin = pin;
    socket.data.role = "player";
    socket.emit("joined-room", { pin, name });
    sendLobby(pin, room);
  });

  socket.on("host-start", () => {
    const pin = socket.data.pin;
    const room = rooms.get(pin);
    if (!room || room.hostId !== socket.id || room.state !== "lobby") return;
    if (room.players.size === 0) {
      socket.emit("host-error", "Cần ít nhất một người chơi để bắt đầu.");
      return;
    }
    room.state = "playing";
    room.questionIndex = 0;
    beginQuestion(pin, room);
  });

  function beginQuestion(pin, room) {
    const q = QUESTIONS[room.questionIndex];
    room.answers.clear();
    room.revealed = false;
    room.questionStartedAt = Date.now();

    io.to(pin).emit("new-question", {
      index: room.questionIndex,
      total: QUESTIONS.length,
      text: q.text,
      answers: q.answers,
      seconds: q.seconds
    });

    setTimeout(() => {
      const current = rooms.get(pin);
      if (current === room && room.state === "playing" && !room.revealed) {
        revealQuestion(pin, room);
      }
    }, q.seconds * 1000);
  }

  socket.on("submit-answer", ({ answer }) => {
    const pin = socket.data.pin;
    const room = rooms.get(pin);
    if (!room || socket.data.role !== "player" || room.state !== "playing" || room.revealed) return;
    if (!room.players.has(socket.id) || room.answers.has(socket.id)) return;

    const q = QUESTIONS[room.questionIndex];
    if (!Number.isInteger(answer) || answer < 0 || answer >= q.answers.length) return;

    const elapsed = Date.now() - room.questionStartedAt;
    const remaining = Math.max(0, q.seconds * 1000 - elapsed);
    const correct = answer === q.correct;
    const speedBonus = correct ? Math.round(500 * remaining / (q.seconds * 1000)) : 0;
    const points = correct ? 1000 + speedBonus : 0;

    room.answers.set(socket.id, { answer, correct, points });
    room.players.get(socket.id).score += points;

    socket.emit("answer-received", { correct, points });
    io.to(pin).emit("answer-count", {
      answered: room.answers.size,
      total: room.players.size
    });

    if (room.answers.size === room.players.size) revealQuestion(pin, room);
  });

  socket.on("host-reveal", () => {
    const pin = socket.data.pin;
    const room = rooms.get(pin);
    if (room && room.hostId === socket.id && room.state === "playing") {
      revealQuestion(pin, room);
    }
  });

  function revealQuestion(pin, room) {
    if (room.revealed) return;
    room.revealed = true;
    const q = QUESTIONS[room.questionIndex];
    io.to(pin).emit("question-result", {
      correct: q.correct,
      correctText: q.answers[q.correct],
      leaderboard: publicPlayers(room)
    });
  }

  socket.on("host-next", () => {
    const pin = socket.data.pin;
    const room = rooms.get(pin);
    if (!room || room.hostId !== socket.id || room.state !== "playing" || !room.revealed) return;

    room.questionIndex += 1;
    if (room.questionIndex >= QUESTIONS.length) {
      room.state = "finished";
      io.to(pin).emit("game-finished", { leaderboard: publicPlayers(room) });
      return;
    }
    beginQuestion(pin, room);
  });

  socket.on("disconnect", () => {
    const pin = socket.data.pin;
    const room = rooms.get(pin);
    if (!room) return;

    if (room.hostId === socket.id) {
      io.to(pin).emit("room-closed");
      rooms.delete(pin);
      return;
    }

    if (room.players.delete(socket.id)) sendLobby(pin, room);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Quizzy Party đang chạy tại http://localhost:${PORT}`);
});
