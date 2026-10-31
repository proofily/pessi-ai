
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (
  !OWNER_PASSWORD ||
  OWNER_PASSWORD === "change-this-to-a-long-private-password"
) {
  console.error("Set OWNER_PASSWORD in your .env file.");
  process.exit(1);
}

if (
  !SESSION_SECRET ||
  SESSION_SECRET.length < 32 ||
  SESSION_SECRET === "replace-this-with-a-long-random-secret"
) {
  console.error("Set a strong SESSION_SECRET in your .env file.");
  process.exit(1);
}

app.disable("x-powered-by");

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false }));

// -------------------- SESSION --------------------

app.use(session({
  name: "pessiai-owner",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,

  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: IS_PRODUCTION,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

// -------------------- RATE LIMITING --------------------

const rateLimits = new Map();

function rateLimit(max = 30, windowMs = 60000) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();

    let entry = rateLimits.get(key);

    if (!entry || now - entry.start >= windowMs) {
      entry = {
        start: now,
        count: 0
      };

      rateLimits.set(key, entry);
    }

    entry.count++;

    if (entry.count > max) {
      return res.status(429).json({
        error: "Too many requests. Please wait a moment."
      });
    }

    next();
  };
}

// Clean expired rate-limit entries.
setInterval(() => {
  const now = Date.now();

  for (const [key, entry] of rateLimits) {
    if (now - entry.start > 10 * 60000) {
      rateLimits.delete(key);
    }
  }
}, 60000).unref();

// -------------------- OWNER AUTHENTICATION --------------------

function requireOwner(req, res, next) {
  if (req.session?.isOwner === true) {
    return next();
  }

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({
      error: "Owner login required."
    });
  }

  res.redirect("/owner-login");
}

// -------------------- OWNER LOGIN --------------------

app.get("/owner-login", (req, res) => {
  if (req.session?.isOwner === true) {
    return res.redirect("/ai");
  }

  res.sendFile(
    path.join(__dirname, "public", "owner-login.html")
  );
});

app.post(
  "/api/login",
  rateLimit(5),
  (req, res) => {
    const password = String(req.body?.password || "");

    if (password.length > 500) {
      return res.status(400).json({
        error: "Invalid password."
      });
    }

    if (password !== OWNER_PASSWORD) {
      return res.status(401).json({
        error: "Wrong password. Try again."
      });
    }

    // Prevent session fixation.
    req.session.regenerate(err => {
      if (err) {
        return res.status(500).json({
          error: "Could not create a session."
        });
      }

      req.session.isOwner = true;

      req.session.save(err => {
        if (err) {
          return res.status(500).json({
            error: "Could not save the session."
          });
        }

        res.json({
          ok: true,
          redirect: "/ai"
        });
      });
    });
  }
);

// -------------------- LOGOUT --------------------

app.post("/api/logout", requireOwner, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({
        error: "Could not log out."
      });
    }

    res.clearCookie("pessiai-owner", {
      httpOnly: true,
      sameSite: "strict",
      secure: IS_PRODUCTION
    });

    res.json({ ok: true });
  });
});

// -------------------- PRIVATE OWNER PAGE --------------------

app.get("/ai", requireOwner, (req, res) => {
  res.sendFile(
    path.join(__dirname, "private", "ai.html")
  );
});

// Owner authentication status.
app.get(
  "/api/owner/status",
  requireOwner,
  (_req, res) => {
    res.json({ owner: true });
  }
);

// -------------------- PESSIAI RESPONSES --------------------

function fakeReply(message) {
  const lower = message.toLowerCase();

  if (/\b(hi|hello|hey|sup)\b/.test(lower)) {
    return "Hiiii! ✨ I am totally a very advanced AI. Please ignore the tiny cardboard brain.";
  }

  if (
    lower.includes("draw") ||
    lower.includes("paint") ||
    lower.includes("sketch")
  ) {
    return "I have activated my extremely imaginary art department. Use the drawing tools to doodle!";
  }

  if (
    lower.includes("your name") ||
    lower.includes("who are you")
  ) {
    return "I'm PessiAI, powered by 100% ready to help.";
  }

  if (lower.includes("joke")) {
    return "Why did the computer get cold? It left its Windows open. 🥁";
  }

  if (lower.includes("help")) {
    return "Try saying hello, asking for a joke, or telling me to draw something.";
  }

  const replies = [
    "Interesting! I have placed your message in my Very Important Thought Bucket.",
    "My neural network has consulted three imaginary ducks. They say: probably!",
    "Processing... beep boop... I think that sounds pretty cool.",
    "I understand approximately 37% of that, but I am responding with confidence anyway.",
    "A fascinating question. Unfortunately, my brain is currently organizing its thoughts."
  ];

  return replies[message.length % replies.length];
}

// -------------------- MESSAGE VALIDATION --------------------

function validateMessage(req, res) {
  const message = String(req.body?.message || "").trim();

  if (!message) {
    res.status(400).json({
      error: "Type something first!"
    });

    return null;
  }

  if (message.length > 1000) {
    res.status(400).json({
      error: "Messages must be 1000 characters or fewer."
    });

    return null;
  }

  return message;
}

// -------------------- PUBLIC GUEST CHAT --------------------

// Anyone can use PessiAI without creating an account.
app.post(
  "/api/chat",
  rateLimit(30),
  (req, res) => {
    const message = validateMessage(req, res);

    if (message === null) return;

    res.json({
      reply: fakeReply(message)
    });
  }
);

// -------------------- OWNER-ONLY CHAT --------------------

// Only authenticated owner sessions can access this endpoint.
app.post(
  "/api/owner/chat",
  requireOwner,
  (req, res) => {
    const message = validateMessage(req, res);

    if (message === null) return;

    res.json({
      reply: fakeReply(message),

      prompt:
        `You are PessiAI, a friendly AI assistant.\n` +
        `Style: friendly, silly, Comic Sans.\n` +
        `Tools: draw on the local canvas.\n` +
        `User: ${message}`
    });
  }
);

// -------------------- PUBLIC FILES --------------------

// Only the public folder is exposed.
app.use(express.static(
  path.join(__dirname, "public"),
  {
    index: false,
    dotfiles: "deny"
  }
));

// -------------------- 404 --------------------

app.use((req, res) => {
  res.status(404).send("Page not found.");
});

// -------------------- ERROR HANDLING --------------------

app.use((err, req, res, next) => {
  console.error("PessiAI error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "An internal server error occurred."
  });
});

// -------------------- START SERVER --------------------

app.listen(PORT, () => {
  console.log("--------------------------------");
  console.log("         PessiAI SERVER");
  console.log("--------------------------------");
  console.log(`Website:     http://localhost:${PORT}`);
  console.log(`Owner login: http://localhost:${PORT}/owner-login`);
  console.log("--------------------------------");
});
