
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
// LIENS DES BOUTONS
// ========================================

const TATO_URL =
  "https://tato.im/doctorpharma33776";

const TELEGRAM_CHANNEL_URL =
  "https://t.me/+m304JfK-cfRiNmE0";

const AVIS_URL =
  "https://tato.im/doctoravis33";

const CONTACT_URL =
  "https://t.me/Doctor_commande33k";

// ========================================
// ADMINISTRATION
// ========================================

const ADMIN_URL =
  "https://screenshot-perfect-7051.lovable.app/admin";

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
// VALIDATION DES VARIABLES
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

if (
  WEBHOOK_SECRET.length > 256 ||
  !/^[A-Za-z0-9_-]+$/.test(WEBHOOK_SECRET)
) {
  throw new Error("WEBHOOK_SECRET invalide");
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

// ========================================
// ENVOYER UN MESSAGE
// ========================================

async function sendMessage(
  chatId,
  text,
  extra = {}
) {
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
// LES 4 BOUTONS EN GRILLE 2 X 2
// ========================================

function linksKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "📱 Canal Tato Talk",
          url: TATO_URL
        },
        {
          text: "📣 Canal Telegram",
          url: TELEGRAM_CHANNEL_URL
        }
      ],
      [
        {
          text: "⭐ Avis",
          url: AVIS_URL
        },
        {
          text: "📞 Contact",
          url: CONTACT_URL
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
  "👇 Découvrez nos différents espaces."
].join("\n");

// ========================================
// ENVOI DE LA PHOTO
// ========================================

async function sendPhoto(
  chatId,
  caption,
  keyboard
) {
  const photo = fs.readFileSync(PHOTO_PATH);

  const form = new FormData();

  form.append(
    "chat_id",
    String(chatId)
  );

  form.append(
    "caption",
    caption
  );

  form.append(
    "reply_markup",
    JSON.stringify(keyboard)
  );

  form.append(
    "photo",
    new Blob(
      [photo],
      { type: "image/png" }
    ),
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
    throw new Error(
      `Telegram sendPhoto: ${result.description}`
    );
  }

  return result.result;
}

// ========================================
// AFFICHER L'ACCUEIL
// ========================================

async function sendWelcome(chatId) {

  // Afficher le bouton permanent Accueil
  await sendMessage(
    chatId,
    "🏠 Accueil",
    {
      reply_markup: HOME_KEYBOARD
    }
  );

  // Envoyer le message avec les 4 boutons
  if (fs.existsSync(PHOTO_PATH)) {

    await sendPhoto(
      chatId,
      WELCOME_TEXT,
      linksKeyboard()
    );

  } else {

    await sendMessage(
      chatId,
      WELCOME_TEXT,
      {
        reply_markup: linksKeyboard()
      }
    );

  }
}

// ========================================
// ADMINISTRATION PRIVEE
// ========================================

async function openAdmin(
  chatId,
  userId
) {

  if (
    !ADMIN_ID ||
    String(userId) !== ADMIN_ID
  ) {

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
// TRAITEMENT DES COMMANDES
// ========================================

async function handleUpdate(update) {

  const message = update.message;

  if (!message || !message.text) {
    return;
  }

  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text.trim();

  // Commande de démarrage
  if (
    /^\/start(?:@\w+)?(?:\s.*)?$/i.test(text)
  ) {

    await sendWelcome(chatId);
    return;

  }

  // Bouton permanent Accueil
  if (text === "🏠 Accueil") {

    await sendWelcome(chatId);
    return;

  }

  // Administration
  if (
    /^\/admin(?:@\w+)?$/i.test(text)
  ) {

    await openAdmin(
      chatId,
      userId
    );

    return;

  }
}

// ========================================
// ROUTE DE SANTE RENDER
// ========================================

app.get("/", (req, res) => {

  res.status(200).json({
    status: "online",
    service: "DTP Telegram Bot"
  });

});

// ========================================
// WEBHOOK SECURISE
// ========================================

app.post("/webhook", (req, res) => {

  const supplied = Buffer.from(
    String(
      req.headers[
        "x-telegram-bot-api-secret-token"
      ] || ""
    )
  );

  const expected = Buffer.from(
    WEBHOOK_SECRET
  );

  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(
      supplied,
      expected
    )
  ) {

    return res.sendStatus(403);

  }

  // Répondre rapidement à Telegram
  res.sendStatus(200);

  // Traiter le message
  handleUpdate(req.body).catch(error => {

    console.error(
      "Erreur Telegram:",
      error.message
    );

  });

});

// ========================================
// CONFIGURATION DU WEBHOOK
// ========================================

async function setupBot() {

  await telegram("setWebhook", {

    url: `${BASE_URL}/webhook`,

    secret_token: WEBHOOK_SECRET,

    allowed_updates: [
      "message"
    ],

    drop_pending_updates: false

  });

  // Commande admin disponible
  await telegram("setMyCommands", {
    commands: [
      {
        command: "admin",
        description: "Administration"
      }
    ]
  });

  console.log(
    "Webhook Telegram configuré"
  );
}

// ========================================
// DEMARRAGE DU SERVEUR
// ========================================

app.listen(
  PORT,
  "0.0.0.0",
  async () => {

    console.log(
      `Serveur actif sur le port ${PORT}`
    );

    try {

      await setupBot();

      console.log(
        "Bot Telegram prêt"
      );

    } catch (error) {

      console.error(
        "Erreur initialisation:",
        error.message
      );

    }

  }
);
