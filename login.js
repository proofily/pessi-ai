const form = document.querySelector("#loginForm");
const password = document.querySelector("#password");
const error = document.querySelector("#error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Login failed.");
    window.location.assign(data.redirect || "/ai");
  } catch (err) {
    error.textContent = err.message;
    password.select();
  }
});
