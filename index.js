const express = require("express");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const GROUP_URL = "https://t.me/+MIB2qImNuyQ0OWY0";

app.get("/", (req, res) => {
  res.send("Bot Telegram actif ✅");
});

app.post("/webhook", async (req, res) => {
  const update = req.body;

  try {
    const message = update.message;

    if (message && message.text === "/start") {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: message.chat.id,
          text: "Bienvenue 👋\n\nRejoins notre espace de discussion avec le bouton ci-dessous.",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "💬 Discussion",
                  url: GROUP_URL
                }
              ]
            ]
          }
        })
      });
    }
  } catch (error) {
    console.error(error);
  }

  res.sendStatus(200);
});
app.get("/setup-webhook", async (req, res) => {
  try {
    const webhookUrl =
      "https://doctor-pharma-bot-iyki.onrender.com/webhook";

    const response = await fetch(
      `https://api.telegram.org/bot${TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl })
      }
    );

    const result = await response.json();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "Erreur configuration webhook"
    });
  }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot démarré sur le port ${PORT}`);
});
