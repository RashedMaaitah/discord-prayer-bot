# discord-prayer-bot

Lightweight Discord bot for prayer requests and simple automation.

## Summary

This repository contains a simple Discord bot (entry: `bot.js`). It provides a minimal foundation to run a bot that can be extended with commands for prayer requests, moderation, or other community features.

## Prerequisites

- Node.js (LTS recommended, e.g. v16+)
- A Discord bot token with appropriate gateway and bot permissions

## Setup

1. Install dependencies:

```powershell
npm install
```

2. Create a `.env.local` file at the project root (or edit the provided `.env.local`). The project will load it automatically using `dotenv`.

Example `.env.local`:

```text
DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE
CHANNEL_ID=1062755334223052931
CITY=Amman
COUNTRY=Jordan
```

3. Keep secrets out of version control — add `.env.local` to your `.gitignore`.

## Run

Start the bot with:

```powershell
node bot.js
```

## Contributing

- Add commands in `bot.js` or split into modules under a new `src/` folder.
- Open issues or pull requests to propose features or fixes.
