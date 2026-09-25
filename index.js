const express = require("express");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;

// Lien de ton groupe / discussion Telegram
const GROUP_URL = "https://t.me/+MIB2qImNuyQ00";

// Adresse publique de ton service Render
const RENDER_URL = "https://doctor-pharma-bot-iyki.onrender.com";


/* =========================
   PAGE D'ACCUEIL RENDER
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

      const texte = `Bienvenue chez Doctor Pharma 33 👋

Livraison 🚚 ✅

Meet-up 📍✅ 13h/22h

Cadeaux de lancement 🚀

Un paquet de feuille + 1g de ginius farmz offert

Vous pouvez aussi nous contacter directement via notre canal.

Canal avis client :

🔗 https://tato.im/doctoravis33.`;

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

                [
                  {
                    text: "📱 TEST 1",
                    url: "https://example.com/1"
                  },
                  {
                    text: "📱 TEST 2",
                    url: "https://example.com/2"
                  }
                ],

                [
                  {
                    text: "📱 TEST 3",
                    url: "https://example.com/3"
                  },
                  {
                    text: "📱 TEST 4",
                    url: "https://example.com/4"
                  }
                ],

                [
                  {
                    text: "💬 Discussion",
                    url: GROUP_URL
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

    const webhookUrl =
      `${RENDER_URL}/webhook`;

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

    const result =
      await response.json();

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

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `Bot démarré sur le port ${PORT} ✅`
  );

});
