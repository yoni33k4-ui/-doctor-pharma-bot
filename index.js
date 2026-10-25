const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const app = express();
app.use(express.json({ limit: "1mb" }));

const TOKEN = (process.env.BOT_TOKEN || "").trim();

const SUPABASE_URL = (process.env.SUPABASE_URL || "")
  .trim()
  .replace(/\/$/, "");

const SUPABASE_SECRET_KEY = (
  process.env.SUPABASE_SECRET_KEY || ""
).trim();

const ADMIN_ID = "8516075351";
const BASE_URL = "https://doctor-pharma-bot-iyki.onrender.com";

const PHOTO_NAME = "3168703F-5AD2-4B96-A901-3E86B0355FF8.png";
const PHOTO_PATH = path.join(__dirname, PHOTO_NAME);

const WEBHOOK_SECRET = crypto
  .createHmac("sha256", TOKEN)
  .update("doctor-pharma-webhook-v1")
  .digest("hex");

const TEXTE = `<b>Bienvenue 👋
⭐️ Doctor Pharma 33 ⭐️🏥
🇫🇷 Saison 2026-2027 🇫🇷

🏥 La Pharmacie Bordelaise et enfin disponible sur telegram ! 🏪🔥


⚡ Une équipe réactive et à ecoute🧏🏻‍♂️
⭐️ Qualité assurée !!! 🤝


👇Appuie sur le bouton boutique pour découvrir le menu 🫵


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
        url: "https://t.me/Doctor_commande33k"
      }
    ],
    [
      {
        style: "primary",
        text: "📢 New Canal",
        url: "https://t.me/+m304JfK-cfRiNmE0"
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
  const response = await fetch(
    `https://api.telegram.org/bot${TOKEN}/${method}`,
    {
      method: "POST",
      ...(multipart
        ? {}
        : {
            headers: {
              "Content-Type": "application/json"
            }
          }),
      body: multipart ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    }
  );

  const result = await response.json();

  if (!result.ok) {
    const error = new Error(
      `${method} : ${result.description || "Erreur Telegram"}`
    );

    error.telegramCode = result.error_code;
    error.retryAfter = result.parameters?.retry_after;

    throw error;
  }

  return result.result;
}

const dire = (chatId, text) =>
  telegram("sendMessage", {
    chat_id: chatId,
    text
  });

async function db(
  resource,
  method = "GET",
  body,
  prefer = "return=minimal"
) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${resource}`,
    {
      method,
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        "Content-Type": "application/json",
        Prefer: prefer
      },
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body)
          }),
      signal: AbortSignal.timeout(20000)
    }
  );

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
    {
      chat_id: chatId,
      active: true
    },
    "resolution=merge-duplicates,return=minimal"
  );
}

async function desactiver(chatId) {
  await db(
    `bot_users?chat_id=eq.${chatId}`,
    "PATCH",
    {
      active: false
    }
  );
}

async function utilisateurs() {
  const ids = [];

  for (let offset = 0; ; offset += 500) {
    const rows = await db(
      `bot_users?select=chat_id&active=eq.true&order=chat_id.asc&limit=500&offset=${offset}`
    );

    ids.push(...rows.map(row => row.chat_id));

    if (rows.length < 500) {
      return ids;
    }
  }
}

// Envoie l'image, le texte de bienvenue et les boutons
// ensemble dans un seul message Telegram.
async function envoyerPhoto(chatId) {
  const image = await fs.promises.readFile(PHOTO_PATH);

  const form = new FormData();

  form.append("chat_id", String(chatId));
  form.append("caption", TEXTE);
  form.append("parse_mode", "HTML");
  form.append("reply_markup", JSON.stringify(BOUTONS));

  form.append(
    "photo",
    new Blob([image], {
      type: "image/png"
    }),
    PHOTO_NAME
  );

  await telegram("sendPhoto", form, true);
}

let brouillon = null;
let attenteTexte = false;
let diffusionEnCours = false;

const optOut = new Set();

let fileMessages = Promise.resolve();

const updatesVus = new Set();

async function preparerTexte(chatId, text, entities = []) {
  if (!text.trim() || text.length > 4096) {
    await dire(
      chatId,
      "Écris un message non vide de 4 096 caractères maximum, ou /annuler."
    );
    return;
  }

  const ids = await utilisateurs();

  if (!ids.length) {
    await dire(
      chatId,
      "Aucun destinataire actif. Les utilisateurs doivent faire /start pour s'inscrire."
    );
    return;
  }

  const media = {
    text,
    entities
  };

  await telegram("sendMessage", {
    chat_id: chatId,
    ...media
  });

  const code = crypto.randomBytes(3).toString("hex");

  brouillon = {
    ids,
    method: "sendMessage",
    media,
    code,
    expires: Date.now() + 10 * 60 * 1000
  };

  attenteTexte = false;

  await dire(
    chatId,
    `Aperçu ci-dessus ✅
Destinataires : ${ids.length}

Pour envoyer à tous, écris :
/confirmer ${code}

/annuler pour annuler.
Cet aperçu expire dans 10 minutes.`
  );
}

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
      if (optOut.has(String(chatId))) {
        skipped++;
        continue;
      }

      const rows = await db(
        `bot_users?select=active&chat_id=eq.${chatId}`
      );

      if (!rows[0]?.active || optOut.has(String(chatId))) {
        skipped++;
        continue;
      }

      try {
        // Réessayer uniquement un refus explicite 429.
        // Ne pas réessayer un timeout : le message a pu être reçu.
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
              await wait(
                (Number(error.retryAfter) || 5) * 1000 + 250
              );

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
          unknown++;
        }
      }

      await wait(150);
    }

    await dire(
      ADMIN_ID,
      `Diffusion terminée ✅
Envoyés : ${sent}
Échecs : ${failed}
Envois non confirmés : ${unknown}
Désabonnés ignorés : ${skipped}`
    );
  } catch (error) {
    console.error("Diffusion interrompue :", error.message);

    await dire(
      ADMIN_ID,
      `Diffusion interrompue.
Envoyés : ${sent}
Échecs : ${failed}
Non confirmés : ${unknown}
Ne relance pas à tous : certains ont déjà reçu la publication. Vérifie Render/Supabase.`
    ).catch(() => {});
  } finally {
    diffusionEnCours = false;
  }
}

async function traiter(message) {
  if (
    !message ||
    message.chat?.type !== "private" ||
    !message.from
  ) {
    return;
  }

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

    await envoyerPhoto(chatId);

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
    await dire(
      chatId,
      `Ton identifiant Telegram : ${message.from.id}`
    );

    return;
  }

  if (!admin) {
    return;
  }

  if (command === "reinitialiser") {
    if (diffusionEnCours) {
      await dire(
        chatId,
        "Attends la fin de la diffusion avant de réinitialiser la liste."
      );
      return;
    }

    attenteTexte = false;
    brouillon = null;

    const ids = await utilisateurs();
    const code = crypto.randomBytes(3).toString("hex");

    brouillon = {
      type: "reset",
      code,
      expires: Date.now() + 10 * 60 * 1000
    };

    await dire(
      chatId,
      `Réinitialisation de la liste : ${ids.length} destinataire(s) actif(s).

Tous les utilisateurs enregistrés dans bot_users seront supprimés de la liste. Chacun devra refaire /start pour être réinscrit. Les conversations Telegram restent intactes.

Pour repartir de zéro :
/confirmer ${code}

/annuler pour annuler. Cette confirmation expire dans 10 minutes.`
    );

    return;
  }

  if (command === "ecrire") {
    if (diffusionEnCours) {
      await dire(chatId, "Une diffusion est déjà en cours.");
      return;
    }

    brouillon = null;
    attenteTexte = true;

    const prefix =
      text.match(/^\/ecrire(?:@\w+)?(?:\s+|$)/i)?.[0] || "";

    const contenu = text.slice(prefix.length);

    if (contenu.trim()) {
      const entities = (message.entities || [])
        .filter(entity => entity.offset >= prefix.length)
        .map(entity => ({
          ...entity,
          offset: entity.offset - prefix.length
        }));

      await preparerTexte(chatId, contenu, entities);
    } else {
      await dire(
        chatId,
        "Écris maintenant le message à envoyer. Je te montrerai l'aperçu avant confirmation.\n\n/annuler pour annuler."
      );
    }

    return;
  }

  if (attenteTexte && !command) {
    if (diffusionEnCours) {
      await dire(chatId, "Une diffusion est déjà en cours.");
      return;
    }

    await preparerTexte(
      chatId,
      text,
      message.entities || []
    );

    return;
  }

  if (command === "ouverture" || command === "fermeture") {
    if (diffusionEnCours) {
      await dire(chatId, "Une diffusion est déjà en cours.");
      return;
    }

    attenteTexte = false;
    brouillon = null;

    const ids = await utilisateurs();

    if (!ids.length) {
      await dire(
        chatId,
        "Aucun utilisateur enregistré. Fais /start pour tester."
      );
      return;
    }

    const ouverture = command === "ouverture";

    const media = ouverture
      ? {
          text: `Bonjour la team 🙋‍♂️👋
Nous sommes ouverts 🏪
Début des prises de commandes : 👇
@Doctor_commande33k`,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Ouvrir la boutique",
                  web_app: {
                    url: "https://layer-aligner.lovable.app"
                  }
                }
              ]
            ]
          }
        }
      : {
          text: `Bonne soirée la team 👋
Nous sommes fermés, à demain !!! 🙏❌`
        };

    await telegram("sendMessage", {
      chat_id: chatId,
      ...media
    });

    const code = crypto.randomBytes(3).toString("hex");

    brouillon = {
      ids,
      method: "sendMessage",
      media,
      code,
      expires: Date.now() + 10 * 60 * 1000
    };

    await dire(
      chatId,
      `Aperçu ci-dessus ✅
Destinataires : ${ids.length}

Pour envoyer à tous, écris :
/confirmer ${code}

/annuler pour annuler.
Cet aperçu expire dans 10 minutes.`
    );

    return;
  }

  if (command === "stats") {
    const ids = await utilisateurs();

    await dire(
      chatId,
      `Utilisateurs enregistrés et actifs : ${ids.length}
${
  diffusionEnCours
    ? "Une diffusion est en cours."
    : "Aucune diffusion en cours."
}`
    );

    return;
  }

  if (command === "annuler") {
    brouillon = null;
    attenteTexte = false;

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

    attenteTexte = false;
    brouillon = null;

    const source = message.reply_to_message;
    const photo = command === "diffuserphoto";

    if (
      !(photo ? source?.photo?.length : source?.video) ||
      source.media_group_id
    ) {
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
      await dire(
        chatId,
        "Aucun utilisateur enregistré. Fais /start pour tester."
      );
      return;
    }

    const method = photo ? "sendPhoto" : "sendVideo";

    const media = {
      ...(photo
        ? {
            photo:
              source.photo[source.photo.length - 1].file_id
          }
        : {
            video: source.video.file_id,
            supports_streaming: true
          }),
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
      `Aperçu ci-dessus. Destinataires : ${ids.length}.
Pour envoyer, écris :
/confirmer ${code}

/annuler pour annuler. Cet aperçu expire dans 10 minutes.`
    );

    return;
  }

  if (command === "confirmer") {
    const code = text.trim().split(/\s+/)[1];

    if (diffusionEnCours) {
      await dire(chatId, "Une diffusion est déjà en cours.");
      return;
    }

    if (
      !brouillon ||
      brouillon.expires < Date.now() ||
      code !== brouillon.code
    ) {
      await dire(
        chatId,
        "Confirmation invalide ou aperçu expiré. Utilise /ecrire, /ouverture, /fermeture ou /reinitialiser, ou réponds à ta vidéo avec /diffuser ou à ta photo avec /diffuserphoto."
      );
      return;
    }

    const draft = brouillon;

    brouillon = null;
    attenteTexte = false;

    if (draft.type === "reset") {
      await db(
        "bot_users?chat_id=not.is.null",
        "DELETE"
      );

      optOut.clear();

      await dire(
        chatId,
        `Liste réinitialisée ✅
Destinataires : 0
Seuls ceux qui feront /start à partir de maintenant seront réinscrits.
La liste ne sera pas vidée lors des redémarrages du serveur.`
      );

      return;
    }

    diffusionEnCours = true;

    void diffuser(draft);

    return;
  }

  if (command === "aide") {
    await dire(
      chatId,
      `/ecrire : écrire un message libre, puis confirmer son envoi
/ouverture : préparer le message d’ouverture
/fermeture : préparer le message de fermeture
/reinitialiser : vider la liste après confirmation
/stats : nombre d'utilisateurs actifs
/monid : ton identifiant
/diffuser : en réponse à une vidéo avec légende
/diffuserphoto : en réponse à une photo avec légende
/confirmer CODE : confirmer l'action affichée
/annuler : supprimer l'aperçu ou annuler la saisie
/stop : arrêter tes notifications`
    );
  }
}

app.get("/", (_req, res) => {
  res.send("Serveur Doctor Pharma 33 actif ✅");
});

app.post("/webhook", (req, res) => {
  const secret =
    req.get("X-Telegram-Bot-Api-Secret-Token") || "";

  const received = Buffer.from(secret);
  const expected = Buffer.from(WEBHOOK_SECRET);

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return res.sendStatus(403);
  }

  const id = req.body?.update_id;

  if (!Number.isSafeInteger(id)) {
    return res.sendStatus(400);
  }

  if (updatesVus.has(id)) {
    return res.sendStatus(200);
  }

  updatesVus.add(id);

  if (updatesVus.size > 10000) {
    updatesVus.delete(updatesVus.values().next().value);
  }

  // Réponse immédiate pour éviter les répétitions de Telegram.
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

if (require.main === module) {
  if (!TOKEN || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
      "Il faut BOT_TOKEN, SUPABASE_URL et SUPABASE_SECRET_KEY dans Render."
    );
  }

  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL)
  ) {
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
      console.error(
        "Configuration Telegram :",
        error.message
      );

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
