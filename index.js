
const express = require("express");
const crypto = require("node:crypto");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

// =====================================
// CONFIGURATION RENDER
// =====================================

const BOT_TOKEN = (
  process.env.BOT_TOKEN || ""
).trim();

const BASE_URL = (
  process.env.BASE_URL || ""
).trim().replace(/\/$/, "");

const WEBHOOK_SECRET = (
  process.env.WEBHOOK_SECRET || ""
).trim();

const PORT = Number(
  process.env.PORT || 3000
);

// =====================================
// ADMINISTRATEUR UNIQUE
// =====================================

// Seul cet identifiant Telegram
// peut utiliser la commande /admin.

const ADMIN_ID = "9257017351";

// =====================================
// LIENS DOCTOR PHARMA 33
// =====================================

const LINKS = {
  tato:
    "https://tato.im/doctorpharma33776",

  telegram:
    "https://t.me/+m304JfK-cfRiNmE0",

  avis:
    "https://tato.im/doctoravis33",

  contact:
    "https://t.me/Doctor_commande33k",

  boutique:
    "https://layer-aligner.lovable.app",

  admin:
    "https://layer-aligner.lovable.app/admin"
};

// =====================================
// VALIDATION DES VARIABLES
// =====================================

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN manquant");
}

if (!/^https:\/\/[^/]+$/.test(BASE_URL)) {
  throw new Error("BASE_URL invalide");
}

if (
  !WEBHOOK_SECRET ||
  !/^[A-Za-z0-9_-]{1,256}$/.test(WEBHOOK_SECRET)
) {
  throw new Error("WEBHOOK_SECRET invalide");
}

// =====================================
// API TELEGRAM
// =====================================

async function telegram(method, data) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
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
      result.description || "Erreur Telegram"
    );
  }

  return result.result;
}

// =====================================
// MESSAGE DE BIENVENUE
// =====================================

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

// =====================================
// LES 5 BOUTONS
// =====================================

function welcomeKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "📱 Canal Tato Talk",
          url: LINKS.tato
        },
        {
          text: "📣 Canal Telegram",
          url: LINKS.telegram
        }
      ],
      [
        {
          text: "⭐ Avis",
          url: LINKS.avis
        },
        {
          text: "📞 Contact",
          url: LINKS.contact
        }
      ],
      [
        {
          text: "🛍️ Boutique",
          web_app: {
            url: LINKS.boutique
          },
          style: "primary"
        }
      ]
    ]
  };
}

// =====================================
// COMMANDE /START
// =====================================

async function startBot(chatId) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text: WELCOME_TEXT,
    reply_markup: welcomeKeyboard(),
    protect_content: true
  });
}

// =====================================
// ADMINISTRATION PRIVEE
// =====================================

async function adminBot(chatId, userId) {

  // Vérification de l'identifiant
  if (String(userId) !== ADMIN_ID) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "⛔ Accès refusé."
    });

    return;
  }

  // Accès administrateur autorisé
  await telegram("sendMessage", {
    chat_id: chatId,
    text: "🔐 Administration Doctor Pharma 33",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "⚙️ Ouvrir l'administration",
            web_app: {
              url: LINKS.admin
            }
          }
        ]
      ]
    }
  });
}

// =====================================
// RECEPTION DES COMMANDES
// =====================================

async function handleUpdate(update) {
  const message = update.message;

  if (!message?.text) {
    return;
  }

  // Discussions privées uniquement
  if (message.chat.type !== "private") {
    return;
  }

  const chatId = message.chat.id;
  const userId = message.from?.id;
  const command = message.text.trim();

  // Démarrage et actualisation
  if (
    /^\/start(?:@\w+)?(?:\s.*)?$/i.test(command)
  ) {
    await startBot(chatId);
    return;
  }

  // Administration privée
  if (
    /^\/admin(?:@\w+)?$/i.test(command)
  ) {
    await adminBot(chatId, userId);
    return;
  }
}

// =====================================
// SECURITE DU WEBHOOK
// =====================================

app.post("/webhook", (req, res) => {

  const received = Buffer.from(
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
    received.length !== expected.length ||
    !crypto.timingSafeEqual(
      received,
      expected
    )
  ) {
    return res.sendStatus(403);
  }

  res.sendStatus(200);

  handleUpdate(req.body).catch(error => {
    console.error(
      "Erreur webhook:",
      error.message
    );
  });
});

// =====================================
// ETAT DU SERVEUR RENDER
// =====================================

app.get("/", (req, res) => {
  res.status(200).json({
    status: "online",
    service: "Doctor Pharma 33"
  });
});

// =====================================
// INITIALISATION TELEGRAM
// =====================================

async function initialize() {

  // Configuration du webhook
  await telegram("setWebhook", {
    url: `${BASE_URL}/webhook`,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: ["message"],
    drop_pending_updates: false
  });

  // Commande publique /start
  await telegram("setMyCommands", {
    commands: [
      {
        command: "start",
        description: "Actualiser l'accueil"
      }
    ]
  });

  // Commande admin visible uniquement
  // pour le compte administrateur
  await telegram("setMyCommands", {
    scope: {
      type: "chat",
      chat_id: Number(ADMIN_ID)
    },
    commands: [
      {
        command: "start",
        description: "Actualiser l'accueil"
      },
      {
        command: "admin",
        description: "Administration privée"
      }
    ]
  });

  console.log(
    "Bot Telegram Doctor Pharma opérationnel"
  );
}

// =====================================
// DEMARRAGE DU SERVEUR
// =====================================

app.listen(PORT, "0.0.0.0", async () => {

  console.log(
    `Serveur actif sur le port ${PORT}`
  );

  try {
    await initialize();
  } catch (error) {
    console.error(
      "Erreur initialisation:",
      error.message
    );
  }
});
