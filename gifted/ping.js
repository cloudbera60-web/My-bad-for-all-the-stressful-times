const { evt } = require('../gift');

evt({
    pattern: 'ping',
    fromMe: false,
    desc: 'Check bot response time'
}, async (message, sock, match) => {
    const start = Date.now();
    await sock.sendMessage(message, { text: 'Pong!' }, { quoted: match.m });
    const latency = Date.now() - start;
    await sock.sendMessage(message, { 
        text: `🏓 Pong!\n⏱️ Latency: ${latency}ms\n🤖 Bot: CLOUD AI` 
    }, { quoted: match.m });
});

evt({
    pattern: 'help',
    fromMe: false,
    desc: 'Show all commands'
}, async (message, sock, match) => {
    const helpText = `
🤖 *CLOUD AI COMMANDS*

📊 *Information:*
• .ping - Check bot speed
• .help - Show this menu
• .owner - Contact owner
• .status - Bot status

🎮 *Fun:*
• .sticker - Create sticker
• .attp - Text to sticker
• .quote - Random quote

🔧 *Tools:*
• .tts - Text to speech
• .calc - Calculator
• .weather - Weather info

📁 *Media:*
• .toimg - Sticker to image
• .mp3 - Audio extractor

Use: .help <command> for details

${match.config.FOOTER}`;

    await sock.sendMessage(message, { 
        text: helpText,
        contextInfo: {
            externalAdReply: {
                title: "CLOUD AI HELP MENU",
                body: "Powered by Cloud AI",
                thumbnailUrl: match.config.BOT_PIC,
                sourceUrl: match.config.BOT_REPO
            }
        }
    }, { quoted: match.m });
});

// Add more commands as needed...
