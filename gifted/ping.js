const { evt } = require('../gift');

evt({
    pattern: 'ping',
    fromMe: false,
    desc: 'Check bot response time'
}, async (message, sock, match) => {
    const start = Date.now();
    await sock.sendMessage(message, { 
        text: '🏓 Pong!'
    }, { quoted: match.m });
    
    const latency = Date.now() - start;
    
    await sock.sendMessage(message, { 
        text: `*🤖 CLOUD AI Status*\n\n⏱️ Response Time: *${latency}ms*\n⚡ Status: *Online*\n🌐 Mode: *${match.config.MODE}*`
    }, { quoted: match.m });
});

evt({
    pattern: 'help',
    fromMe: false,
    desc: 'Show all commands'
}, async (message, sock, match) => {
    const commands = match.evt.commands;
    const categories = {};
    
    // Organize commands by type
    commands.forEach(cmd => {
        const type = cmd.type || 'general';
        if (!categories[type]) {
            categories[type] = [];
        }
        categories[type].push(cmd);
    });
    
    let helpText = `*🤖 CLOUD AI COMMANDS*\n\n`;
    helpText += `Prefix: *${match.config.PREFIX}*\n\n`;
    
    for (const [category, cmds] of Object.entries(categories)) {
        helpText += `*${category.toUpperCase()}*\n`;
        cmds.forEach(cmd => {
            helpText += `• *${match.config.PREFIX}${cmd.pattern}* - ${cmd.desc}\n`;
        });
        helpText += '\n';
    }
    
    helpText += `${match.config.FOOTER}`;
    
    await sock.sendMessage(message, { 
        text: helpText,
        ...match.createContext(match.sender, {
            title: "CLOUD AI HELP MENU",
            body: "Powered by Cloud AI"
        })
    }, { quoted: match.m });
});

evt({
    pattern: 'owner',
    fromMe: false,
    desc: 'Contact bot owner'
}, async (message, sock, match) => {
    await sock.sendMessage(message, { 
        text: `*👤 Bot Owner*\n\n📱 Number: *${match.config.OWNER_NUMBER}*\n👤 Name: *${match.config.OWNER_NAME}*\n\n💬 Contact for support or queries.`
    }, { quoted: match.m });
});
