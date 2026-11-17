(() => {
  const $ = id => document.getElementById(id);
  const screens = ["home","question-bank","quiz-editor","host-setup","join-setup","host-lobby","player-lobby","host-game","player-game","finished"];
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let ownerKey = localStorage.getItem("quizzy-library-key");
  if (!ownerKey) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    ownerKey = Array.from(bytes, b => b.toString(16).padStart(2,"0")).join("");
    localStorage.setItem("quizzy-library-key", ownerKey);
  }
  let editingId = null;
  let questions = [];

  function show(id) {
    screens.forEach(s => { const el=$(s); if (el) el.classList.toggle("hidden",s!==id); });
  }
  async function api(url, options={}) {
    const response = await fetch(url, { ...options, headers: { "Content-Type":"application/json", ...(options.headers||{}) } });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || "Có lỗi xảy ra.");
    return data;
  }
  async function loadLibrary() {
    $("saved-quizzes").innerHTML = '<p class="muted">Đang tải thư viện...</p>';
    try {
      const sets = await api("/api/question-sets/list", {method:"POST",body:JSON.stringify({ownerKey})});
      $("saved-quizzes").innerHTML = sets.length ? sets.map(set => `
        <article class="saved-quiz">
          <div><h3>${escapeHtml(set.title)}</h3><p>${set.questions.length} câu hỏi</p></div>
          <div class="saved-quiz-actions">
            <button class="mini-btn play-quiz" data-id="${set.id}">Chơi</button>
            <button class="mini-btn edit-quiz" data-id="${set.id}">Sửa</button>
            <button class="mini-btn delete-quiz" data-id="${set.id}">Xóa</button>
          </div>
        </article>`).join("") : '<p class="muted empty-library">Bạn chưa lưu bộ câu hỏi nào. Hãy tạo bộ đầu tiên nhé!</p>';
      $("bank-message").textContent = "";
    } catch (e) {
      $("saved-quizzes").innerHTML = '<p class="muted empty-library">Chưa kết nối được thư viện.</p>';
      $("bank-message").textContent = e.message;
    }
  }
  function drawQuestions() {
    $("question-editor-list").innerHTML = questions.map((q,i) => `
      <section class="question-card" data-index="${i}">
        <div class="question-card-head"><b>Câu ${i+1}</b><button type="button" class="remove-question" data-index="${i}">Xóa câu</button></div>
        <label>Nội dung câu hỏi</label>
        <textarea class="q-text" rows="2" placeholder="Nhập câu hỏi...">${escapeHtml(q.text)}</textarea>
        <div class="question-answer-fields">
          ${[0,1,2,3].map(n=>`<div><label>Đáp án ${"ABCD"[n]}</label><input class="q-answer" data-answer="${n}" value="${escapeHtml(q.answers[n] || "")}" placeholder="Nhập đáp án"></div>`).join("")}
        </div>
        <label>Đáp án đúng</label>
        <select class="q-correct">
          ${[0,1,2,3].map(n=>`<option value="${n}" ${q.correct===n?"selected":""}>${"ABCD"[n]}</option>`).join("")}
        </select>
        <label>Thời gian trả lời</label>
        <select class="q-seconds">${[10,15,20,30,45,60,90,120].map(n=>`<option value="${n}" ${(q.seconds||20)===n?"selected":""}>${n} giây</option>`).join("")}</select>
      </section>`).join("");
  }
  function readQuestions() {
    return [...$("question-editor-list").querySelectorAll(".question-card")].map(card => ({
      text:card.querySelector(".q-text").value.trim(),
      answers:[...card.querySelectorAll(".q-answer")].map(input=>input.value.trim()),
      correct:Number(card.querySelector(".q-correct").value),
      seconds:Number(card.querySelector(".q-seconds").value)
    }));
  }
  function newQuiz() {
    editingId=null; questions=[{text:"",answers:["","","",""],correct:0,seconds:20}];
    $("quiz-title").value=""; $("editor-heading").textContent="Tạo bộ câu hỏi mới";
    $("save-quiz").textContent="Lưu bộ câu hỏi"; $("editor-message").textContent="";
    drawQuestions(); show("quiz-editor");
  }
  function editQuiz(set) {
    editingId=set.id; questions=set.questions.map(q=>({...q,answers:[...q.answers]}));
    $("quiz-title").value=set.title; $("editor-heading").textContent="Chỉnh sửa bộ câu hỏi";
    $("save-quiz").textContent="Lưu thay đổi"; $("editor-message").textContent="";
    drawQuestions(); show("quiz-editor");
  }
  $("show-bank").addEventListener("click",()=>{show("question-bank");loadLibrary();});
  $("copy-library-key").addEventListener("click",async()=>{
    try { await navigator.clipboard.writeText(ownerKey); $("copy-library-key").textContent="Đã sao chép mã"; }
    catch { $("bank-message").textContent="Không thể sao chép tự động. Hãy thử lại trên trình duyệt."; }
  });
  $("use-library-key").addEventListener("click",async()=>{
    const candidate=$("import-library-key").value.trim();
    if(!/^[a-f0-9]{64}$/i.test(candidate)){ $("bank-message").textContent="Mã thư viện phải gồm 64 ký tự."; return; }
    ownerKey=candidate; localStorage.setItem("quizzy-library-key",ownerKey);
    $("import-library-key").value=""; await loadLibrary();
  });
  $("bank-home").addEventListener("click",()=>show("home"));
  $("new-quiz").addEventListener("click",newQuiz);
  $("editor-back").addEventListener("click",()=>{show("question-bank");loadLibrary();});
  $("add-question").addEventListener("click",()=>{questions=readQuestions();questions.push({text:"",answers:["","","",""],correct:0,seconds:20});drawQuestions();});
  $("question-editor-list").addEventListener("click",e=>{
    const btn=e.target.closest(".remove-question"); if(!btn)return;
    questions=readQuestions(); questions.splice(Number(btn.dataset.index),1);
    if(!questions.length) questions.push({text:"",answers:["","","",""],correct:0,seconds:20});
    drawQuestions();
  });
  $("save-quiz").addEventListener("click",async()=>{
    const title=$("quiz-title").value.trim(); const data=readQuestions();
    if(!title){$("editor-message").textContent="Hãy đặt tên cho bộ câu hỏi.";return;}
    if(data.some(q=>!q.text || q.answers.some(a=>!a))){$("editor-message").textContent="Hãy điền đầy đủ câu hỏi và cả 4 đáp án.";return;}
    $("save-quiz").disabled=true; $("editor-message").textContent="Đang lưu...";
    try {
      await api(editingId?"/api/question-sets/"+editingId:"/api/question-sets",{
        method:editingId?"PUT":"POST",body:JSON.stringify({title,questions:data,ownerKey})
      });
      show("question-bank"); await loadLibrary();
    } catch(e){$("editor-message").textContent=e.message;}
    finally{$("save-quiz").disabled=false;}
  });
  $("saved-quizzes").addEventListener("click",async e=>{
    const btn=e.target.closest("button[data-id]"); if(!btn)return;
    const id=btn.dataset.id;
    try {
      if(btn.classList.contains("play-quiz")){
        window.selectedQuizSetId=id;
        show("host-setup");
        $("create-room").click();
      } else if(btn.classList.contains("edit-quiz")){
        const sets=await api("/api/question-sets/list",{method:"POST",body:JSON.stringify({ownerKey})});
        const set=sets.find(x=>x.id===id); if(set)editQuiz(set);
      } else if(btn.classList.contains("delete-quiz")){
        if(!confirm("Bạn có chắc muốn xóa bộ câu hỏi này không?"))return;
        await api("/api/question-sets/"+id,{method:"DELETE",headers:{"X-Library-Key":ownerKey}});
        await loadLibrary();
      }
    } catch(err){$("bank-message").textContent=err.message;}
  });
})();