const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const app = express();
app.use(express.json({ limit: "1mb" }));

const TOKEN = (process.env.BOT_TOKEN || "").trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const SUPABASE_SECRET_KEY = (process.env.SUPABASE_SECRET_KEY || "").trim();

const ADMIN_ID = "8805663950";
const BASE_URL = "https://doctor-pharma-bot-iyki.onrender.com";
const PHOTO_NAME = "3168703F-5AD2-4B96-A901-3E86B0355FF8.png";
const PHOTO_PATH = path.join(__dirname, PHOTO_NAME);

// Telegram signe les requêtes avec ce secret ; ne jamais l'afficher.
const WEBHOOK_SECRET = crypto
  .createHmac("sha256", TOKEN)
  .update("doctor-pharma-webhook-v1")
  .digest("hex");

const TEXTE = `<b>Bienvenue 👋
⭐️ Doctor Pharma 33 ⭐️🏥
🇫🇷 Saison 2026-2027 🇫🇷

🏥 La Pharmacie Bordelaise et enfin disponible sur telegram ! 🏪🔥


⚡ Une équipe réactive et à ecoute🧏🏻‍♂️
📦 Livraison rapide  🔥
⭐️ Qualité assurée !!! 🤝
💯 promotion tout les samedi 📆


👇Appuie sur le bouton boutique pour découvrir le menu 🫵


🚨 Rappel : 🚨
🔄 /START pour actualiser le bot
Et profiter pleinement des
Dernières mises à jours 🔥

📲 @Doctor_commande33k</b>`;

const BOUTONS = {
  inline_keyboard: [
    [
      {
        style: "primary",
        text: "✈️ Tato Talk",
        url: "https://tato.im/doctorpharma33776"
      }
    ],
    [
      {
        style: "primary",
        text: "⭐ Avis",
        url: "https://tato.im/doctoravis33"
      },
      {
        style: "primary",
        text: "📞 Contact",
        url: "https://t.me/o_commande33k"
      }
    ],
    [
      {
        style: "primary",
        text: "📢 New Canal",
        url: "https://t.me/Doctor_Pharma33"
      },
      {
        style: "primary",
        text: "🟢 WhatsApp",
        url: "https://wa.me/33758106388"
      }
    ],
    [
      {
        style: "success",
        text: "🏪 Boutique 🥼",
        web_app: {
          url: "https://layer-aligner.lovable.app"
        }
      }
    ]
  ]
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function telegram(method, body, multipart = false) {
  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    ...(multipart ? {} : { headers: { "Content-Type": "application/json" } }),
    body: multipart ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });

  const result = await response.json();

  if (!result.ok) {
    const error = new Error(`${method} : ${result.description || "Erreur Telegram"}`);
    error.telegramCode = result.error_code;
    error.retryAfter = result.parameters?.retry_after;
    throw error;
  }

  return result.result;
}

const dire = (chatId, text) =>
  telegram("sendMessage", { chat_id: chatId, text });

async function db(resource, method = "GET", body, prefer = "return=minimal") {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${resource}`, {
    method,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      "Content-Type": "application/json",
      Prefer: prefer
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(
      `Supabase : HTTP ${response.status}. Vérifie l'URL, la clé secrète et la table bot_users.`
    );
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function enregistrer(chatId) {
  await db(
    "bot_users?on_conflict=chat_id",
    "POST",
    { chat_id: chatId, active: true },
    "resolution=merge-duplicates,return=minimal"
  );
}

async function desactiver(chatId) {
  await db(`bot_users?chat_id=eq.${chatId}`, "PATCH", { active: false });
}

async function utilisateurs() {
  const ids = [];

  for (let offset = 0; ; offset += 500) {
    const rows = await db(
      `bot_users?select=chat_id&active=eq.true&order=chat_id.asc&limit=500&offset=${offset}`
    );

    ids.push(...rows.map(row => row.chat_id));

    if (rows.length < 500) return ids;
  }
}

async function envoyerPhoto(chatId) {
  const image = await fs.promises.readFile(PHOTO_PATH);
  const form = new FormData();

  form.append("chat_id", String(chatId));
  form.append("caption", "⭐️ Doctor Pharma 33 ⭐️");
  form.append("photo", new Blob([image], { type: "image/png" }), PHOTO_NAME);

  await telegram("sendPhoto", form, true);
}

let brouillon = null;
let diffusionEnCours = false;

const optOut = new Set();
let fileMessages = Promise.resolve();
const updatesVus = new Set();

async function diffuser(draft) {
  let sent = 0;
  let failed = 0;
  let unknown = 0;
  let skipped = 0;

  try {
    await dire(
      ADMIN_ID,
      `Envoi en cours à ${draft.ids.length} utilisateur(s).`
    );

    for (const chatId of draft.ids) {
      // Relire l'abonnement pour respecter /stop, même entre deux diffusions.
      if (optOut.has(String(chatId))) {
        skipped++;
        continue;
      }

      const rows = await db(`bot_users?select=active&chat_id=eq.${chatId}`);

      if (!rows[0]?.active || optOut.has(String(chatId))) {
        skipped++;
        continue;
      }

      try {
        // Réessayer uniquement un refus explicite 429, jamais un timeout incertain.
        for (let attempt = 0; ; attempt++) {
          try {
            await telegram(draft.method, {
              chat_id: chatId,
              ...draft.media
            });

            sent++;
            break;
          } catch (error) {
            if (error.telegramCode === 429 && attempt < 3) {
              await wait((Number(error.retryAfter) || 5) * 1000 + 250);

              if (optOut.has(String(chatId))) {
                skipped++;
                break;
              }

              continue;
            }

            throw error;
          }
        }
      } catch (error) {
        if (error.telegramCode) {
          failed++;

          if (error.telegramCode === 403) {
            await desactiver(chatId);
          }
        } else {
          // Le message a peut-être été reçu : éviter un second envoi automatique.
          unknown++;
        }
      }

      await wait(150);
    }

    await dire(
      ADMIN_ID,
      `Diffusion terminée ✅\nEnvoyés : ${sent}\nÉchecs : ${failed}\nEnvois non confirmés : ${unknown}\nDésabonnés ignorés : ${skipped}`
    );
  } catch (error) {
    console.error("Diffusion interrompue :", error.message);

    await dire(
      ADMIN_ID,
      `Diffusion interrompue.\nEnvoyés : ${sent}\nÉchecs : ${failed}\nNon confirmés : ${unknown}\nNe relance pas à tous : certains ont déjà reçu la publication. Vérifie Render/Supabase.`
    ).catch(() => {});
  } finally {
    diffusionEnCours = false;
  }
}

async function traiter(message) {
  if (!message || message.chat?.type !== "private" || !message.from) return;

  const chatId = message.chat.id;
  const admin = String(message.from.id) === ADMIN_ID;
  const text = message.text || "";
  const command = text
    .match(/^\/(\w+)(?:@\w+)?(?:\s|$)/)?.[1]
    ?.toLowerCase();

  if (command === "start") {
    try {
      await enregistrer(chatId);
      optOut.delete(String(chatId));
    } catch (error) {
      console.error(error.message);

      if (admin) {
        await dire(
          chatId,
          "⚠️ Le menu fonctionne, mais la sauvegarde Supabase a échoué. Vérifie SUPABASE_URL, SUPABASE_SECRET_KEY et bot_users."
        );
      }
    }

    try {
      await envoyerPhoto(chatId);
    } catch (error) {
      console.error(
        error.code === "ENOENT"
          ? `Photo introuvable : ${PHOTO_NAME}`
          : error.message
      );
    }

    await telegram("sendMessage", {
      chat_id: chatId,
      text: TEXTE,
      parse_mode: "HTML",
      reply_markup: BOUTONS,
      disable_web_page_preview: true
    });

    return;
  }

  if (command === "stop") {
    optOut.add(String(chatId));
    await desactiver(chatId);

    await dire(
      chatId,
      "Tu ne recevras plus les diffusions. /start pour les réactiver."
    );

    return;
  }

  if (command === "monid") {
    await dire(chatId, `Ton identifiant Telegram : ${message.from.id}`);
    return;
  }

  if (!admin) return;

  if (command === "stats") {
    const ids = await utilisateurs();

    await dire(
      chatId,
      `Utilisateurs enregistrés et actifs : ${ids.length}\n${
        diffusionEnCours
          ? "Une diffusion est en cours."
          : "Aucune diffusion en cours."
      }`
    );

    return;
  }

  if (command === "annuler") {
    brouillon = null;

    await dire(
      chatId,
      "Brouillon annulé. Une diffusion déjà lancée continue."
    );

    return;
  }

  if (command === "diffuser" || command === "diffuserphoto") {
    if (diffusionEnCours) {
      await dire(chatId, "Une diffusion est déjà en cours.");
      return;
    }

    const source = message.reply_to_message;
    const photo = command === "diffuserphoto";

    if (!(photo ? source?.photo?.length : source?.video) || source.media_group_id) {
      await dire(
        chatId,
        photo
          ? "Envoie une seule image à ce bot en tant que PHOTO avec ta description en légende. Réponds ensuite À CETTE IMAGE avec /diffuserphoto. Les albums et fichiers ne sont pas acceptés."
          : "Envoie une seule vidéo à ce bot avec ta description en légende. Réponds ensuite À CETTE VIDÉO avec /diffuser."
      );

      return;
    }

    const ids = await utilisateurs();

    if (!ids.length) {
      await dire(chatId, "Aucun utilisateur enregistré. Fais /start pour tester.");
      return;
    }

    const method = photo ? "sendPhoto" : "sendVideo";
    const media = {
      ...(photo
        ? { photo: source.photo[source.photo.length - 1].file_id }
        : { video: source.video.file_id, supports_streaming: true }),
      caption: source.caption || "",
      caption_entities: source.caption_entities || []
    };

    await telegram(method, {
      chat_id: chatId,
      ...media
    });

    const code = crypto.randomBytes(3).toString("hex");

    brouillon = {
      ids,
      method,
      media,
      code,
      expires: Date.now() + 10 * 60 * 1000
    };

    await dire(
      chatId,
      `Aperçu ci-dessus. Destinataires : ${ids.length}.\nPour envoyer, écris :\n/confirmer ${code}\n\n/annuler pour annuler. Cet aperçu expire dans 10 minutes.`
    );

    return;
  }

  if (command === "confirmer") {
    const code = text.trim().split(/\s+/)[1];

    if (diffusionEnCours) {
      await dire(chatId, "Une diffusion est déjà en cours.");
      return;
    }

    if (!brouillon || brouillon.expires < Date.now() || code !== brouillon.code) {
      await dire(
        chatId,
        "Confirmation invalide ou aperçu expiré. Réponds à ta vidéo avec /diffuser ou à ta photo avec /diffuserphoto."
      );

      return;
    }

    const draft = brouillon;
    brouillon = null;
    diffusionEnCours = true;

    void diffuser(draft);
    return;
  }

  if (command === "aide") {
    await dire(
      chatId,
      "/stats : nombre d'utilisateurs\n/monid : ton identifiant\n/diffuser : en réponse à une vidéo avec légende\n/diffuserphoto : en réponse à une photo avec légende\n/confirmer CODE : envoyer l'aperçu\n/annuler : supprimer l'aperçu\n/stop : arrêter tes notifications"
    );
  }
}

app.get("/", (_req, res) =>
  res.send("Serveur Doctor Pharma 33 actif ✅")
);

app.post("/webhook", (req, res) => {
  const secret = req.get("X-Telegram-Bot-Api-Secret-Token") || "";
  const received = Buffer.from(secret);
  const expected = Buffer.from(WEBHOOK_SECRET);

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return res.sendStatus(403);
  }

  const id = req.body?.update_id;

  if (!Number.isSafeInteger(id)) return res.sendStatus(400);
  if (updatesVus.has(id)) return res.sendStatus(200);

  updatesVus.add(id);

  if (updatesVus.size > 10000) {
    updatesVus.delete(updatesVus.values().next().value);
  }

  // Accusé de réception immédiat pour éviter les répétitions de Telegram.
  res.sendStatus(200);

  const message = req.body.message;

  if (
    message?.chat?.type === "private" &&
    /^\/stop(?:@\w+)?(?:\s|$)/i.test(message.text || "")
  ) {
    optOut.add(String(message.chat.id));
  }

  fileMessages = fileMessages
    .then(() => traiter(message))
    .catch(error => {
      console.error("Erreur traitement :", error.message);

      if (String(message?.from?.id) === ADMIN_ID) {
        return dire(
          ADMIN_ID,
          "Une erreur est survenue. Consulte les logs Render et vérifie Supabase."
        ).catch(() => {});
      }
    });
});

async function configurerWebhook() {
  await telegram("setWebhook", {
    url: `${BASE_URL}/webhook`,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: ["message"],
    max_connections: 1
  });
}

// Configuration du webhook au démarrage.
if (require.main === module) {
  if (!TOKEN || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
      "Il faut BOT_TOKEN, SUPABASE_URL et SUPABASE_SECRET_KEY dans Render."
    );
  }

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL)) {
    throw new Error(
      "SUPABASE_URL doit être l'adresse https://…supabase.co du projet."
    );
  }

  if (!SUPABASE_SECRET_KEY.startsWith("sb_secret_")) {
    throw new Error(
      "SUPABASE_SECRET_KEY doit commencer par sb_secret_."
    );
  }

  app.listen(process.env.PORT || 3000, async () => {
    console.log("Serveur démarré ✅");

    try {
      const me = await telegram("getMe", {});
      console.log(`Bot connecté : @${me.username}`);

      await configurerWebhook();
      console.log("Webhook configuré ✅");
    } catch (error) {
      console.error("Configuration Telegram :", error.message);
      process.exit(1);
    }

    try {
      await db("bot_users?select=chat_id&limit=1");
      console.log("Supabase connecté ✅");
    } catch (error) {
      console.error(error.message);
    }
  });
}

module.exports = {
  app,
  traiter,
  utilisateurs,
  telegram,
  db,
  WEBHOOK_SECRET
};
