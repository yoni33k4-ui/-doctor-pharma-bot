
const express = require("express");
const crypto = require("node:crypto");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

// ======================================
// CONFIGURATION
// ======================================

const TOKEN = (process.env.BOT_TOKEN || "").trim();

const BASE_URL = (process.env.BASE_URL || "")
  .trim()
  .replace(/\/$/, "");

const WEBHOOK_SECRET = (
  process.env.WEBHOOK_SECRET || ""
).trim();

const ADMIN_ID = (
  process.env.ADMIN_ID || ""
).trim();

const PORT = Number(process.env.PORT || 3000);

// ======================================
// LIENS
// ======================================

const CONTACT_URL =
  "https://t.me/Doctor_commande33k";

const TELEGRAM_URL =
  "https://t.me/+m304JfK-cfRiNmE0";

const TATO_URL =
  "https://tato.im/doctorpharma33776";

const CATALOGUE_URL =
  "https://tato.im/doctorpharma33776";

const AVIS_URL =
  "https://tato.im/doctoravis33";

const ADMIN_URL =
  "https://screenshot-perfect-7051.lovable.app/admin";

// ======================================
// MESSAGE DE BIENVENUE
// ======================================

const WELCOME_MESSAGE = [
  "✨ DTP — Saison 2026-2027 ✨",
  "",
  "🏪 Toute nos références sont enfin disponibles sur Telegram ! 🏪🔥",
  "",
  "📦 Livraison rapide : ✅",
  "📍 En main propre : ✅",
  "📞 Accueil : Une équipe réactive et à l’écoute ✅",
  "",
  "Nous contacter :",
  CONTACT_URL
].join("\n");

// ======================================
// 5 BOUTONS PRINCIPAUX
// ======================================

const MAIN_BUTTONS = {
  inline_keyboard: [
    [
      {
        text: "Contact 📱",
        url: CONTACT_URL
      }
    ],
    [
      {
        text: "Canal Telegram 📣",
        url: TELEGRAM_URL
      }
    ],
    [
      {
        text: "Canal Tato Talk 📢",
        url: TATO_URL
      }
    ],
    [
      {
        text: "Catalogue 🛍️",
        url: CATALOGUE_URL
      }
    ],
    [
      {
        text: "Avis ⭐",
        url: AVIS_URL
      }
    ]
  ]
};

// ======================================
// BOUTON GRIS PERMANENT
// ======================================

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

// ======================================
// APPELS API TELEGRAM
// ======================================

async function telegram(method, payload = {}) {
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      `${method}: ${result.description}`
    );
  }

  return result.result;
}

// ======================================
// AFFICHAGE ACCUEIL
// ======================================

async function showHome(chatId) {

  // Affiche le bouton gris permanent
  await telegram("sendMessage", {
    chat_id: chatId,
    text: "🏠 Accueil",
    reply_markup: HOME_KEYBOARD
  });

  // Affiche le message et les 5 boutons
  await telegram("sendMessage", {
    chat_id: chatId,
    text: WELCOME_MESSAGE,
    reply_markup: MAIN_BUTTONS,
    link_preview_options: {
      is_disabled: true
    }
  });
}

// ======================================
// COMMANDE ADMIN
// ======================================

async function showAdmin(message) {

  const chatId = message.chat.id;
  const userId = String(message.from?.id || "");

  if (
    !ADMIN_ID ||
    userId !== ADMIN_ID ||
    message.chat.type !== "private"
  ) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "⛔ Accès non autorisé."
    });
    return;
  }

  await telegram("sendMessage", {
    chat_id: chatId,
    text: "⚙️ Administration Doctor Pharma 33",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "⚙️ Ouvrir administration",
            url: ADMIN_URL
          }
        ]
      ]
    }
  });
}

// ======================================
// GESTION DES MESSAGES
// ======================================

async function handleUpdate(update) {

  const message = update.message;

  if (!message || !message.text) {
    return;
  }

  // Uniquement les conversations privées
  if (message.chat.type !== "private") {
    return;
  }

  const text = message.text.trim();
  const chatId = message.chat.id;

  // Démarrage initial Telegram
  if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
    await showHome(chatId);
    return;
  }

  // Bouton gris permanent
  if (text === "🏠 Accueil") {
    await showHome(chatId);
    return;
  }

  // Administration
  if (/^\/admin(?:@\w+)?$/i.test(text)) {
    await showAdmin(message);
    return;
  }
}

// ======================================
// WEBHOOK
// ======================================

app.post("/webhook", async (req, res) => {

  const receivedSecret = req.get(
    "X-Telegram-Bot-Api-Secret-Token"
  ) || "";

  const expected = Buffer.from(WEBHOOK_SECRET);
  const received = Buffer.from(receivedSecret);

  if (
    !WEBHOOK_SECRET ||
    expected.length !== received.length ||
    !crypto.timingSafeEqual(expected, received)
  ) {
    return res.sendStatus(403);
  }

  // Confirmer rapidement la réception
  res.sendStatus(200);

  try {
    await handleUpdate(req.body);
  } catch (error) {
    console.error(
      "Erreur traitement:",
      error.message
    );
  }
});

// ======================================
// PAGE SANTÉ
// ======================================

app.get("/", (req, res) => {
  res.status(200).send(
    "Doctor Pharma 33 - Bot actif"
  );
});

// ======================================
// DÉMARRAGE
// ======================================

async function start() {

  if (!TOKEN) {
    throw new Error("BOT_TOKEN manquant");
  }

  if (!BASE_URL.startsWith("https://")) {
    throw new Error("BASE_URL invalide");
  }

  if (!WEBHOOK_SECRET) {
    throw new Error("WEBHOOK_SECRET manquant");
  }

  if (!ADMIN_ID) {
    throw new Error("ADMIN_ID manquant");
  }

  app.listen(PORT, async () => {

    console.log("Serveur actif sur", PORT);

    try {

      // Retire /start du menu visible
      await telegram("deleteMyCommands", {
        scope: {
          type: "default"
        }
      });

      // Aucun ancien message en attente
      await telegram("setWebhook", {
        url: `${BASE_URL}/webhook`,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ["message"],
        drop_pending_updates: true
      });

      console.log("Webhook installé");
      console.log("Bot prêt");

    } catch (error) {
      console.error(
        "Erreur initialisation:",
        error.message
      );
    }
  });
}

start().catch(console.error);
