const { 
    default: giftedConnect,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");
const { Boom } = require("@hapi/boom");
const express = require("express");

const PORT = process.env.PORT || 50900;
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
        
        // Check if session exists
        const sessionExists = fs.existsSync(path.join(sessionDir, 'creds.json'));
        if (!sessionExists) {
            console.log("⏳ No session found. Waiting for pairing...");
            setTimeout(reconnectWithRetry, 10000);
            return;
        }
        
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        console.log("📁 Session loaded");
        
        const cloudSock = {
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: ['CLOUD AI', "safari", "1.0.0"],
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false
        };

        Gifted = giftedConnect(cloudSock);
        console.log("🤖 Cloud AI instance created");

        Gifted.ev.on('creds.update', saveCreds);

        // Message handler
        Gifted.ev.on("messages.upsert", async ({ messages }) => {
            const ms = messages[0];
            if (!ms?.message || !ms?.key) return;

            const from = ms.key.remoteJid;
            const text = ms.message?.conversation || 
                        ms.message?.extendedTextMessage?.text || '';
            
            // Handle ping command
            if (text === '.ping' || text === '.ping') {
                const start = Date.now();
                await Gifted.sendMessage(from, { 
                    text: '🏓 Pong!'
                }, { quoted: ms });
                
                const latency = Date.now() - start;
                
                await Gifted.sendMessage(from, { 
                    text: `*🤖 CLOUD AI Status*\n\n⏱️ Response Time: *${latency}ms*\n⚡ Status: *Online*\n🤖 Bot: *CLOUD AI*`
                }, { quoted: ms });
            }
            
            // Handle help command
            if (text === '.help' || text === '.help') {
                const helpText = `*🤖 CLOUD AI COMMANDS*\n\n` +
                               `• *.ping* - Check bot response time\n` +
                               `• *.help* - Show this help menu\n` +
                               `• *.owner* - Contact bot owner\n` +
                               `\n*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴄʟᴏᴜᴅ ᴀɪ*`;
                
                await Gifted.sendMessage(from, { 
                    text: helpText
                }, { quoted: ms });
            }
            
            // Handle owner command
            if (text === '.owner' || text === '.owner') {
                await Gifted.sendMessage(from, { 
                    text: `*👤 Bot Owner*\n\n📱 Number: *254715206562*\n👤 Name: *Cloud Dev*\n\n💬 Contact for support or queries.`
                }, { quoted: ms });
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
                try {
                    const startupMsg = `*CLOUD AI CONNECTED*\n\n🤖 Bot is now online and ready!\nUse *.help* to see available commands.`;
                    
                    await Gifted.sendMessage(Gifted.user.id, {
                        text: startupMsg
                    });
                    console.log("📨 Startup message sent");
                } catch (msgError) {
                    console.error("Startup message error:", msgError);
                }
            }

            if (connection === "close") {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.log(`🔌 Connection closed: ${reason}`);
                
                if (reason === DisconnectReason.badSession || reason === DisconnectReason.loggedOut) {
                    console.log("❌ Bad session or logged out. Please re-authenticate.");
                    // Clean session and exit
                    try {
                        await fs.remove(sessionDir);
                    } catch (e) {
                        console.error("Failed to remove session:", e);
                    }
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

module.exports = app;
