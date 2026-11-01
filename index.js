
const express = require("express");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");

const app = express();
app.use(express.json({ limit: "1mb" }));

// ===============================
// CONFIGURATION
// ===============================

const TOKEN = (process.env.BOT_TOKEN || "").trim();
const ADMIN_ID = "8516075351";

const BASE_URL =
  "https://doctor-pharma-bot-iyki.onrender.com";

const BOUTIQUE_URL = (
  process.env.BOUTIQUE_URL ||
  "https://layer-aligner.lovable.app"
).trim();

const ADMIN_URL = (
  process.env.ADMIN_URL ||
  `${BOUTIQUE_URL.replace(/\/$/, "")}/admin`
).trim();

const SUPABASE_URL = (
  process.env.SUPABASE_URL || ""
).trim().replace(/\/$/, "");

const SUPABASE_KEY = (
  process.env.SUPABASE_SECRET_KEY || ""
).trim();

const PHOTO_NAME =
  "3168703F-5AD2-4B96-A901-3E86B0355FF8.png";

const PHOTO_PATH = path.join(__dirname, PHOTO_NAME);

if (!TOKEN) {
  throw new Error("BOT_TOKEN manquant dans Render");
}

const WEBHOOK_SECRET = crypto
  .createHmac("sha256", TOKEN)
  .update("doctor-pharma-webhook-v2")
  .digest("hex");

// ===============================
// TELEGRAM API
// ===============================

async function telegram(method, data = {}) {
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      `${method}: ${result.description || "Erreur Telegram"}`
    );
  }

  return result.result;
}

// ===============================
// CLAVIER GRIS ACCUEIL
// ===============================

const CLAVIER_ACCUEIL = {
  keyboard: [
    [{ text: "🏠 Accueil" }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

// ===============================
// MESSAGE DE BIENVENUE
// ===============================

const BIENVENUE = `
<b>Bienvenue chez Doctor Pharma 33 👋🇫🇷</b>

⭐️ <b>DOCTOR PHARMA 33</b> ⭐️
🏥 Saison 2026-2027

🔥 Les références du Doctor sont enfin disponibles sur Telegram !

🛍️ Clique sur le bouton Boutique pour découvrir notre catalogue.

🏠 Utilise le bouton Accueil pour revenir au menu.
`.trim();

// ===============================
// BOUTONS DU MESSAGE
// ===============================

const BOUTONS = {
  inline_keyboard: [
    [
      {
        text: "🛍️ OUVRIR LA BOUTIQUE",
        web_app: { url: BOUTIQUE_URL }
      }
    ],
    [
      {
        text: "📢 NEW CANAL",
        url: "https://t.me/+m304JfK-cfRiNmE0"
      }
    ],
    [
      {
        text: "💬 CONTACT",
        url: "https://t.me/Doctor_commande33k"
      }
    ]
  ]
};

// ===============================
// ENREGISTREMENT SUPABASE
// ===============================

async function enregistrerUtilisateur(user) {
  if (!user || !SUPABASE_URL || !SUPABASE_KEY) {
    return;
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/bot_users?on_conflict=telegram_id`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        telegram_id: String(user.id),
        first_name: user.first_name || "",
        username: user.username || null,
        last_seen: new Date().toISOString()
      })
    }
  );

  if (!response.ok) {
    console.error(
      "Supabase:",
      response.status,
      await response.text()
    );
  }
}

// ===============================
// ENVOI MESSAGE
// ===============================

async function envoyerMessage(chatId, text, markup) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: markup
  });
}

// ===============================
// AFFICHER ACCUEIL
// ===============================

async function afficherAccueil(chatId, user) {
  await enregistrerUtilisateur(user);

  // Réaffiche le clavier gris permanent.
  await envoyerMessage(
    chatId,
    "🏠 Accueil",
    CLAVIER_ACCUEIL
  );

  // Envoie la photo si elle existe.
  if (fs.existsSync(PHOTO_PATH)) {
    const photo = fs.readFileSync(PHOTO_PATH);

    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", BIENVENUE);
    form.append("parse_mode", "HTML");
    form.append(
      "reply_markup",
      JSON.stringify(BOUTONS)
    );
    form.append(
      "photo",
      new Blob([photo]),
      PHOTO_NAME
    );

    const response = await fetch(
      `https://api.telegram.org/bot${TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: form
      }
    );

    const result = await response.json();

    if (result.ok) return;

    console.error("Photo:", result.description);
  }

  // Solution de secours sans photo.
  await envoyerMessage(
    chatId,
    BIENVENUE,
    BOUTONS
  );
}

// ===============================
// COMMANDE ADMIN
// ===============================

async function afficherAdmin(chatId, userId) {
  if (String(userId) !== ADMIN_ID) {
    await envoyerMessage(
      chatId,
      "⛔ Accès réservé à l'administrateur."
    );
    return;
  }

  await envoyerMessage(
    chatId,
    "🔐 <b>ADMINISTRATION DOCTOR PHARMA 33</b>\n\n" +
    "Bienvenue dans ton espace administrateur.\n\n" +
    "Clique ci-dessous pour ouvrir ton tableau de bord.",
    {
      inline_keyboard: [
        [
          {
            text: "🔐 OUVRIR L'ADMINISTRATION",
            web_app: {
              url: ADMIN_URL
            }
          }
        ]
      ]
    }
  );
}

// ===============================
// AUTHENTIFICATION MINI APP
// ===============================

function verifierInitData(initData) {
  if (typeof initData !== "string" || !initData) {
    return null;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));

  if (!hash || !authDate) return null;

  // Rejette les authentifications expirées.
  const age = Math.floor(Date.now() / 1000) - authDate;

  if (age < 0 || age > 3600) return null;

  const entries = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b));

  const dataCheckString = entries
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(TOKEN)
    .digest();

  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const received = Buffer.from(hash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return null;
  }

  try {
    return JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
}

// Route pour vérifier l'identité depuis Lovable.
// Les autres API admin devront appliquer
// cette même vérification à chaque requête.

app.post("/api/admin/verify", (req, res) => {
  const user = verifierInitData(req.body?.initData);

  if (!user || String(user.id) !== ADMIN_ID) {
    return res.status(403).json({
      authorized: false
    });
  }

  return res.json({
    authorized: true,
    user_id: String(user.id)
  });
});

// ===============================
// WEBHOOK TELEGRAM
// ===============================

app.post("/telegram-webhook", async (req, res) => {
  const receivedSecret =
    req.headers["x-telegram-bot-api-secret-token"];

  if (receivedSecret !== WEBHOOK_SECRET) {
    return res.sendStatus(403);
  }

  res.sendStatus(200);

  try {
    const message = req.body?.message;

    if (!message || !message.from) return;

    const chatId = message.chat.id;
    const userId = message.from.id;

    // Uniquement les messages privés.
    if (message.chat.type !== "private") return;

    const text = (message.text || "").trim();

    if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
      await afficherAccueil(chatId, message.from);
      return;
    }

    if (/^\/admin(?:@\w+)?$/i.test(text)) {
      await afficherAdmin(chatId, userId);
      return;
    }

    if (text === "🏠 Accueil" || text === "Accueil") {
      await afficherAccueil(chatId, message.from);
      return;
    }

    // Toutes les anciennes commandes sont ignorées.
  } catch (error) {
    console.error("Webhook:", error.message);
  }
});

// ===============================
// SANTÉ DU SERVEUR
// ===============================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    bot: "Doctor Pharma 33",
    commands: ["/start", "/admin"]
  });
});

// ===============================
// DÉMARRAGE
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Doctor Pharma 33 actif sur ${PORT}`);

  try {
    await telegram("setWebhook", {
      url: `${BASE_URL}/telegram-webhook`,
      secret_token: WEBHOOK_SECRET,
      allowed_updates: ["message"],
      drop_pending_updates: false
    });

    await telegram("setMyCommands", {
      commands: [
        {
          command: "start",
          description: "🏠 Accueil"
        },
        {
          command: "admin",
          description: "🔐 Administration"
        }
      ]
    });

    console.log("Webhook et commandes configurés");
  } catch (error) {
    console.error("Démarrage:", error.message);
  }
});
