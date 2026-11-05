
"use strict";

const express = require("express");
const crypto = require("node:crypto");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// ==========================================
// CONFIGURATION DOCTOR PHARMA 33
// ==========================================

const BOT_TOKEN = (process.env.BOT_TOKEN || "").trim();
const ADMIN_ID = String(process.env.ADMIN_ID || "").trim();

const SUPABASE_URL = (process.env.SUPABASE_URL || "")
  .trim().replace(/\/$/, "");

const SUPABASE_KEY = (
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ""
).trim();

const BASE_URL = (process.env.BASE_URL || "")
  .trim().replace(/\/$/, "");

const MINI_APP_URL = (
  process.env.MINI_APP_URL ||
  "https://layer-aligner.lovable.app"
).trim().replace(/\/$/, "");

const ENCRYPTION_KEY = (
  process.env.MESSAGE_ENCRYPTION_KEY || ""
).trim();

const PORT = Number(process.env.PORT || 3000);
const BOT_USERNAME = "Doctorp33bot";

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// DIAGNOSTIC RENDER AMÉLIORÉ
// ==========================================

const checks = {
  BOT_TOKEN: Boolean(BOT_TOKEN),
  ADMIN_ID: /^\d+$/.test(ADMIN_ID),
  SUPABASE_URL: Boolean(SUPABASE_URL),
  SUPABASE_SECRET_KEY: Boolean(SUPABASE_KEY),
  BASE_URL: Boolean(BASE_URL),
  MESSAGE_ENCRYPTION_KEY:
    /^[a-f0-9]{64}$/i.test(ENCRYPTION_KEY)
};

const missing = Object.entries(checks)
  .filter(([, valid]) => !valid)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(
    "Variables Render absentes ou invalides :",
    missing.join(", ")
  );
  process.exit(1);
}

const TG_API =
  `https://api.telegram.org/bot${BOT_TOKEN}`;

const AES_KEY = Buffer.from(
  ENCRYPTION_KEY, "hex"
);

const WEBHOOK_SECRET = crypto
  .createHmac("sha256", BOT_TOKEN)
  .update("doctor-p33-webhook-v4")
  .digest("hex");

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));

  return x.length === y.length &&
    crypto.timingSafeEqual(x, y);
}

function validUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(String(id));
}

function apiError(res, error, status = 500) {
  console.error(error);

  res.status(status).json({
    ok: false,
    error: status === 500
      ? "Erreur interne du serveur"
      : String(error.message || error)
  });
}

// ==========================================
// CHIFFREMENT AES-256-GCM
// ==========================================

function encrypt(value) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    AES_KEY,
    iv
  );

  const content = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final()
  ]);

  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    content.toString("hex")
  ].join(".");
}

function decrypt(value) {
  const [iv, tag, content] = String(value).split(".");

  if (!iv || !tag || !content) {
    throw new Error("Brouillon chiffré invalide");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    AES_KEY,
    Buffer.from(iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(tag, "hex"));

  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(content, "hex")),
      decipher.final()
    ]).toString("utf8")
  );
}

// ==========================================
// TELEGRAM API
// ==========================================

async function telegram(method, body = {}) {
  const response = await fetch(
    `${TG_API}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const result = await response.json();

  if (!result.ok) {
    const error = new Error(
      result.description || "Erreur Telegram"
    );

    error.code = result.error_code;
    error.retryAfter =
      result.parameters?.retry_after || 0;

    throw error;
  }

  return result.result;
}

// ==========================================
// SUPABASE
// ==========================================

async function db(
  table,
  method = "GET",
  body = null,
  query = "",
  prefer = "return=representation"
) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}${query}`,
    {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: prefer
      },
      body: body === null
        ? undefined
        : JSON.stringify(body)
    }
  );

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase ${response.status}: ${raw}`
    );
  }

  return raw ? JSON.parse(raw) : [];
}

async function rpc(name, params = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(params)
    }
  );

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `RPC ${name}: ${response.status} ${raw}`
    );
  }

  return raw ? JSON.parse(raw) : null;
}

// ==========================================
// AUTHENTIFICATION TELEGRAM
// ==========================================

function verifyInitData(initData) {
  if (
    typeof initData !== "string" ||
    !initData ||
    initData.length > 8192
  ) {
    return null;
  }

  try {
    const params = new URLSearchParams(initData);

    const hash = params.get("hash");
    if (!hash) return null;

    params.delete("hash");
    params.delete("signature");

    const checkString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secret = crypto
      .createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();

    const calculated = crypto
      .createHmac("sha256", secret)
      .update(checkString)
      .digest("hex");

    if (!safeEqual(hash, calculated)) {
      return null;
    }

    const authDate = Number(
      params.get("auth_date")
    );

    const now = Math.floor(Date.now() / 1000);

    if (
      !Number.isFinite(authDate) ||
      authDate > now + 60 ||
      now - authDate > 3600
    ) {
      return null;
    }

    const user = JSON.parse(
      params.get("user") || "{}"
    );

    if (String(user.id) !== ADMIN_ID) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

function adminAuth(req, res, next) {
  const user = verifyInitData(
    req.get("X-Telegram-Init-Data")
  );

  if (!user) {
    return res.status(403).json({
      ok: false,
      error: "Accès administrateur refusé"
    });
  }

  req.admin = user;
  next();
}

// ==========================================
// CORS ADMINISTRATION LOVABLE
// ==========================================

app.use("/api/admin", (req, res, next) => {
  const allowed = new URL(MINI_APP_URL).origin;
  const origin = req.get("Origin");

  if (origin === allowed) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      allowed
    );

    res.setHeader("Vary", "Origin");

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Telegram-Init-Data"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS"
    );
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(
      origin === allowed ? 204 : 403
    );
  }

  next();
});

// ==========================================
// UTILISATEURS ET ABONNEMENTS
// ==========================================

async function registerUser(user) {
  const id = String(user.id);

  const existing = await db(
    "bot_users",
    "GET",
    null,
    `?telegram_id=eq.${id}&select=telegram_id`
  );

  if (!existing.length) {
    await db("bot_users", "POST", {
      telegram_id: id,
      first_name: user.first_name || "",
      username: user.username || "",
      subscribed: false,
      blocked: false
    });

    return;
  }

  await db(
    "bot_users",
    "PATCH",
    {
      first_name: user.first_name || "",
      username: user.username || "",
      blocked: false,
      updated_at: new Date().toISOString()
    },
    `?telegram_id=eq.${id}`
  );
}

async function setSubscription(id, subscribed) {
  await db(
    "bot_users",
    "PATCH",
    {
      subscribed,
      blocked: false,
      updated_at: new Date().toISOString()
    },
    `?telegram_id=eq.${id}`
  );
}

// ==========================================
// ACCUEIL DOCTOR PHARMA 33
// ==========================================

const welcomeText =
  "<b>Bienvenue chez Doctor Pharma 33 👋🇫🇷</b>\n" +
  "⭐️ Saison 2026-2027 ⭐️\n\n" +
  "Les références du Doctor sont enfin " +
  "disponibles sur Telegram ! 🔥\n\n" +
  "👇 Découvrez notre boutique.";

const welcomeButtons = {
  inline_keyboard: [
    [{
      text: "🛍️ Ouvrir la boutique",
      web_app: {
        url: MINI_APP_URL
      }
    }],
    [{
      text: "🔔 Recevoir les annonces",
      callback_data: "subscribe"
    }],
    [{
      text: "🔕 Se désabonner",
      callback_data: "unsubscribe"
    }]
  ]
};

const homeKeyboard = {
  keyboard: [[{
    text: "🏠 Accueil"
  }]],
  resize_keyboard: true,
  is_persistent: true
};

async function sendWelcome(chatId) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text: welcomeText,
    parse_mode: "HTML",
    reply_markup: welcomeButtons
  });

  await telegram("sendMessage", {
    chat_id: chatId,
    text: "🏠 Menu principal",
    reply_markup: homeKeyboard
  });
}

// ==========================================
// WEBHOOK TELEGRAM
// ==========================================

app.post("/telegram/webhook", async (req, res) => {
  const secret = req.get(
    "X-Telegram-Bot-Api-Secret-Token"
  );

  if (!secret || !safeEqual(secret, WEBHOOK_SECRET)) {
    return res.sendStatus(403);
  }

  const update = req.body;

  try {
    const claimed = await rpc(
      "claim_telegram_update",
      { p_update_id: update.update_id }
    );

    if (!claimed) {
      return res.sendStatus(200);
    }

    const message = update.message;

    if (
      message?.from &&
      message.chat?.type === "private"
    ) {
      const text = (message.text || "").trim();
      const chatId = message.chat.id;

      if (
        text === "/start" ||
        text === "🏠 Accueil"
      ) {
        await registerUser(message.from);
        await sendWelcome(chatId);
      }

      if (text === "/admin") {
        if (
          String(message.from.id) !== ADMIN_ID
        ) {
          await telegram("sendMessage", {
            chat_id: chatId,
            text: "⛔ Accès administrateur refusé."
          });
        } else {
          await telegram("sendMessage", {
            chat_id: chatId,
            text: "🔐 Administration Doctor Pharma 33",
            reply_markup: {
              inline_keyboard: [[{
                text: "⚙️ Administration",
                web_app: {
                  url: `${MINI_APP_URL}/admin`
                }
              }]]
            }
          });
        }
      }
    }

    const callback = update.callback_query;

    if (
      callback &&
      ["subscribe", "unsubscribe"].includes(
        callback.data
      ) &&
      callback.message?.chat?.type === "private"
    ) {
      await registerUser(callback.from);

      const subscribed =
        callback.data === "subscribe";

      await setSubscription(
        callback.from.id,
        subscribed
      );

      await telegram("answerCallbackQuery", {
        callback_query_id: callback.id,
        text: subscribed
          ? "Annonces activées ✅"
          : "Annonces désactivées ✅",
        show_alert: true
      });
    }

    await rpc("complete_telegram_update", {
      p_update_id: update.update_id
    });

    return res.sendStatus(200);
  } catch (error) {
    console.error("Webhook:", error);

    return res.sendStatus(500);
  }
});

// ==========================================
// SANTÉ DU BOT
// ==========================================

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    bot: BOT_USERNAME,
    uptime: Math.floor(process.uptime())
  });
});

app.post(
  "/api/admin/verify",
  adminAuth,
  (req, res) => {
    res.json({
      ok: true,
      admin: true,
      user: {
        id: req.admin.id,
        first_name: req.admin.first_name
      }
    });
  }
);

app.post(
  "/api/admin/session",
  adminAuth,
  (req, res) => {
    res.json({
      ok: true,
      admin: true,
      user: {
        id: req.admin.id,
        first_name: req.admin.first_name
      }
    });
  }
);

app.get(
  "/api/admin/health",
  adminAuth,
  async (req, res) => {
    try {
      const [bot, webhook, users] =
        await Promise.all([
          telegram("getMe"),
          telegram("getWebhookInfo"),
          db(
            "bot_users",
            "GET",
            null,
            "?select=telegram_id,subscribed,blocked"
          )
        ]);

      res.json({
        ok: true,
        bot: {
          username: bot.username,
          active: true
        },
        webhook: {
          configured: Boolean(webhook.url),
          pending: webhook.pending_update_count,
          last_error:
            webhook.last_error_message || null
        },
        supabase: "connected",
        users: {
          total: users.length,
          subscribed: users.filter(
            u => u.subscribed && !u.blocked
          ).length,
          blocked: users.filter(
            u => u.blocked
          ).length
        },
        uptime: Math.floor(process.uptime())
      });
    } catch (error) {
      apiError(res, error);
    }
  }
);

app.get(
  "/api/admin/stats",
  adminAuth,
  async (req, res) => {
    try {
      const users = await db(
        "bot_users",
        "GET",
        null,
        "?select=telegram_id,first_name,username,subscribed,blocked&limit=1000"
      );

      res.json({
        ok: true,
        users,
        total_returned: users.length
      });
    } catch (error) {
      apiError(res, error);
    }
  }
);

// ==========================================
// VALIDATION DES MESSAGES ET BOUTONS
// ==========================================

function validateDraft(input) {
  const text = String(
    input.text || ""
  ).trim();

  if (!text || text.length > 4096) {
    throw new Error(
      "Le message doit contenir 1 à 4096 caractères"
    );
  }

  const suppliedButtons = input.buttons || [];

  if (
    !Array.isArray(suppliedButtons) ||
    suppliedButtons.length > 4
  ) {
    throw new Error(
      "Maximum quatre boutons autorisés"
    );
  }

  const buttons = suppliedButtons.map(button => {
    const label = String(
      button.label || button.text || ""
    ).trim();

    const url = String(
      button.url || ""
    ).trim();

    if (!label || label.length > 64) {
      throw new Error(
        "Nom de bouton invalide (1 à 64 caractères)"
      );
    }

    let parsed;

    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Lien invalide");
    }

    if (
      !["https:", "http:"].includes(
        parsed.protocol
      )
    ) {
      throw new Error(
        "Lien HTTP ou HTTPS obligatoire"
      );
    }

    return { label, url };
  });

  return { text, buttons };
}

function telegramButtons(buttons) {
  if (!buttons?.length) {
    return undefined;
  }

  return {
    inline_keyboard: buttons.map(button => [{
      text: button.label,
      url: button.url
    }])
  };
}

// ==========================================
// CRÉER UN BROUILLON
// ==========================================

app.post(
  "/api/admin/messages",
  adminAuth,
  async (req, res) => {
    try {
      const draft = validateDraft(req.body);

      const rows = await db(
        "message_drafts",
        "POST",
        {
          encrypted_content: encrypt(draft),
          status: "draft",
          created_by: ADMIN_ID
        }
      );

      res.json({
        ok: true,
        message: {
          id: rows[0].id,
          ...draft,
          status: "draft"
        }
      });
    } catch (error) {
      apiError(res, error, 400);
    }
  }
);

// ==========================================
// LISTER LES BROUILLONS
// ==========================================

app.get(
  "/api/admin/messages",
  adminAuth,
  async (req, res) => {
    try {
      const rows = await db(
        "message_drafts",
        "GET",
        null,
        "?select=*&order=created_at.desc&limit=100"
      );

      const messages = rows.map(row => ({
        id: row.id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        ...decrypt(row.encrypted_content)
      }));

      res.json({
        ok: true,
        messages
      });
    } catch (error) {
      apiError(res, error);
    }
  }
);

// ==========================================
// MODIFIER UN BROUILLON
// ==========================================

app.patch(
  "/api/admin/messages/:id",
  adminAuth,
  async (req, res) => {
    try {
      const id = req.params.id;

      if (!validUUID(id)) {
        return apiError(
          res,
          new Error("ID invalide"),
          400
        );
      }

      const draft = validateDraft(req.body);

      const rows = await db(
        "message_drafts",
        "PATCH",
        {
          encrypted_content: encrypt(draft),
          updated_at: new Date().toISOString()
        },
        `?id=eq.${id}&status=eq.draft`
      );

      if (!rows.length) {
        return apiError(
          res,
          new Error("Brouillon non modifiable"),
          409
        );
      }

      res.json({
        ok: true,
        message: {
          id,
          ...draft,
          status: "draft"
        }
      });
    } catch (error) {
      apiError(res, error, 400);
    }
  }
);

// ==========================================
// SUPPRIMER UN BROUILLON
// ==========================================

app.delete(
  "/api/admin/messages/:id",
  adminAuth,
  async (req, res) => {
    try {
      const id = req.params.id;

      if (!validUUID(id)) {
        return apiError(
          res,
          new Error("ID invalide"),
          400
        );
      }

      const rows = await db(
        "message_drafts",
        "DELETE",
        null,
        `?id=eq.${id}&status=eq.draft`
      );

      if (!rows.length) {
        return apiError(
          res,
          new Error("Brouillon non supprimable"),
          409
        );
      }

      res.json({ ok: true });
    } catch (error) {
      apiError(res, error);
    }
  }
);

// ==========================================
// DÉCLENCHER L'ENVOI MANUEL
// ==========================================

app.post(
  "/api/admin/messages/:id/send",
  adminAuth,
  async (req, res) => {
    try {
      const id = req.params.id;

      if (!validUUID(id)) {
        return apiError(
          res,
          new Error("ID invalide"),
          400
        );
      }

      if (req.body?.confirm !== true) {
        return apiError(
          res,
          new Error(
            "Confirmation explicite obligatoire"
          ),
          400
        );
      }

      const result = await rpc(
        "start_manual_broadcast",
        { p_message_id: id }
      );

      if (!result?.ok) {
        return apiError(
          res,
          new Error(
            result?.error || "Envoi impossible"
          ),
          409
        );
      }

      res.json({
        ok: true,
        status: "queued",
        broadcast_id: result.broadcast_id,
        recipients: result.recipients,
        message:
          "Diffusion manuelle enregistrée"
      });
    } catch (error) {
      apiError(res, error);
    }
  }
);

// ==========================================
// HISTORIQUE DES DIFFUSIONS
// ==========================================

app.get(
  "/api/admin/broadcasts",
  adminAuth,
  async (req, res) => {
    try {
      const rows = await db(
        "broadcasts",
        "GET",
        null,
        "?select=*&order=created_at.desc&limit=100"
      );

      res.json({
        ok: true,
        broadcasts: rows
      });
    } catch (error) {
      apiError(res, error);
    }
  }
);

// ==========================================
// FILE D'ENVOI
// ==========================================

let workerBusy = false;

async function processQueue() {
  if (workerBusy) return;

  workerBusy = true;

  try {
    const jobs = await rpc(
      "claim_broadcast_jobs",
      { p_limit: 10 }
    );

    for (const job of jobs || []) {
      try {
        const users = await db(
          "bot_users",
          "GET",
          null,
          `?telegram_id=eq.${job.telegram_id}` +
          "&subscribed=eq.true&blocked=eq.false" +
          "&select=telegram_id"
        );

        if (!users.length) {
          await rpc("finish_broadcast_job", {
            p_job_id: job.id,
            p_status: "skipped",
            p_error: "Non abonné"
          });
          continue;
        }

        const drafts = await db(
          "message_drafts",
          "GET",
          null,
          `?id=eq.${job.message_id}&select=encrypted_content`
        );

        if (!drafts.length) {
          throw new Error("Brouillon introuvable");
        }

        const content = decrypt(
          drafts[0].encrypted_content
        );

        let delivered = false;

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await telegram("sendMessage", {
              chat_id: job.telegram_id,
              text: content.text,
              reply_markup: telegramButtons(
                content.buttons
              )
            });

            delivered = true;
            break;
          } catch (error) {
            if (error.code === 403) {
              await db(
                "bot_users",
                "PATCH",
                {
                  subscribed: false,
                  blocked: true
                },
                `?telegram_id=eq.${job.telegram_id}`
              );

              throw error;
            }

            if (
              error.code === 429 &&
              attempt < 2
            ) {
              await sleep(
                Math.min(
                  Number(error.retryAfter) || 5,
                  60
                ) * 1000
              );

              continue;
            }

            throw error;
          }
        }

        if (delivered) {
          await rpc("finish_broadcast_job", {
            p_job_id: job.id,
            p_status: "sent",
            p_error: null
          });
        }
      } catch (error) {
        console.error(
          "Erreur diffusion:",
          error.message
        );

        await rpc(
          "finish_broadcast_job",
          {
            p_job_id: job.id,
            p_status: "failed",
            p_error: String(
              error.message
            ).slice(0, 300)
          }
        ).catch(console.error);
      }

      await sleep(100);
    }
  } catch (error) {
    console.error(
      "Erreur worker:",
      error.message
    );
  } finally {
    workerBusy = false;
  }
}

// ==========================================
// DÉMARRAGE DU BOT
// ==========================================

async function start() {
  const me = await telegram("getMe");

  if (
    me.username?.toLowerCase() !==
    BOT_USERNAME.toLowerCase()
  ) {
    throw new Error(
      `Token incorrect : @${me.username}`
    );
  }

  await telegram("setWebhook", {
    url: `${BASE_URL}/telegram/webhook`,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: [
      "message",
      "callback_query"
    ]
  });

  app.listen(PORT, () => {
    console.log(
      `Doctor Pharma 33 actif sur ${PORT}`
    );

    console.log(
      `Bot connecté : @${me.username}`
    );
  });

  setInterval(processQueue, 5000);
  processQueue();
}

start().catch(error => {
  console.error(
    "Démarrage impossible:",
    error
  );

  process.exit(1);
});
