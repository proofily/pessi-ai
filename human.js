const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const messages = document.querySelector("#messages");

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  addMessage("user", message);
  input.value = "";
  const waiting = document.createElement("div");
  waiting.className = "bubble ai";
  waiting.textContent = "PessiAI is thinking... 🤔";
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
  } catch (error) {
    waiting.remove();
    addMessage("ai", `Oops! I couldn't reach the server: ${error.message}`);
  }
});
