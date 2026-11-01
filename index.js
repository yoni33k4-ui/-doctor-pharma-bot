
const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// =====================================
// CONFIGURATION
// =====================================

const TOKEN = (process.env.BOT_TOKEN || "").trim();

const ADMIN_ID = (
  process.env.ADMIN_ID || "8516075351"
).trim();

const BASE_URL = (
  process.env.BASE_URL ||
  "https://doctor-pharma-bot-iyki.onrender.com"
).trim().replace(/\/$/, "");

const BOUTIQUE_URL =
  "https://t.me/Doctor_pharma331bot/Doctorpharma";

const LOVABLE_URL = (
  process.env.BOUTIQUE_URL ||
  "https://layer-aligner.lovable.app"
).trim().replace(/\/$/, "");

const ADMIN_URL = (
  process.env.ADMIN_URL ||
  `${LOVABLE_URL}/admin`
).trim();

const SUPABASE_URL = (
  process.env.SUPABASE_URL || ""
).trim().replace(/\/$/, "");

const SUPABASE_KEY = (
  process.env.SUPABASE_SECRET_KEY || ""
).trim();

const PHOTO_NAME =
  "3168703F-5AD2-4B96-A901-3E86B0355FF8.png";

const PHOTO_PATH = path.join(
  __dirname,
  PHOTO_NAME
);

const PORT = Number(
  process.env.PORT || 3000
);

const SESSION_SECRET = (
  process.env.ADMIN_SESSION_SECRET || ""
).trim();

if (!TOKEN) {
  throw new Error(
    "BOT_TOKEN manquant dans Render"
  );
}

if (
  !SESSION_SECRET ||
  SESSION_SECRET.length < 32
) {
  throw new Error(
    "ADMIN_SESSION_SECRET manquant : minimum 32 caractères"
  );
}

if (
  !ADMIN_URL.startsWith("https://") ||
  !LOVABLE_URL.startsWith("https://")
) {
  throw new Error(
    "Les URLs Lovable doivent utiliser HTTPS"
  );
}

const WEBHOOK_SECRET = crypto
  .createHmac("sha256", TOKEN)
  .update("doctor-pharma-webhook-v2")
  .digest("hex");

// =====================================
// CORS LOVABLE
// =====================================

const allowedOrigins = new Set();

for (const url of [
  LOVABLE_URL,
  ADMIN_URL,
  process.env.ADMIN_FRONTEND_ORIGIN
]) {
  if (!url) continue;

  try {
    allowedOrigins.add(
      new URL(url).origin
    );
  } catch {
    console.error(
      "Origine CORS invalide"
    );
  }
}

app.use("/api/admin", (req, res, next) => {
  const origin = req.get("origin");

  if (
    origin &&
    allowedOrigins.has(origin)
  ) {
    res.set(
      "Access-Control-Allow-Origin",
      origin
    );

    res.set("Vary", "Origin");

    res.set(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS"
    );

    res.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    res.set(
      "Access-Control-Max-Age",
      "600"
    );
  }

  res.set(
    "Cache-Control",
    "no-store"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(
      origin &&
      allowedOrigins.has(origin)
        ? 204
        : 403
    );
  }

  if (
    origin &&
    !allowedOrigins.has(origin)
  ) {
    return res.sendStatus(403);
  }

  next();
});

// =====================================
// TELEGRAM API
// =====================================

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

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      `${method}: ${
        result.description ||
        response.status
      }`
    );
  }

  return result.result;
}

// =====================================
// BARRE GRISE ACCUEIL
// =====================================

const CLAVIER_ACCUEIL = {
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

// =====================================
// MESSAGE DE BIENVENUE
// =====================================

const BIENVENUE = `
<b>Bienvenue chez Doctor Pharma 33 👋🇫🇷</b>

⭐️ <b>DOCTOR PHARMA 33</b> ⭐️
🏥 Saison 2026-2027

🔥 Les références du Doctor sont enfin disponibles sur Telegram !

🛍️ Clique sur le bouton Boutique pour découvrir notre catalogue.

🏠 Utilise le bouton Accueil pour revenir au menu.
`.trim();

// =====================================
// LES QUATRE BOUTONS
// =====================================

const BOUTONS = {
  inline_keyboard: [
    [
      {
        text: "🛍️ OUVRIR LA BOUTIQUE",
        url: BOUTIQUE_URL
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
    ],
    [
      {
        text: "💬 TATO TALK",
        url: "https://tato.im/doctorpharma33776"
      }
    ]
  ]
};

// =====================================
// ENREGISTREMENT SUPABASE
// =====================================

async function enregistrerUtilisateur(user) {
  if (
    !user ||
    !SUPABASE_URL ||
    !SUPABASE_KEY
  ) {
    return;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/bot_users?on_conflict=telegram_id`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization:
            `Bearer ${SUPABASE_KEY}`,
          "Content-Type":
            "application/json",
          Prefer:
            "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          telegram_id:
            String(user.id),
          first_name:
            user.first_name || "",
          username:
            user.username || null,
          last_seen:
            new Date().toISOString()
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
  } catch (error) {
    console.error(
      "Supabase indisponible:",
      error.message
    );
  }
}

// =====================================
// ENVOYER MESSAGE
// =====================================

async function envoyerMessage(
  chatId,
  text,
  markup
) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(markup
      ? { reply_markup: markup }
      : {})
  });
}

// =====================================
// AFFICHER ACCUEIL
// =====================================

async function afficherAccueil(
  chatId,
  user
) {
  await enregistrerUtilisateur(user);

  // Conserver la barre grise.
  await envoyerMessage(
    chatId,
    "🏠 Accueil",
    CLAVIER_ACCUEIL
  );

  // Envoyer la photo et les boutons.
  if (fs.existsSync(PHOTO_PATH)) {
    const form = new FormData();

    form.append(
      "chat_id",
      String(chatId)
    );

    form.append(
      "caption",
      BIENVENUE
    );

    form.append(
      "parse_mode",
      "HTML"
    );

    form.append(
      "reply_markup",
      JSON.stringify(BOUTONS)
    );

    form.append(
      "photo",
      new Blob([
        fs.readFileSync(PHOTO_PATH)
      ]),
      PHOTO_NAME
    );

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${TOKEN}/sendPhoto`,
        {
          method: "POST",
          body: form
        }
      );

      const result =
        await response.json();

      if (result.ok) {
        return;
      }

      console.error(
        "Erreur photo:",
        result.description
      );
    } catch (error) {
      console.error(
        "Erreur photo:",
        error.message
      );
    }
  }

  // Secours si la photo échoue.
  await envoyerMessage(
    chatId,
    BIENVENUE,
    BOUTONS
  );
}

// =====================================
// COMMANDE /admin
// =====================================

async function afficherAdmin(
  chatId,
  userId
) {
  if (
    String(userId) !== ADMIN_ID
  ) {
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
            text:
              "🔐 OUVRIR L'ADMINISTRATION",
            web_app: {
              url: ADMIN_URL
            }
          }
        ]
      ]
    }
  );
}

// =====================================
// AUTHENTIFICATION TELEGRAM
// =====================================

function verifierInitData(initData) {
  if (
    typeof initData !== "string" ||
    initData.length > 8192
  ) {
    return null;
  }

  const params =
    new URLSearchParams(initData);

  const hash = params.get("hash");

  const authDate = Number(
    params.get("auth_date")
  );

  if (
    !hash ||
    !/^[a-f0-9]{64}$/i.test(hash) ||
    !Number.isSafeInteger(authDate)
  ) {
    return null;
  }

  const age =
    Math.floor(Date.now() / 1000) -
    authDate;

  if (
    age < 0 ||
    age > 3600
  ) {
    return null;
  }

  const check = [
    ...params.entries()
  ]
    .filter(
      ([key]) => key !== "hash"
    )
    .sort(
      ([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0
    )
    .map(
      ([key, value]) =>
        `${key}=${value}`
    )
    .join("\n");

  const key = crypto
    .createHmac(
      "sha256",
      "WebAppData"
    )
    .update(TOKEN)
    .digest();

  const expected = crypto
    .createHmac(
      "sha256",
      key
    )
    .update(check)
    .digest();

  const received =
    Buffer.from(hash, "hex");

  if (
    received.length !==
      expected.length ||
    !crypto.timingSafeEqual(
      received,
      expected
    )
  ) {
    return null;
  }

  try {
    const user = JSON.parse(
      params.get("user") || "null"
    );

    if (
      user &&
      String(user.id) === ADMIN_ID
    ) {
      return user;
    }

    return null;
  } catch {
    return null;
  }
}

// =====================================
// SESSIONS ADMINISTRATEUR
// =====================================

const SESSION_LIFETIME_SECONDS =
  1800;

function signSession(payload) {
  const body = Buffer
    .from(
      JSON.stringify(payload)
    )
    .toString("base64url");

  const signature = crypto
    .createHmac(
      "sha256",
      SESSION_SECRET
    )
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

function readSession(token) {
  if (
    typeof token !== "string" ||
    token.length > 2048
  ) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [body, signature] = parts;

  const expected = crypto
    .createHmac(
      "sha256",
      SESSION_SECRET
    )
    .update(body)
    .digest();

  let received;

  try {
    received = Buffer.from(
      signature,
      "base64url"
    );
  } catch {
    return null;
  }

  if (
    received.length !==
      expected.length ||
    !crypto.timingSafeEqual(
      received,
      expected
    )
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(
        body,
        "base64url"
      ).toString("utf8")
    );

    if (
      data.sub !== ADMIN_ID ||
      !Number.isSafeInteger(data.exp) ||
      data.exp <=
        Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

// =====================================
// PROTECTION DES API ADMIN
// =====================================

function requireAdmin(
  req,
  res,
  next
) {
  const match =
    /^Bearer (.+)$/.exec(
      req.get("authorization") || ""
    );

  const session = match
    ? readSession(match[1])
    : null;

  if (!session) {
    return res.status(401).json({
      authorized: false,
      error: "unauthorized"
    });
  }

  req.admin = session;
  next();
}

// =====================================
// API VERIFICATION ADMIN
// =====================================

app.post(
  "/api/admin/verify",
  (req, res) => {
    const user = verifierInitData(
      req.body?.initData
    );

    if (!user) {
      return res.status(403).json({
        authorized: false
      });
    }

    const expiresAt =
      Math.floor(Date.now() / 1000) +
      SESSION_LIFETIME_SECONDS;

    return res.json({
      authorized: true,
      user_id: String(user.id),
      session_token: signSession({
        sub: String(user.id),
        exp: expiresAt
      }),
      expires_at: expiresAt
    });
  }
);

// =====================================
// API SESSION ADMIN
// =====================================

app.get(
  "/api/admin/session",
  requireAdmin,
  (req, res) => {
    return res.json({
      authorized: true,
      user_id: req.admin.sub,
      expires_at: req.admin.exp
    });
  }
);

// Toutes les futures API sensibles
// devront utiliser requireAdmin.

// =====================================
// WEBHOOK TELEGRAM
// =====================================

app.post(
  "/telegram-webhook",
  async (req, res) => {
    const receivedSecret =
      req.get(
        "x-telegram-bot-api-secret-token"
      );

    if (
      receivedSecret !==
      WEBHOOK_SECRET
    ) {
      return res.sendStatus(403);
    }

    res.sendStatus(200);

    try {
      const message =
        req.body?.message;

      if (
        !message?.from ||
        message.chat?.type !==
          "private"
      ) {
        return;
      }

      const chatId =
        message.chat.id;

      const userId =
        message.from.id;

      const text = (
        message.text || ""
      ).trim();

      // /start
      if (
        /^\/start(?:@\w+)?(?:\s|$)/i.test(
          text
        )
      ) {
        await afficherAccueil(
          chatId,
          message.from
        );
        return;
      }

      // /admin
      if (
        /^\/admin(?:@\w+)?$/i.test(
          text
        )
      ) {
        await afficherAdmin(
          chatId,
          userId
        );
        return;
      }

      // Barre grise Accueil
      if (
        text === "🏠 Accueil" ||
        text === "Accueil"
      ) {
        await afficherAccueil(
          chatId,
          message.from
        );
        return;
      }

      // Les anciennes commandes
      // ne sont plus utilisées.
    } catch (error) {
      console.error(
        "Erreur webhook:",
        error.message
      );
    }
  }
);

// =====================================
// SANTE DU SERVEUR
// =====================================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    bot: "Doctor Pharma 33",
    commands: [
      "/start",
      "/admin"
    ]
  });
});

// =====================================
// DEMARRAGE
// =====================================

app.listen(
  PORT,
  async () => {
    console.log(
      `Doctor Pharma 33 actif sur ${PORT}`
    );

    try {
      await telegram(
        "setWebhook",
        {
          url:
            `${BASE_URL}/telegram-webhook`,
          secret_token:
            WEBHOOK_SECRET,
          allowed_updates: [
            "message"
          ],
          drop_pending_updates:
            false
        }
      );

      await telegram(
        "setMyCommands",
        {
          commands: [
            {
              command: "start",
              description:
                "🏠 Accueil"
            },
            {
              command: "admin",
              description:
                "🔐 Administration"
            }
          ]
        }
      );

      console.log(
        "Webhook et commandes configurés"
      );
    } catch (error) {
      console.error(
        "Erreur démarrage:",
        error.message
      );
    }
  }
);
