const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const messages = document.querySelector("#messages");
const promptPanel = document.querySelector("#promptPanel");
const promptText = document.querySelector("#promptText");
const promptToggle = document.querySelector("#promptToggle");
const copyPrompt = document.querySelector("#copyPrompt");
const canvas = document.querySelector("#artCanvas");
const ctx = canvas.getContext("2d");
const brushColor = document.querySelector("#brushColor");
const brushSize = document.querySelector("#brushSize");

let lastUserMessage = "(waiting for a message)";
let drawing = false;
let lastPoint = null;

function updatePrompt(message = lastUserMessage) {
  // This displays the prompt assembled for the latest message.
  promptText.textContent =
`You are PessiAI, a friendly AI assistant.
Style: friendly, silly, Comic Sans.
Tools: draw on the local canvas.
User: ${message}`;
}

function addMessage(who, text) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${who}`;
  const name = document.createElement("strong");
  name.textContent = who === "user" ? "You" : "PessiAI";
  const body = document.createElement("p");
  body.textContent = text;
  bubble.append(name, body);
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
}

async function sendMessage(message) {
  lastUserMessage = message;
  updatePrompt(message);
  addMessage("user", message);
  input.value = "";
  input.focus();

  const waiting = document.createElement("div");
  waiting.className = "bubble ai";
  waiting.textContent = "PessiAI is thinking very hard... 🤔";
  messages.appendChild(waiting);
  messages.scrollTop = messages.scrollHeight;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await response.json();
    waiting.remove();
    if (!response.ok) throw new Error(data.error || "Server error");
    addMessage("ai", data.reply);

    if (/\b(draw|paint|sketch|doodle)\b/i.test(message)) {
      drawSmiley();
      addMessage("ai", "Ta-da! I drew a smiley on the canvas. Art school here I come.");
    }
  } catch (error) {
    waiting.remove();
    addMessage("ai", `Oops! I couldn't reach the server: ${error.message}`);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (message) sendMessage(message);
});

promptToggle.addEventListener("click", () => {
  promptPanel.classList.toggle("hidden");
  promptToggle.textContent = promptPanel.classList.contains("hidden") ? "👀 Prompt viewer" : "🙈 Hide prompt";
});
copyPrompt.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(promptText.textContent);
    copyPrompt.textContent = "Copied!";
    setTimeout(() => copyPrompt.textContent = "Copy displayed prompt", 1200);
  } catch {
    copyPrompt.textContent = "Copy unavailable";
  }
});

// Drawing function: callable by the AI or by the Draw button.
function drawSmiley() {
  const w = canvas.width, h = canvas.height;
  const x = w / 2, y = h / 2;
  ctx.save();
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ffb62e";
  ctx.fillStyle = "#fff0a8";
  ctx.beginPath();
  ctx.arc(x, y, 82, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#322441";
  ctx.beginPath(); ctx.arc(x - 27, y - 17, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 27, y - 17, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#f05b87";
  ctx.beginPath(); ctx.arc(x, y - 1, 42, 0.18, Math.PI - 0.18); ctx.stroke();
  ctx.restore();
}
window.drawSmiley = drawSmiley;

document.querySelector("#drawButton").addEventListener("click", drawSmiley);
document.querySelector("#clearButton").addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}
canvas.addEventListener("pointerdown", (event) => {
  drawing = true;
  lastPoint = canvasPoint(event);
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!drawing || !lastPoint) return;
  const point = canvasPoint(event);
  ctx.strokeStyle = brushColor.value;
  ctx.lineWidth = Number(brushSize.value);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  lastPoint = point;
});
function stopDrawing() { drawing = false; lastPoint = null; }
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);

updatePrompt();
