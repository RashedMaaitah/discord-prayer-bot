const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js");
const axios = require("axios");

// Load environment from .env.local when present
try {
  require("dotenv").config({ path: ".env.local" });
} catch (err) {
  console.error("Error loading .env.local:", err.message);
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CHANNEL_ID = process.env.CHANNEL_ID || "1062755334223052931";
const CITY = process.env.CITY || "Amman";
const COUNTRY = process.env.COUNTRY || "Jordan";
const CALCULATION_METHOD = process.env.CALCULATION_METHOD || "2"; // Default: ISNA

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
let lastFetchDate = null;

// Prayer names mapping
const prayerNames = {
  Fajr: "Fajr (Dawn)",
  Dhuhr: "Dhuhr (Noon)",
  Asr: "Asr (Afternoon)",
  Maghrib: "Maghrib (Sunset)",
  Isha: "Isha (Night)",
};

// Calculation methods for different regions/schools
const calculationMethods = {
  1: "University of Islamic Sciences, Karachi",
  2: "Islamic Society of North America (ISNA)",
  3: "Muslim World League (MWL)",
  4: "Umm al-Qura, Makkah",
  5: "Egyptian General Authority of Survey",
  7: "Institute of Geophysics, University of Tehran",
  8: "Gulf Region",
  9: "Kuwait",
  10: "Qatar",
  11: "Majlis Ugama Islam Singapura, Singapore",
  12: "Union Organization islamic de France",
  13: "Diyanet İşleri Başkanlığı, Turkey",
  14: "Spiritual Administration of Muslims of Russia",
};

// Fetch prayer times from API
async function fetchPrayerTimes(
  city = CITY,
  country = COUNTRY,
  method = CALCULATION_METHOD
) {
  try {
    const response = await axios.get(
      `http://api.aladhan.com/v1/timingsByCity`,
      {
        params: {

          city: city,
          country: country,
          method: method,

        },
        timeout: 10000, // 10 second timeout
      }
    );

    if (response.data.code === 200) {
      const timings = response.data.data.timings;
      const date = response.data.data.date;
      const newPrayerTimes = {
        Fajr: timings.Fajr,
        Dhuhr: timings.Dhuhr,
        Asr: timings.Asr,
        Maghrib: timings.Maghrib,
        Isha: timings.Isha,
      };

      // Only update global times if fetching for default location
      if (city === CITY && country === COUNTRY) {
        prayerTimes = newPrayerTimes;
        lastFetchDate = date.gregorian.date;
        console.log(
          `✅ Prayer times updated for ${city}, ${country}:`,
          prayerTimes
        );
      }

      return {
        success: true,
        times: newPrayerTimes,
        location: { city, country },
        date: date.gregorian.date,
        method: calculationMethods[method] || `Method ${method}`,
      };
    } else {
      throw new Error(`API returned code ${response.data.code}`);
    }
  } catch (error) {
    console.error("❌ Error fetching prayer times:", error.message);
    return { success: false, error: error.message };
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
      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
        .setTitle(`🕌 ${prayerNames[prayer]} Prayer Time`)
        .setDescription(
          `It's time for **${prayerNames[prayer]}** prayer in ${CITY}, ${COUNTRY}`
        )
        .addFields(
          { name: "Time", value: time, inline: true },
          { name: "Prayer", value: prayer, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: "May Allah accept your prayers" });

      await channel.send({
        content: "@everyone",
        embeds: [embed],
        allowedMentions: { parse: ["everyone"] },
      });
      console.log(`📢 Sent notification for ${prayer} prayer at ${time}`);
    }
  } catch (error) {
    console.error("❌ Error sending notification:", error.message);
    // Retry once after 5 seconds if failed
    setTimeout(async () => {
      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (channel) {
          await channel.send(
            `🕌 Prayer time: ${prayerNames[prayer]} at ${time}`
          );
        }
      } catch (retryError) {
        console.error("❌ Retry failed:", retryError.message);
      }
    }, 5000);
  }
}

// Register slash commands
async function registerCommands() {
  if (!CLIENT_ID) {
    console.warn(
      "⚠️ CLIENT_ID not set - slash commands will not be registered"
    );
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("prayer-times")
      .setDescription("Get today's prayer times")
      .addStringOption((option) =>
        option
          .setName("city")
          .setDescription("City name (optional)")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("country")
          .setDescription("Country name (optional)")
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName("next-prayer")
      .setDescription("Get the next upcoming prayer time"),

    new SlashCommandBuilder()
      .setName("calculation-methods")
      .setDescription("List available prayer calculation methods"),

    new SlashCommandBuilder()
      .setName("bot-info")
      .setDescription("Get information about the prayer bot"),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    console.log("🔄 Registering slash commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Successfully registered slash commands");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
}

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    if (commandName === "prayer-times") {
      await interaction.deferReply();

      const city = interaction.options.getString("city") || CITY;
      const country = interaction.options.getString("country") || COUNTRY;

      const result = await fetchPrayerTimes(city, country, CALCULATION_METHOD);

      if (result.success) {
        const embed = new EmbedBuilder()
          .setColor(0x00ae86)
          .setTitle(`🕌 Prayer Times for ${city}, ${country}`)
          .setDescription(
            `**Date:** ${result.date}\n**Method:** ${result.method}`
          )
          .addFields(
            { name: "🌅 Fajr", value: result.times.Fajr, inline: true },
            { name: "☀️ Dhuhr", value: result.times.Dhuhr, inline: true },
            { name: "🌤️ Asr", value: result.times.Asr, inline: true },
            { name: "🌆 Maghrib", value: result.times.Maghrib, inline: true },
            { name: "🌙 Isha", value: result.times.Isha, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: "Prayer times from Aladhan API" });

        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply(`❌ Error: ${result.error}`);
      }
    } else if (commandName === "next-prayer") {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      let nextPrayer = null;
      let nextTime = null;

      for (const [prayer, time] of Object.entries(prayerTimes)) {
        if (time > currentTime) {
          nextPrayer = prayer;
          nextTime = time;
          break;
        }
      }

      if (!nextPrayer) {
        // If no more prayers today, next is Fajr tomorrow
        nextPrayer = "Fajr";
        nextTime = prayerTimes.Fajr;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
        .setTitle("⏰ Next Prayer")
        .setDescription(`The next prayer is **${prayerNames[nextPrayer]}**`)
        .addFields(
          { name: "Time", value: nextTime, inline: true },
          { name: "Location", value: `${CITY}, ${COUNTRY}`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (commandName === "calculation-methods") {
      const methodsList = Object.entries(calculationMethods)
        .map(([id, name]) => `**${id}:** ${name}`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
        .setTitle("📖 Calculation Methods")
        .setDescription(methodsList)
        .addFields({
          name: "Current Method",
          value: `${CALCULATION_METHOD} - ${
            calculationMethods[CALCULATION_METHOD] || "Custom"
          }`,
        })
        .setFooter({ text: "Set CALCULATION_METHOD in .env.local to change" });

      await interaction.reply({ embeds: [embed] });
    } else if (commandName === "bot-info") {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);

      const embed = new EmbedBuilder()
        .setColor(0x00ae86)
        .setTitle("🤖 Prayer Bot Information")
        .setDescription("Discord bot for Islamic prayer time notifications")
        .addFields(
          { name: "📍 Monitoring", value: `${CITY}, ${COUNTRY}`, inline: true },
          { name: "📢 Channel", value: `<#${CHANNEL_ID}>`, inline: true },
          { name: "⏰ Uptime", value: `${hours}h ${minutes}m`, inline: true },
          {
            name: "🔢 Method",
            value: calculationMethods[CALCULATION_METHOD] || "Custom",
            inline: false,
          },
          {
            name: "📅 Last Update",
            value: lastFetchDate || "Not fetched yet",
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: "Made with ❤️ for the Muslim community" });

      await interaction.reply({ embeds: [embed] });
    }
  } catch (error) {
    console.error("❌ Error handling command:", error);
    const errorMessage = "An error occurred while processing your command.";
    if (interaction.deferred) {
      await interaction.editReply(errorMessage);
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Bot ready event
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📍 Monitoring prayer times for ${CITY}, ${COUNTRY}`);

  // Register slash commands
  await registerCommands();

  // Fetch prayer times initially
  const result = await fetchPrayerTimes();
  if (!result.success) {
    console.error("⚠️ Initial prayer time fetch failed. Will retry...");
    // Retry after 1 minute
    setTimeout(() => fetchPrayerTimes(), 60000);
  }

  // Update prayer times daily at midnight
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      console.log("🔄 Daily prayer time update...");
      await fetchPrayerTimes();
    }
  }, 60000);

  // Check for prayer times every minute
  setInterval(checkPrayerTime, 60000);

  // Also check immediately
  checkPrayerTime();
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  client.destroy();
  process.exit(0);
});

// Unhandled errors
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

// Login to Discord
client.login(DISCORD_TOKEN).catch((error) => {
  console.error("❌ Failed to login:", error.message);
  process.exit(1);
});
