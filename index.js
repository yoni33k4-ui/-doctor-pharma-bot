const express = require("express");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;


// ========================================
// LIENS
// ========================================

const TATO_URL =
  "https://tato.im/doctorpharma33776";

const AVIS_URL =
  "https://tato.im/doctoravis33";

const NEW_CANAL_URL =
  "https://t.me/+MIB2qImNuyQ0OWY0";

const WHATSAPP_URL =
  "https://wa.me/33758106388";

const CONTACT_URL =
  "https://t.me/o_commande33k";

const BOUTIQUE_URL =
  "https://doctor-pharma-shop.lovable.app/";


// ========================================
// PHOTO D'ACCUEIL
// ========================================

const PHOTO_URL =
  "https://raw.githubusercontent.com/yoni33k4-ui/-doctor-pharma-bot/main/78BAC377-E9CB-42CF-9325-92C458896A79.png";


// ========================================
// PAGE TEST RENDER
// ========================================

app.get("/", (req, res) => {

  res.send("Bot Telegram actif ✅");

});


// ========================================
// WEBHOOK TELEGRAM
// ========================================

app.post("/webhook", async (req, res) => {

  const update = req.body;

  try {

    const message = update.message;

    if (message && message.text === "/start") {

      const chatId = message.chat.id;


      // ========================================
      // TEXTE D'ACCUEIL
      // ========================================

      const texte = `⛰️⭐️BIENVENUE CHEZ DOCTOR PHARMA 33⭐️⛰️

🏪La pharmacie bordelaise est enfin disponible sur Telegram ! 🏪🔥

💎 Premium quality : ✅
📞Service Client : Une équipe réactive et à l’écoute ✅

👇 Accède au menu en cliquant sur le bouton boutique 📲

⚠️Important : Appuie sur /start pour actualiser le menu et profiter pleinement des dernières mise à jour de la mini app.`;


      // ========================================
      // BOUTONS
      // ========================================

      const boutons = {

        inline_keyboard: [

          // TATO TALK
          [
            {
              text: "✈️ Tato Talk",
              url: TATO_URL
            }
          ],

          // AVIS + CONTACT
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

          // CANAL + WHATSAPP
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

          // BOUTIQUE
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
      // 1. ENVOI DE LA PHOTO
      // ========================================

      try {

        const photoResponse = await fetch(
          `https://api.telegram.org/bot${TOKEN}/sendPhoto`,
          {

            method: "POST",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify({

              chat_id: chatId,

              photo: PHOTO_URL,

              caption: "⭐️ Doctor Pharma 33 ⭐️"

            })

          }
        );


        const photoResult =
          await photoResponse.json();


        if (!photoResult.ok) {

          console.error(
            "Erreur photo Telegram :",
            photoResult
          );

        } else {

          console.log(
            "Photo envoyée ✅"
          );

        }

      } catch (photoError) {

        console.error(
          "Erreur pendant l'envoi de la photo :",
          photoError
        );

      }


      // ========================================
      // 2. ENVOI DU TEXTE + BOUTONS
      // ========================================

      const messageResponse = await fetch(
        `https://api.telegram.org/bot${TOKEN}/sendMessage`,
        {

          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({

            chat_id: chatId,

            text: texte,

            reply_markup: boutons,

            disable_web_page_preview: true

          })

        }
      );


      const messageResult =
        await messageResponse.json();


      if (!messageResult.ok) {

        console.error(
          "Erreur message Telegram :",
          messageResult
        );

      } else {

        console.log(
          "Message + boutons envoyés ✅"
        );

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


// ========================================
// CONFIGURATION WEBHOOK
// ========================================

app.get("/setup-webhook", async (req, res) => {

  try {

    const webhookUrl =
      "https://doctor-pharma-bot-iyki.onrender.com/webhook";


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

    console.error(error);

    res.status(500).json({

      error:
        "Erreur configuration webhook"

    });

  }

});


// ========================================
// DÉMARRAGE SERVEUR
// ========================================

const PORT =
  process.env.PORT || 3000;


app.listen(PORT, () => {

  console.log(
    `Bot démarré sur le port ${PORT}`
  );

});
