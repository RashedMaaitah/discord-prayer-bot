const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");

// Load environment from .env.local when present
try {
  require("dotenv").config({ path: ".env.local" });
} catch (err) {
  throw err;
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID || "1062755334223052931";
const CITY = process.env.CITY || "Amman";
const COUNTRY = process.env.COUNTRY || "Jordan";

if (!DISCORD_TOKEN) {
  console.error(
    "Missing DISCORD_TOKEN. Set it in .env.local or environment variables."
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

let prayerTimes = {};
let notifiedPrayers = new Set();

// Prayer names mapping
const prayerNames = {
  Fajr: "Fajr (Dawn)",
  Dhuhr: "Dhuhr (Noon)",
  Asr: "Asr (Afternoon)",
  Maghrib: "Maghrib (Sunset)",
  Isha: "Isha (Night)",
};

// Fetch prayer times from API
async function fetchPrayerTimes() {
  try {
    const response = await axios.get(
      `http://api.aladhan.com/v1/timingsByCity`,
      {
        params: {
          city: CITY,
          country: COUNTRY,
          method: 2, // Islamic Society of North America method
        },
      }
    );

    if (response.data.code === 200) {
      const timings = response.data.data.timings;
      prayerTimes = {
        Fajr: timings.Fajr,
        Dhuhr: timings.Dhuhr,
        Asr: timings.Asr,
        Maghrib: timings.Maghrib,
        Isha: timings.Isha,
      };

      console.log("Prayer times updated:", prayerTimes);
      return true;
    }
  } catch (error) {
    console.error("Error fetching prayer times:", error.message);
    return false;
  }
}

// Check if it's time for prayer
function checkPrayerTime() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  const currentDate = now.toDateString();

  for (const [prayer, time] of Object.entries(prayerTimes)) {
    const notificationKey = `${currentDate}-${prayer}`;

    // Check if current time matches prayer time and hasn't been notified today
    if (currentTime === time && !notifiedPrayers.has(notificationKey)) {
      sendPrayerNotification(prayer, time);
      notifiedPrayers.add(notificationKey);
    }
  }

  // Clear old notifications at midnight
  if (currentTime === "00:00") {
    const yesterday = new Date(now - 86400000).toDateString();
    notifiedPrayers.forEach((key) => {
      if (key.startsWith(yesterday)) {
        notifiedPrayers.delete(key);
      }
    });
  }
}

// Send prayer notification to Discord channel
async function sendPrayerNotification(prayer, time) {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);

    if (channel) {
      const embed = {
        color: 0x00ae86,
        title: `🕌 ${prayerNames[prayer]} Prayer Time`,
        description: `It's time for **${prayerNames[prayer]}** prayer in ${CITY}, ${COUNTRY}`,
        fields: [
          {
            name: "Time",
            value: time,
            inline: true,
          },
          {
            name: "Prayer",
            value: prayer,
            inline: true,
          },
        ],
        timestamp: new Date(),
        footer: {
          text: "May Allah accept your prayers",
        },
      };

      await channel.send({
        content: "@everyone",
        embeds: [embed],
        allowedMentions: { parse: ["everyone"] },
      });
      console.log(`Sent notification for ${prayer} prayer at ${time}`);
    }
  } catch (error) {
    console.error("Error sending notification:", error.message);
  }
}

// Bot ready event
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Monitoring prayer times for ${CITY}, ${COUNTRY}`);

  // Fetch prayer times initially
  await fetchPrayerTimes();

  // Update prayer times daily at midnight
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      await fetchPrayerTimes();
    }
  }, 60000);

  // Check for prayer times every minute
  setInterval(checkPrayerTime, 60000);

  // Also check immediately
  checkPrayerTime();
});

// Login to Discord
client.login(DISCORD_TOKEN);
