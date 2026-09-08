let currentUser = null;
let selectedImageBase64 = null;

async function login() {
  const username = document.getElementById('username-input').value.trim();
  if (!username) return alert('Enter a username');

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });

  const data = await res.json();
  currentUser = data.username;
  document.getElementById('credit-tag').innerText = `Credits: ${data.credits}/100`;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
}

function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    selectedImageBase64 = event.target.result;
    document.getElementById('image-preview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  selectedImageBase64 = null;
  document.getElementById('image-upload').value = '';
  document.getElementById('image-preview').classList.add('hidden');
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message && !selectedImageBase64) return;

  const chatBox = document.getElementById('chat-box');
  const selectedModel = document.getElementById('model-select').value;

  if (message) {
    chatBox.innerHTML += `<div class="msg user-msg">${message}</div>`;
  }

  input.value = '';

  const statusId = 'status-' + Date.now();
  
  if (selectedImageBase64) {
    chatBox.innerHTML += `<div id="${statusId}" class="msg bot-msg thinking-anim">Sending Image...</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
    await new Promise(r => setTimeout(r, 1200));
  }

  const statusElem = document.getElementById(statusId) || document.createElement('div');
  if (!statusElem.id) {
    statusElem.id = statusId;
    statusElem.className = 'msg bot-msg';
    chatBox.appendChild(statusElem);
  }
  
  statusElem.className = 'msg bot-msg thinking-anim';
  statusElem.innerText = 'Thinking...';
  chatBox.scrollTop = chatBox.scrollHeight;

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: currentUser,
      message,
      image: selectedImageBase64,
      model: selectedModel
    })
  });

  clearImage();
  const data = await res.json();

  if (data.error) {
    statusElem.className = 'msg bot-msg';
    statusElem.innerText = `Error: ${data.error}`;
    return;
  }

  document.getElementById('credit-tag').innerText = `Credits: ${data.remainingCredits}/100`;

  const thinkingId = 'think-' + Date.now();
  statusElem.classList.remove('thinking-anim');
  statusElem.innerHTML = `
    <div class="thinking-box" onclick="toggleThinking('${thinkingId}')">
      💭 Thought Process (Click to toggle)
      <div id="${thinkingId}" class="hidden" style="margin-top: 5px; white-space: pre-wrap;">${data.thinking}</div>
    </div>
    <div>${data.reply}</div>
  `;
  
  chatBox.scrollTop = chatBox.scrollHeight;
}

function toggleThinking(id) {
  const elem = document.getElementById(id);
  elem.classList.toggle('hidden');
}
