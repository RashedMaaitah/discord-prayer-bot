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

2. Provide your bot token. Set the `DISCORD_TOKEN` environment variable, for example in PowerShell:

```powershell
$env:DISCORD_TOKEN = "YOUR_BOT_TOKEN"
node bot.js
```

Alternatively, you can use a `.env` loader or other config if you prefer—`bot.js` will need to be updated accordingly.

## Run

Start the bot with:

```powershell
node bot.js
```

## Contributing

- Add commands in `bot.js` or split into modules under a new `src/` folder.
- Open issues or pull requests to propose features or fixes.
