const API_URL = 'http://localhost:3000/api/chat';
const history = [];
const chatBox = document.getElementById('chatBox');
const input = document.getElementById('userInput');
const form = document.getElementById('chatForm');

function appendMessage(text, sender) {
  const el = document.createElement('div');
  el.className = `message ${sender}`;
  el.textContent = text;
  chatBox.appendChild(el);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage(text) {
  text = (text || input.value).trim();
  if (!text) return;
  appendMessage(text, 'user');
  input.value = '';
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(-8) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error del servidor');
    appendMessage(data.reply || 'No se recibió respuesta.', 'assistant');
    history.push({ role: 'user', content: text }, { role: 'assistant', content: data.reply || '' });
  } catch (err) {
    appendMessage(`No se pudo conectar con el servidor: ${err.message}`, 'assistant');
  } finally {
    submit.disabled = false;
    input.focus();
  }
}

form.addEventListener('submit', e => {
  e.preventDefault();
  sendMessage();
});
document.querySelectorAll('[data-question]').forEach(button => {
  button.addEventListener('click', () => sendMessage(button.dataset.question));
});
