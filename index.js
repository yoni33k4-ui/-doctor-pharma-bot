const express = require("express");
const fs = require("node:fs");
const path = require("node:path");

const app = express();
app.use(express.json());

const TOKEN = (process.env.BOT_TOKEN || "").trim();

const BASE_URL =
  "https://doctor-pharma-bot-iyki.onrender.com";

const PHOTO_NAME =
  "3168703F-5AD2-4B96-A901-3E86B0355FF8.png";

const PHOTO_PATH = path.join(__dirname, PHOTO_NAME);

// ========================================
// LIENS
// ========================================

const TATO_URL = "https://tato.im/doctorpharma33776";
const AVIS_URL = "https://tato.im/doctoravis33";
const NEW_CANAL_URL = "https://t.me/+MIB2qImNuyQ0OWY0";
const WHATSAPP_URL = "https://wa.me/33758106388";
const CONTACT_URL = "https://t.me/o_commande33k";
const BOUTIQUE_URL = "https://doctor-pharma-shop.lovable.app/";

// ========================================
// TEXTE D'ACCUEIL
// ========================================

const TEXTE = `⛰️⭐️BIENVENUE CHEZ DOCTOR PHARMA 33⭐️⛰️

🏪La pharmacie bordelaise est enfin disponible sur Telegram ! 🏪🔥

💎 Premium quality : ✅
📞Service Client : Une équipe réactive et à l’écoute ✅

👇 Accède au menu en cliquant sur le bouton boutique 📲

⚠️Important : Appuie sur /start pour actualiser le menu et profiter pleinement des dernières mises à jour de la mini app.`;

// ========================================
// BOUTONS
// ========================================

const BOUTONS = {
  inline_keyboard: [
    [
      {
        text: "✈️ Tato Talk",
        url: TATO_URL
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
    ],
    [
      {
        text: "📢 New Canal",
        url: NEW_CANAL_URL
      },
      {
        text: "🟢 WhatsApp",
        url: WHATSAPP_URL
      }
    ],
    [
      {
        text: "🏪 Boutique 🥼",
        web_app: {
          url: BOUTIQUE_URL
        }
      }
    ]
  ]
};

// ========================================
// APPELS TELEGRAM
// ========================================

async function telegram(method, body) {
  if (!TOKEN) {
    throw new Error("BOT_TOKEN est manquant sur Render.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      `${method} : ${result.description || "Erreur Telegram"}`
    );
  }

  return result;
}

// ========================================
// ENVOI DE LA NOUVELLE PHOTO
// ========================================

async function envoyerPhoto(chatId) {
  if (!TOKEN) {
    throw new Error("BOT_TOKEN est manquant sur Render.");
  }

  const image = await fs.promises.readFile(PHOTO_PATH);

  const form = new FormData();

  form.append("chat_id", String(chatId));
  form.append("caption", "⭐️ Doctor Pharma 33 ⭐️");

  form.append(
    "photo",
    new Blob([image], { type: "image/png" }),
    PHOTO_NAME
  );

  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/sendPhoto`,
    {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30000)
    }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      result.description || "Erreur pendant l’envoi de la photo"
    );
  }

  console.log("Nouvelle photo envoyée ✅");
}

// ========================================
// PAGE TEST
// ========================================

app.get("/", (req, res) => {
  res.send("Serveur Doctor Pharma 33 actif ✅");
});

// ========================================
// WEBHOOK TELEGRAM
// ========================================

app.post("/webhook", async (req, res) => {
  const message = req.body?.message;

  if (
    !message ||
    typeof message.text !== "string" ||
    !/^\/start(?:@\w+)?(?:\s|$)/i.test(message.text)
  ) {
    return res.sendStatus(200);
  }

  const chatId = message.chat.id;

  console.log("Commande /start reçue ✅");

  // Photo envoyée en premier.
  try {
    await envoyerPhoto(chatId);
  } catch (error) {
    console.error(
      "Erreur photo :",
      error.code === "ENOENT"
        ? `Image introuvable : ${PHOTO_NAME}. Place-la à côté de index.js.`
        : error.message
    );
  }

  // Texte et boutons envoyés ensuite.
  try {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: TEXTE,
      reply_markup: BOUTONS,
      disable_web_page_preview: true
    });

    console.log("Message et boutons envoyés ✅");
  } catch (error) {
    console.error("Erreur message :", error.message);
  }

  return res.sendStatus(200);
});

// ========================================
// CONFIGURATION DU WEBHOOK
// ========================================

async function configurerWebhook() {
  return telegram("setWebhook", {
    url: `${BASE_URL}/webhook`,
    allowed_updates: ["message"]
  });
}

app.get("/setup-webhook", async (req, res) => {
  try {
    const result = await configurerWebhook();
    res.json(result);
  } catch (error) {
    console.error("Erreur webhook :", error.message);

    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// ========================================
// DÉMARRAGE DU SERVEUR
// ========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Serveur démarré sur le port ${PORT}`);

  if (fs.existsSync(PHOTO_PATH)) {
    console.log(`Photo trouvée : ${PHOTO_NAME} ✅`);
  } else {
    console.error(`Photo introuvable : ${PHOTO_NAME}`);
  }

  try {
    const result = await telegram("getMe", {});

    console.log(
      `Bot connecté : @${result.result.username} ✅`
    );

    await configurerWebhook();

    console.log("Webhook configuré automatiquement ✅");
  } catch (error) {
    console.error("Erreur au démarrage :", error.message);
  }
});
