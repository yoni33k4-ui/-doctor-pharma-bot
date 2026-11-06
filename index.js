
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

// ========================================
// CONFIGURATION RENDER
// ========================================

const TOKEN = (process.env.BOT_TOKEN || "").trim();

const BASE_URL = (process.env.BASE_URL || "")
  .trim()
  .replace(/\/$/, "");

const WEBHOOK_SECRET = (
  process.env.WEBHOOK_SECRET || ""
).trim();

const ADMIN_ID = String(
  process.env.ADMIN_ID || ""
).trim();

const PORT = Number(process.env.PORT || 3000);

// ========================================
// MINI-APPLICATION
// ========================================

const CATALOGUE_URL =
  "https://screenshot-perfect-7051.lovable.app";

const ADMIN_URL =
  "https://screenshot-perfect-7051.lovable.app/admin";

// ========================================
// LES 4 BOUTONS
// Renseigner les liens dans Render
// ========================================

const BUTTONS = [
  {
    text: "📱 Tato Talk",
    url: process.env.TATO_URL
  },
  {
    text: "⭐ Avis",
    url: process.env.AVIS_URL
  },
  {
    text: "💬 WhatsApp",
    url: process.env.WHATSAPP_URL
  },
  {
    text: "📞 Contact",
    url: process.env.CONTACT_URL
  }
];

// ========================================
// PHOTO DE BIENVENUE
// ========================================

const PHOTO_NAME =
  "3168703F-5AD2-4B96-A901-3E86B0355FF8.png";

const PHOTO_PATH = path.join(
  __dirname,
  PHOTO_NAME
);

// ========================================
// VALIDATION
// ========================================

if (!TOKEN) {
  throw new Error("BOT_TOKEN manquant");
}

if (!/^https:\/\/[^/]+$/.test(BASE_URL)) {
  throw new Error("BASE_URL invalide");
}

if (!WEBHOOK_SECRET) {
  throw new Error("WEBHOOK_SECRET manquant");
}

// ========================================
// API TELEGRAM
// ========================================

async function telegram(method, payload = {}) {
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(
      `Telegram ${method}: ${data.description}`
    );
  }

  return data.result;
}

async function sendMessage(chatId, text, extra = {}) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    ...extra
  });
}

// ========================================
// BOUTON ACCUEIL PERMANENT
// ========================================

const HOME_KEYBOARD = {
  keyboard: [
    [
      {
        text: "🏠 Accueil"
      }
    ]
  ],
  resize_keyboard: true,
  is_persistent: true
};

// ========================================
// BOUTONS INLINE EN GRILLE
// ========================================

function makeButton(button) {
  if (
    button.url &&
    /^https:\/\//.test(button.url)
  ) {
    return {
      text: button.text,
      url: button.url
    };
  }

  return {
    text: button.text,
    callback_data: "link_missing"
  };
}

function catalogueKeyboard() {
  return {
    inline_keyboard: [
      [
        makeButton(BUTTONS[0]),
        makeButton(BUTTONS[1])
      ],
      [
        makeButton(BUTTONS[2]),
        makeButton(BUTTONS[3])
      ],
      [
        {
          text: "🛍️ OUVRIR LE CATALOGUE",
          web_app: {
            url: CATALOGUE_URL
          },
          style: "primary"
        }
      ]
    ]
  };
}

// ========================================
// MESSAGE DE BIENVENUE
// ========================================

const WELCOME_TEXT = [
  "✨ DTP — Saison 2026-2027 ✨",
  "",
  "🏪 Toutes nos références sont enfin disponibles sur Telegram ! 🏪🔥",
  "",
  "📦 Livraison rapide : ✅",
  "📍 En main propre",
  "",
  "👇 Découvrez nos différents espaces et notre catalogue."
].join("\n");

async function sendWelcome(chatId) {
  await sendMessage(
    chatId,
    "🏠 Accueil",
    {
      reply_markup: HOME_KEYBOARD
    }
  );

  if (fs.existsSync(PHOTO_PATH)) {
    const photo = fs.readFileSync(PHOTO_PATH);
    const form = new FormData();

    form.append("chat_id", String(chatId));
    form.append("caption", WELCOME_TEXT);
    form.append(
      "reply_markup",
      JSON.stringify(catalogueKeyboard())
    );
    form.append(
      "photo",
      new Blob([photo], { type: "image/png" }),
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

    if (!result.ok) {
      throw new Error(result.description);
    }
  } else {
    await sendMessage(
      chatId,
      WELCOME_TEXT,
      {
        reply_markup: catalogueKeyboard()
      }
    );
  }
}

// ========================================
// ADMINISTRATION
// ========================================

async function openAdmin(chatId, userId) {
  if (String(userId) !== ADMIN_ID) {
    await sendMessage(
      chatId,
      "⛔ Accès réservé à l'administrateur."
    );
    return;
  }

  await sendMessage(
    chatId,
    "🔐 Administration DTP",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "⚙️ Ouvrir l'administration",
              web_app: {
                url: ADMIN_URL
              }
            }
          ]
        ]
      }
    }
  );
}

// ========================================
// TRAITEMENT DES MESSAGES
// ========================================

async function handleUpdate(update) {
  if (update.callback_query) {
    const query = update.callback_query;

    await telegram("answerCallbackQuery", {
      callback_query_id: query.id,
      text: "Lien non configuré.",
      show_alert: true
    });

    return;
  }

  const message = update.message;

  if (!message || !message.text) {
    return;
  }

  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text.trim();

  if (text === "/start") {
    await sendWelcome(chatId);
    return;
  }

  if (text === "🏠 Accueil") {
    await sendWelcome(chatId);
    return;
  }

  if (text === "/admin") {
    await openAdmin(chatId, userId);
    return;
  }
}

// ========================================
// PROTECTION WEBHOOK
// ========================================

app.get("/", (req, res) => {
  res.status(200).json({
    status: "online",
    service: "DTP Telegram Bot"
  });
});

app.post("/webhook", (req, res) => {
  const secret =
    req.headers["x-telegram-bot-api-secret-token"];

  const supplied = Buffer.from(
    String(secret || "")
  );

  const expected = Buffer.from(WEBHOOK_SECRET);

  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(supplied, expected)
  ) {
    return res.sendStatus(403);
  }

  res.sendStatus(200);

  handleUpdate(req.body).catch(error => {
    console.error(
      "Erreur update:",
      error.message
    );
  });
});

// ========================================
// INITIALISATION TELEGRAM
// ========================================

async function setupBot() {
  await telegram("setWebhook", {
    url: `${BASE_URL}/webhook`,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: [
      "message",
      "callback_query"
    ],
    drop_pending_updates: false
  });

  await telegram("setMyCommands", {
    commands: [
      {
        command: "admin",
        description: "Administration"
      }
    ]
  });

  console.log("Webhook Telegram configuré");
}

// ========================================
// DEMARRAGE
// ========================================

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Serveur actif sur ${PORT}`);

  try {
    await setupBot();
    console.log("Bot Telegram prêt");
  } catch (error) {
    console.error(
      "Erreur initialisation:",
      error.message
    );
  }
});
