
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
const BASE_URL =
  "https://doctor-pharma-bot-iyki.onrender.com";

const PHOTO_NAME =
  "3168703F-5AD2-4B96-A901-3E86B0355FF8.png";
const PHOTO_PATH = path.join(__dirname, PHOTO_NAME);

const WEBHOOK_SECRET = crypto
  .createHmac("sha256", TOKEN)
  .update("doctor-pharma-webhook-v1")
  .digest("hex");

const TEXTE = `<b>Bienvenue chez Doctor Pharma 33 👋🇫🇷

Les références du Doctor sont enfin disponibles sur Telegram ! 🔥

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

const CLAVIER_ACCUEIL = {
  keyboard: [
    [{ text: "🏠 ACCUEIL" }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

const wait = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

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
      `${method} : ${
        result.description || "Erreur Telegram"
      }`
    );

    error.telegramCode = result.error_code;
    error.retryAfter = result.parameters?.retry_after;
    throw error;
  }

  return result.result;
}

const dire = (chatId, text, extra = {}) =>
  telegram("sendMessage", {
    chat_id: chatId,
    text,
    ...extra
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
        Authorization:
          `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
        Prefer: prefer
      },
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000)
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `Supabase HTTP ${response.status}: ${detail}`
    );
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Enregistre l'utilisateur sans modifier
// son choix concernant les annonces.
async function enregistrerUtilisateur(message) {
  const chatId = message.chat.id;
  const user = message.from;

  const rows = await db(
    `bot_users?select=chat_id&chat_id=eq.${chatId}`
  );

  const profil = {
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    username: user.username || null
  };

  if (rows.length) {
    await db(
      `bot_users?chat_id=eq.${chatId}`,
      "PATCH",
      profil
    );
  } else {
    await db(
      "bot_users",
      "POST",
      {
        chat_id: chatId,
        ...profil,
        active: false
      }
    );
  }
}

async function modifierAnnonces(chatId, active) {
  await db(
    `bot_users?chat_id=eq.${chatId}`,
    "PATCH",
    { active }
  );
}

async function obtenirUtilisateurs(actifsSeulement = false) {
  const resultats = [];

  for (let offset = 0; ; offset += 500) {
    const filtre = actifsSeulement
      ? "&active=eq.true"
      : "";

    const rows = await db(
      "bot_users?select=chat_id,first_name," +
      "last_name,username,active" +
      filtre +
      `&order=chat_id.asc&limit=500&offset=${offset}`
    );

    resultats.push(...rows);

    if (rows.length < 500) {
      return resultats;
    }
  }
}

async function utilisateurs() {
  const rows = await obtenirUtilisateurs(true);
  return rows.map(row => row.chat_id);
}

// Image et boutons habituels.
async function envoyerPhoto(chatId) {
  const image = await fs.promises.readFile(PHOTO_PATH);
  const form = new FormData();

  form.append("chat_id", String(chatId));
  form.append("caption", TEXTE);
  form.append("parse_mode", "HTML");
  form.append("reply_markup", JSON.stringify(BOUTONS));

  form.append(
    "photo",
    new Blob([image], { type: "image/png" }),
    PHOTO_NAME
  );

  await telegram("sendPhoto", form, true);
}

// Affiche le bouton gris fixe et l'accueil.
async function afficherAccueil(chatId) {
  await dire(
    chatId,
    "🏠 Accueil Doctor Pharma 33",
    { reply_markup: CLAVIER_ACCUEIL }
  );

  await envoyerPhoto(chatId);
}

let brouillon = null;
let attenteTexte = false;
let diffusionEnCours = false;

const optOut = new Set();
const updatesVus = new Set();

let fileMessages = Promise.resolve();

async function ficheStats(chatId) {
  const rows = await obtenirUtilisateurs();

  const actifs = rows.filter(row => row.active);

  let texte = `📊 DOCTOR PHARMA 33 — STATISTIQUES

👥 Utilisateurs enregistrés : ${rows.length}
📢 Abonnés aux annonces : ${actifs.length}
🔕 Sans abonnement : ${rows.length - actifs.length}

📋 LISTE DES UTILISATEURS

`;

  if (!rows.length) {
    texte += "Aucun utilisateur enregistré.";
  } else {
    rows.forEach((row, index) => {
      const nom = [
        row.first_name,
        row.last_name
      ].filter(Boolean).join(" ") || "Sans nom";

      const pseudo = row.username
        ? ` (@${row.username})`
        : "";

      texte += `${index + 1}. ${nom}${pseudo}\n`;
      texte += `ID : ${row.chat_id}\n`;
      texte += row.active
        ? "Annonces : activées ✅\n\n"
        : "Annonces : désactivées 🔕\n\n";
    });
  }

  texte += diffusionEnCours
    ? "📤 Une diffusion est en cours."
    : "✅ Aucune diffusion en cours.";

  // Telegram limite les messages à 4096 caractères.
  // Découpage sans perdre les utilisateurs.
  const lignes = texte.split("\n");
  let partie = "";

  for (const ligne of lignes) {
    if (
      partie.length + ligne.length + 1 > 3900
    ) {
      await dire(chatId, partie);
      partie = "";
    }

    partie += ligne + "\n";
  }

  if (partie.trim()) {
    await dire(chatId, partie);
  }
}

async function preparerTexte(chatId, text, entities = []) {
  if (!text.trim() || text.length > 4096) {
    await dire(
      chatId,
      "Écris un message de 4 096 caractères maximum, ou /annuler."
    );
    return;
  }

  const ids = await utilisateurs();

  if (!ids.length) {
    await dire(
      chatId,
      "Aucun abonné aux annonces pour le moment."
    );
    return;
  }

  const media = { text, entities };

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

Pour envoyer à tous :
/confirmer ${code}

Pour annuler : /annuler

L'aperçu expire dans 10 minutes.`
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

      if (
        !rows[0]?.active ||
        optOut.has(String(chatId))
      ) {
        skipped++;
        continue;
      }

      try {
        for (let attempt = 0; ; attempt++) {
          try {
            await telegram(draft.method, {
              chat_id: chatId,
              ...draft.media
            });

            sent++;
            break;
          } catch (error) {
            if (
              error.telegramCode === 429 &&
              attempt < 3
            ) {
              await wait(
                (Number(error.retryAfter) || 5) *
                  1000 + 250
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
            await modifierAnnonces(chatId, false)
              .catch(() => {});
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
    console.error(
      "Diffusion interrompue :",
      error.message
    );

    await dire(
      ADMIN_ID,
      `Diffusion interrompue.

Envoyés : ${sent}
Échecs : ${failed}
Non confirmés : ${unknown}

Ne relance pas immédiatement la diffusion :
certains utilisateurs peuvent déjà l'avoir reçue.`
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

  // /start enregistre le profil et affiche l'accueil.
  if (
    command === "start" ||
    text.trim() === "🏠 ACCUEIL"
  ) {
    try {
      await enregistrerUtilisateur(message);
    } catch (error) {
      console.error(
        "Enregistrement utilisateur :",
        error.message
      );
    }

    await afficherAccueil(chatId);
    return;
  }

  // Inscription volontaire aux annonces.
  if (command === "annonces") {
    await enregistrerUtilisateur(message);

    const rows = await db(
      `bot_users?select=active&chat_id=eq.${chatId}`
    );

    if (rows[0]?.active) {
      await dire(
        chatId,
        "✅ Tes annonces sont déjà activées."
      );
      return;
    }

    await modifierAnnonces(chatId, true);
    optOut.delete(String(chatId));

    await dire(
      chatId,
      "✅ Annonces activées. Tu peux les arrêter à tout moment avec /stop."
    );
    return;
  }

  if (command === "stop") {
    optOut.add(String(chatId));

    await modifierAnnonces(chatId, false);

    await dire(
      chatId,
      "🔕 Annonces désactivées. Tu peux toujours utiliser la boutique et le bouton Accueil. Pour recevoir de nouveau les annonces, utilise /annonces."
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

  if (command === "stats") {
    await ficheStats(chatId);
    return;
  }

  if (command === "reinitialiser") {
    if (diffusionEnCours) {
      await dire(
        chatId,
        "Attends la fin de la diffusion."
      );
      return;
    }

    attenteTexte = false;
    brouillon = null;

    const rows = await obtenirUtilisateurs();
    const code = crypto.randomBytes(3).toString("hex");

    brouillon = {
      type: "reset",
      code,
      expires: Date.now() + 10 * 60 * 1000
    };

    await dire(
      chatId,
      `⚠️ Réinitialisation de la liste

Utilisateurs enregistrés : ${rows.length}

Cette opération supprimera tous les utilisateurs de bot_users, y compris leurs profils et leurs abonnements.

Pour confirmer :
/confirmer ${code}

Pour annuler : /annuler`
    );
    return;
  }

  if (command === "ecrire") {
    if (diffusionEnCours) {
      await dire(
        chatId,
        "Une diffusion est déjà en cours."
      );
      return;
    }

    brouillon = null;
    attenteTexte = true;

    const prefix =
      text.match(
        /^\/ecrire(?:@\w+)?(?:\s+|$)/i
      )?.[0] || "";

    const contenu = text.slice(prefix.length);

    if (contenu.trim()) {
      const entities = (message.entities || [])
        .filter(
          entity => entity.offset >= prefix.length
        )
        .map(entity => ({
          ...entity,
          offset: entity.offset - prefix.length
        }));

      await preparerTexte(
        chatId,
        contenu,
        entities
      );
    } else {
      await dire(
        chatId,
        "Écris ton message. Je te montrerai un aperçu avant la diffusion.\n\n/annuler pour annuler."
      );
    }

    return;
  }

  if (attenteTexte && !command) {
    if (diffusionEnCours) {
      await dire(
        chatId,
        "Une diffusion est déjà en cours."
      );
      return;
    }

    await preparerTexte(
      chatId,
      text,
      message.entities || []
    );
    return;
  }

  if (
    command === "ouverture" ||
    command === "fermeture"
  ) {
    if (diffusionEnCours) {
      await dire(
        chatId,
        "Une diffusion est déjà en cours."
      );
      return;
    }

    attenteTexte = false;
    brouillon = null;

    const ids = await utilisateurs();

    if (!ids.length) {
      await dire(
        chatId,
        "Aucun abonné aux annonces."
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

    const code = crypto.randomBytes(3)
      .toString("hex");

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

Pour envoyer :
/confirmer ${code}

Pour annuler : /annuler`
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

  if (
    command === "diffuser" ||
    command === "diffuserphoto"
  ) {
    if (diffusionEnCours) {
      await dire(
        chatId,
        "Une diffusion est déjà en cours."
      );
      return;
    }

    attenteTexte = false;
    brouillon = null;

    const source = message.reply_to_message;
    const photo = command === "diffuserphoto";

    if (
      !(photo
        ? source?.photo?.length
        : source?.video) ||
      source.media_group_id
    ) {
      await dire(
        chatId,
        photo
          ? "Envoie une seule PHOTO avec sa légende, puis réponds à cette photo avec /diffuserphoto."
          : "Envoie une seule VIDÉO avec sa légende, puis réponds à cette vidéo avec /diffuser."
      );
      return;
    }

    const ids = await utilisateurs();

    if (!ids.length) {
      await dire(
        chatId,
        "Aucun abonné aux annonces."
      );
      return;
    }

    const method = photo
      ? "sendPhoto"
      : "sendVideo";

    const media = {
      ...(photo
        ? {
            photo:
              source.photo[
                source.photo.length - 1
              ].file_id
          }
        : {
            video: source.video.file_id,
            supports_streaming: true
          }),
      caption: source.caption || "",
      caption_entities:
        source.caption_entities || []
    };

    await telegram(method, {
      chat_id: chatId,
      ...media
    });

    const code = crypto.randomBytes(3)
      .toString("hex");

    brouillon = {
      ids,
      method,
      media,
      code,
      expires: Date.now() + 10 * 60 * 1000
    };

    await dire(
      chatId,
      `Aperçu ci-dessus ✅
Destinataires : ${ids.length}

Pour envoyer :
/confirmer ${code}

Pour annuler : /annuler

L'aperçu expire dans 10 minutes.`
    );
    return;
  }

  if (command === "confirmer") {
    const code = text.trim().split(/\s+/)[1];

    if (diffusionEnCours) {
      await dire(
        chatId,
        "Une diffusion est déjà en cours."
      );
      return;
    }

    if (
      !brouillon ||
      brouillon.expires < Date.now() ||
      code !== brouillon.code
    ) {
      await dire(
        chatId,
        "Confirmation invalide ou aperçu expiré."
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

Utilisateurs enregistrés : 0

Les nouveaux utilisateurs seront enregistrés à leur prochain /start ou clic sur Accueil.`
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
      `🏥 DOCTOR PHARMA 33 — COMMANDES

/start : enregistrer et afficher l'accueil
/stats : fiche complète des utilisateurs
/ecrire : préparer un message texte
/ouverture : préparer le message d'ouverture
/fermeture : préparer le message de fermeture
/diffuser : diffuser une vidéo
/diffuserphoto : diffuser une photo
/confirmer CODE : confirmer une action
/annuler : annuler un brouillon
/reinitialiser : vider la liste
/monid : afficher ton identifiant

Commandes utilisateurs :
/annonces : recevoir les annonces
/stop : arrêter les annonces`
    );
  }
}

app.get("/", (_req, res) => {
  res.send("Serveur Doctor Pharma 33 actif ✅");
});

app.post("/webhook", (req, res) => {
  const secret =
    req.get(
      "X-Telegram-Bot-Api-Secret-Token"
    ) || "";

  const received = Buffer.from(secret);
  const expected = Buffer.from(WEBHOOK_SECRET);

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(
      received,
      expected
    )
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
    updatesVus.delete(
      updatesVus.values().next().value
    );
  }

  res.sendStatus(200);

  const message = req.body.message;

  if (
    message?.chat?.type === "private" &&
    /^\/stop(?:@\w+)?(?:\s|$)/i.test(
      message.text || ""
    )
  ) {
    optOut.add(String(message.chat.id));
  }

  fileMessages = fileMessages
    .then(() => traiter(message))
    .catch(error => {
      console.error(
        "Erreur traitement :",
        error.message
      );

      if (
        String(message?.from?.id) === ADMIN_ID
      ) {
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
  if (
    !TOKEN ||
    !SUPABASE_URL ||
    !SUPABASE_SECRET_KEY
  ) {
    throw new Error(
      "Configure BOT_TOKEN, SUPABASE_URL et SUPABASE_SECRET_KEY dans Render."
    );
  }

  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(
      SUPABASE_URL
    )
  ) {
    throw new Error(
      "SUPABASE_URL doit être une adresse Supabase valide."
    );
  }

  if (
    !SUPABASE_SECRET_KEY.startsWith(
      "sb_secret_"
    )
  ) {
    throw new Error(
      "SUPABASE_SECRET_KEY doit commencer par sb_secret_."
    );
  }

  app.listen(
    process.env.PORT || 3000,
    async () => {
      console.log("Serveur démarré ✅");

      try {
        const me = await telegram("getMe", {});

        console.log(
          `Bot connecté : @${me.username}`
        );

        await configurerWebhook();

        console.log(
          "Webhook configuré ✅"
        );
      } catch (error) {
        console.error(
          "Configuration Telegram :",
          error.message
        );

        process.exit(1);
      }

      try {
        await db(
          "bot_users?select=chat_id&limit=1"
        );

        console.log(
          "Supabase connecté ✅"
        );
      } catch (error) {
        console.error(
          "Erreur Supabase :",
          error.message
        );
      }
    }
  );
}

module.exports = {
  app,
  traiter,
  utilisateurs,
  telegram,
  db,
  WEBHOOK_SECRET
};
