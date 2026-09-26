const express = require("express");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;

// LIENS
const DISCUSSION_URL = "https://t.me/+MIB2qImNuyQ00";
const NEW_CANAL_URL = "https://t.me/+MIB2qImNuyQ0OWY0";
const WHATSAPP_URL = "https://wa.me/33758106388";
const TATO_URL = "https://tato.im/doctorpharma33776";
const AVIS_URL = "https://tato.im/doctoravis33";
const CONTACT_URL = "https://t.me/o_commande33k";

// RENDER
const RENDER_URL = "https://doctor-pharma-bot-iyki.onrender.com";


/* =========================
   PAGE RENDER
========================= */

app.get("/", (req, res) => {
  res.send("Bot Telegram actif ✅");
});


/* =========================
   WEBHOOK TELEGRAM
========================= */

app.post("/webhook", async (req, res) => {

  try {

    const update = req.body;
    const message = update.message;

    if (message && message.text === "/start") {

      const chatId = message.chat.id;

      const texte = `⭐️Bienvenue chez Doctor Pharma 33⭐️

Retrouvez toutes les informations et les différents espaces depuis les boutons ci-dessous.

🚚 Livraison disponible
📍 Meet-up : 13h–22h
🎁 Offre de bienvenue disponible

⭐ Consultez également les avis de nos clients.

📲 Utilisez le menu pour accéder aux différents espaces.

💬 Une question ? Contactez-nous directement.

Un achat=Un paquet de feuille offert🎁

COMMENT PASSER COMMANDE ?

🔐1. Identifiez-vous
Envoyez-nous un message en privé afin de vous identifier et de créer votre mot de passe personnel.

📋2. Accédez au menu
Une fois votre accès activé, vous pourrez accéder à notre menu via le bot.

📨3. Faites votre commande
Sélectionnez vos articles directement sur la mini-application et créez votre bon de commande.

💌4. Envoyez-nous votre bon
Notre contact @o_commande33k`;

      const response = await fetch(
        `https://api.telegram.org/bot${TOKEN}/sendMessage`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({

            chat_id: chatId,
            text: texte,

            reply_markup: {

              inline_keyboard: [

                // TATO TALK
                [
                  {
                    text: "✈️ Tato Talk",
                    url: TATO_URL
                  }
                ],

                // AVIS + DISCUSSION
                [
                  {
                    text: "⭐ Avis",
                    url: AVIS_URL
                  },
                  {
                    text: "💬 Discussion",
                    url: DISCUSSION_URL
                  }
                ],

                // NEW CANAL + WHATSAPP
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

                // CONTACT
                [
                  {
                    text: "📞 Contact",
                    url: CONTACT_URL
                  }
                ]

              ]

            }

          })

        }
      );

      const telegramResult = await response.json();

      if (!telegramResult.ok) {

        console.error(
          "Erreur Telegram :",
          telegramResult
        );

      } else {

        console.log("Message envoyé ✅");

      }

    }

  } catch (error) {

    console.error(
      "Erreur webhook :",
      error
    );

  }

  res.sendStatus(200);

});


/* =========================
   CONFIGURATION WEBHOOK
========================= */

app.get("/setup-webhook", async (req, res) => {

  try {

    if (!TOKEN) {

      return res.status(500).json({
        error: "BOT_TOKEN manquant sur Render"
      });

    }

    const webhookUrl = `${RENDER_URL}/webhook`;

    const response = await fetch(
      `https://api.telegram.org/bot${TOKEN}/setWebhook`,
      {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          url: webhookUrl
        })

      }
    );

    const result = await response.json();

    res.json(result);

  } catch (error) {

    console.error(
      "Erreur configuration webhook :",
      error
    );

    res.status(500).json({
      error: "Erreur configuration webhook"
    });

  }

});


/* =========================
   LANCEMENT SERVEUR
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `Bot démarré sur le port ${PORT} ✅`
  );

});
