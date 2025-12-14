const { 
    default: giftedConnect, 
    isJidGroup, 
    jidNormalizedUser,
    isJidBroadcast,
    downloadContentFromMessage,
    DisconnectReason, 
    getContentType,
    fetchLatestBaileysVersion, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const { 
    evt, 
    logger,
    emojis,
    setSudo,
    delSudo,
    GiftedAutoReact,
    GiftedAntiLink,
    GiftedAutoBio,
    GiftedChatBot,
    loadSession,
    getSudoNumbers,
    createContext, 
    createContext2,
    GiftedPresence,
    GiftedAntiDelete,
    GiftedAnticall
} = require("./gift");

const pino = require("pino");
const config = require("./config");
const fs = require("fs-extra");
const path = require("path");
const { Boom } = require("@hapi/boom");

const PORT = process.env.PORT || 50900;
const express = require("express");
const app = express();

// Import routes
const { qrRoute, pairRoute } = require('./routes');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Use routes
app.use('/qr', qrRoute);
app.use('/pair', pairRoute);

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 200,
        service: 'CLOUD AI Bot',
        timestamp: new Date().toISOString()
    });
});

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get('/pair-page', (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pair.html"));
});

app.listen(PORT, () => {
    console.log(`✅ Cloud AI Server running on port ${PORT}`);
});

// Bot initialization
const sessionDir = path.join(__dirname, "session");
let Gifted;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 50;
const RECONNECT_DELAY = 5000;

async function startCloudAI() {
    try {
        console.log("🔄 Starting Cloud AI Bot...");
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        console.log("📁 Session loaded from:", sessionDir);
        
        const cloudSock = {
            version,
            logger: pino({ level: "silent" }),
            browser: ['CLOUD AI', "safari", "1.0.0"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            getMessage: async (key) => {
                return { conversation: 'Hello from Cloud AI' };
            },
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false
        };

        Gifted = giftedConnect(cloudSock);
        console.log("🤖 Cloud AI instance created");

        Gifted.ev.process(async (events) => {
            if (events['creds.update']) {
                await saveCreds();
            }
        });

        // Auto React
        if (config.AUTO_REACT === "true") {
            Gifted.ev.on('messages.upsert', async (mek) => {
                const ms = mek.messages[0];
                try {
                    if (ms.key.fromMe) return;
                    if (!ms.key.fromMe && ms.message) {
                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                        await GiftedAutoReact(randomEmoji, ms, Gifted);
                    }
                } catch (err) {
                    // Ignore auto-react errors
                }
            });
        }

        // Auto Bio
        if (config.AUTO_BIO === 'true') {
            setTimeout(() => GiftedAutoBio(Gifted), 1000);
            setInterval(() => GiftedAutoBio(Gifted), 1000 * 60);
        }

        // Anti-call
        if (config.ANTICALL === "true") {
            Gifted.ev.on("call", async (json) => {
                await GiftedAnticall(json, Gifted);
            });
        }

        // Presence
        if (config.PRESENCE === "true") {
            Gifted.ev.on("messages.upsert", async ({ messages }) => {
                if (messages && messages.length > 0) {
                    await GiftedPresence(Gifted, messages[0].key.remoteJid);
                }
            });
        }

        // Connection presence
        Gifted.ev.on("connection.update", ({ connection }) => {
            if (connection === "open") {
                console.log("✅ Cloud AI Connected to WhatsApp!");
                GiftedPresence(Gifted, "status@broadcast");
            }
        });

        // Chatbot
        if (config.CHATBOT === 'true' || config.CHATBOT === 'audio') {
            const googleTTS = require("google-tts-api");
            GiftedChatBot(Gifted, config.CHATBOT, config.CHATBOT_MODE, createContext, createContext2, googleTTS);
        }
        
        // Anti-link
        if (config.ANTILINK !== 'false') {
            Gifted.ev.on('messages.upsert', async ({ messages }) => {
                const message = messages[0];
                if (!message?.message || message.key.fromMe) return;
                await GiftedAntiLink(Gifted, message, config.ANTILINK);
            });
        }

        // Load commands
        try {
            const commandsPath = path.join(__dirname, "gifted");
            if (fs.existsSync(commandsPath)) {
                const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
                console.log(`📂 Found ${commandFiles.length} command files`);
                
                commandFiles.forEach((fileName) => {
                    try {
                        require(path.join(commandsPath, fileName));
                        console.log(`✅ Loaded command: ${fileName}`);
                    } catch (e) {
                        console.error(`❌ Failed to load ${fileName}:`, e.message);
                    }
                });
            } else {
                console.log("📂 No commands folder found, creating one...");
                fs.mkdirSync(commandsPath, { recursive: true });
                
                // Create basic ping command
                const pingCode = `const { evt } = require('../gift');

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
        text: \`*🤖 CLOUD AI Status*\\n\\n⏱️ Response Time: *\${latency}ms*\\n⚡ Status: *Online*\\n🌐 Mode: *\${match.config.MODE}*\`
    }, { quoted: match.m });
});

evt({
    pattern: 'help',
    fromMe: false,
    desc: 'Show all commands'
}, async (message, sock, match) => {
    const commands = match.evt.commands;
    
    let helpText = \`*🤖 CLOUD AI COMMANDS*\\n\\n\`;
    helpText += \`Prefix: *\${match.config.PREFIX}*\\n\\n\`;
    
    commands.forEach(cmd => {
        helpText += \`• *\${match.config.PREFIX}\${cmd.pattern}* - \${cmd.desc}\\n\`;
    });
    
    helpText += \`\\n\${match.config.FOOTER}\`;
    
    await sock.sendMessage(message, { 
        text: helpText
    }, { quoted: match.m });
});`;
                
                fs.writeFileSync(path.join(commandsPath, 'ping.js'), pingCode);
                console.log("✅ Created default ping.js command");
                require(path.join(commandsPath, 'ping.js'));
            }
        } catch (error) {
            console.error("❌ Error loading commands:", error.message);
        }

        // Message handler
        Gifted.ev.on("messages.upsert", async ({ messages }) => {
            const ms = messages[0];
            if (!ms?.message || !ms?.key) return;

            const from = ms.key.remoteJid;
            const isGroup = from.endsWith("@g.us");
            
            let groupInfo = null;
            if (isGroup) {
                try {
                    groupInfo = await Gifted.groupMetadata(from);
                } catch (err) {
                    console.error("Group metadata error:", err);
                }
            }

            const pushName = ms.pushName || 'Cloud AI User';
            const text = ms.message?.conversation || 
                        ms.message?.extendedTextMessage?.text || 
                        ms.message?.imageMessage?.caption || 
                        ms.message?.videoMessage?.caption || '';
            
            const isCommand = text.startsWith(config.PREFIX);
            const command = isCommand ? text.slice(config.PREFIX.length).trim().split(' ')[0].toLowerCase() : '';

            if (isCommand && command) {
                // Auto read if enabled
                if (config.AUTO_READ_MESSAGES === "true" || config.AUTO_READ_MESSAGES === "commands") {
                    await Gifted.readMessages([ms.key]).catch(() => {});
                }

                // Find command
                const cmd = evt.commands.find(c => 
                    c.pattern === command || 
                    (Array.isArray(c.aliases) && c.aliases.includes(command))
                );

                if (cmd) {
                    // Check for private mode
                    if (config.MODE?.toLowerCase() === "private") {
                        const sudoNumbers = getSudoNumbers() || [];
                        const senderNumber = ms.key.participant?.split('@')[0] || ms.key.remoteJid.split('@')[0];
                        const ownerNumber = config.OWNER_NUMBER.replace(/\D/g, '');
                        const isAllowed = sudoNumbers.includes(senderNumber) || 
                                         senderNumber === ownerNumber;
                        
                        if (!isAllowed) {
                            await Gifted.sendMessage(from, { 
                                text: "⚠️ This bot is in private mode. Contact owner for access."
                            }, { quoted: ms }).catch(() => {});
                            return;
                        }
                    }

                    try {
                        // Execute command
                        const args = text.slice(config.PREFIX.length + command.length).trim().split(' ');
                        
                        const context = {
                            m: ms,
                            from,
                            sender: ms.key.participant || from,
                            pushName,
                            isGroup,
                            groupInfo,
                            isAdmin: false,
                            isBotAdmin: false,
                            reply: (text) => {
                                Gifted.sendMessage(from, { text }, { quoted: ms }).catch(() => {});
                            },
                            react: async (emoji) => {
                                await Gifted.sendMessage(from, { 
                                    react: { key: ms.key, text: emoji }
                                }).catch(() => {});
                            },
                            config,
                            evt,
                            createContext,
                            args
                        };

                        await cmd.function(from, Gifted, context);

                    } catch (error) {
                        console.error(`Command error [${command}]:`, error);
                        await Gifted.sendMessage(from, {
                            text: `❌ Command error: ${error.message}`
                        }, { quoted: ms }).catch(() => {});
                    }
                }
            }
        });

        // Connection events
        Gifted.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === "connecting") {
                console.log("🔄 Connecting to WhatsApp...");
            }

            if (connection === "open") {
                console.log("✅ Cloud AI is online and ready!");
                reconnectAttempts = 0;
                
                // Send startup message
                if (config.STARTING_MESSAGE === "true" && Gifted.user?.id) {
                    try {
                        const startupMsg = `
*${config.BOT_NAME} CONNECTED*

🤖 *Bot Info:*
• Prefix: *${config.PREFIX}*
• Mode: *${config.MODE}*
• Version: *${config.VERSION}*
• Owner: *${config.OWNER_NAME}*

🌐 *Links:*
• Repository: ${config.BOT_REPO}
• Updates: ${config.NEWSLETTER_URL}

${config.CAPTION}`;

                        await Gifted.sendMessage(Gifted.user.id, {
                            text: startupMsg
                        });
                        console.log("📨 Startup message sent");
                    } catch (msgError) {
                        console.error("Startup message error:", msgError);
                    }
                }
            }

            if (connection === "close") {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.log(`🔌 Connection closed: ${reason}`);
                
                if (reason === DisconnectReason.badSession || reason === DisconnectReason.loggedOut) {
                    console.log("❌ Bad session or logged out. Please re-authenticate.");
                    process.exit(1);
                } else {
                    console.log("🔄 Reconnecting...");
                    setTimeout(reconnectWithRetry, RECONNECT_DELAY);
                }
            }
        });

    } catch (error) {
        console.error('❌ Bot initialization error:', error.message);
        setTimeout(reconnectWithRetry, RECONNECT_DELAY);
    }
}

async function reconnectWithRetry() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('❌ Max reconnection attempts reached');
        process.exit(1);
    }

    reconnectAttempts++;
    const delay = Math.min(RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1), 30000);
    
    console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);
    
    setTimeout(() => {
        startCloudAI().catch(err => {
            console.error('❌ Reconnection failed:', err.message);
            reconnectWithRetry();
        });
    }, delay);
}

// Start the bot
console.log("🚀 Starting Cloud AI Bot System...");
setTimeout(() => {
    startCloudAI().catch(err => {
        console.error("❌ Initialization error:", err.message);
        reconnectWithRetry();
    });
}, 3000);
