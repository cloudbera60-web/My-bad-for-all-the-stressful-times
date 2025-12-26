const { 
    default: giftedConnect, 
    isJidGroup, 
    jidNormalizedUser,
    isJidBroadcast,
    downloadMediaMessage, 
    downloadContentFromMessage,
    downloadAndSaveMediaMessage, 
    DisconnectReason, 
    getContentType,
    fetchLatestWaWebVersion, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore,
    jidDecode 
} = require("gifted-baileys");

const { 
    evt, 
    logger,
    emojis,
    gmdStore,
    commands,
    setSudo,
    delSudo,
    GiftedTechApi,
    GiftedApiKey,
    GiftedAutoReact,
    GiftedAntiLink,
    GiftedAutoBio,
    GiftedChatBot,
    loadSession,
    getMediaBuffer,
    getSudoNumbers,
    getFileContentType,
    bufferToStream,
    uploadToPixhost,
    uploadToImgBB,
    setCommitHash, 
    getCommitHash,
    gmdBuffer, gmdJson, 
    formatAudio, formatVideo,
    uploadToGithubCdn,
    uploadToGiftedCdn,
    uploadToPasteboard,
    uploadToCatbox,
    GiftedAnticall,
    createContext, 
    createContext2,
    verifyJidState,
    GiftedPresence,
    GiftedAntiDelete
} = require("./gift");

const { 
    Sticker, 
    createSticker, 
    StickerTypes 
} = require("wa-sticker-formatter");
const pino = require("pino");
const config = require("./config");
const axios = require("axios");
const googleTTS = require("google-tts-api");
const fs = require("fs-extra");
const path = require("path");
const { Boom } = require("@hapi/boom");
const express = require("express");
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const crypto = require('crypto');
const zlib = require('zlib');
const {
    MODE: botMode, 
    BOT_PIC: botPic, 
    FOOTER: botFooter, 
    CAPTION: botCaption, 
    VERSION: botVersion, 
    OWNER_NUMBER: ownerNumber, 
    OWNER_NAME: ownerName,  
    BOT_NAME: botName, 
    PREFIX: botPrefix,
    PRESENCE: botPresence,
    CHATBOT: chatBot,
    CHATBOT_MODE: chatBotMode,
    STARTING_MESSAGE: startMess,
    ANTIDELETE: antiDelete,
    ANTILINK: antiLink,
    ANTICALL: antiCall,
    TIME_ZONE: timeZone,
    BOT_REPO: giftedRepo,
    NEWSLETTER_JID: newsletterJid,
    NEWSLETTER_URL: newsletterUrl,
    AUTO_REACT: autoReact,
    AUTO_READ_STATUS: autoReadStatus,
    AUTO_LIKE_STATUS: autoLikeStatus,
    STATUS_LIKE_EMOJIS: statusLikeEmojis,
    AUTO_REPLY_STATUS: autoReplyStatus,
    STATUS_REPLY_TEXT: statusReplyText,
    AUTO_READ_MESSAGES: autoRead,
    AUTO_BLOCK: autoBlock,
    AUTO_BIO: autoBio } = config;
const PORT = process.env.PORT || 4420;
const app = express();

// Bot instance - declared globally
let Gifted = null;

// In-memory store for active sessions
const activeSessions = new Map();
let currentSessionId = null;

logger.level = "silent";

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Serve index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API Endpoints
app.get("/api/status", (req, res) => {
    res.json({
        status: "ok",
        connected: !!Gifted && Gifted.user?.id,
        botName: botName,
        version: botVersion,
        mode: botMode,
        sessionActive: currentSessionId !== null
    });
});

app.post("/api/connect", async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ 
                success: false, 
                message: "Session ID is required" 
            });
        }

        // Validate session ID format
        if (!sessionId.startsWith('Gifted~')) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid session ID format. Must start with 'Gifted~'" 
            });
        }

        // Store session ID
        currentSessionId = sessionId;
        
        // Clear old session files
        await clearSessionFiles();
        
        // Save session ID to file
        await saveSessionToFile(sessionId);
        
        // Start the bot
        setTimeout(() => {
            startGifted().then(() => {
                console.log("✅ Bot started with provided session ID");
            }).catch(err => {
                console.error("❌ Failed to start bot:", err);
            });
        }, 1000);

        res.json({ 
            success: true, 
            message: "Session ID accepted. Starting bot..." 
        });

    } catch (error) {
        console.error("Connection error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to process session ID", 
            error: error.message 
        });
    }
});

app.post("/api/disconnect", async (req, res) => {
    try {
        if (Gifted) {
            await Gifted.logout();
            await Gifted.ws.close();
            Gifted = null;
        }
        
        currentSessionId = null;
        await clearSessionFiles();
        
        res.json({ 
            success: true, 
            message: "Bot disconnected successfully" 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Failed to disconnect", 
            error: error.message 
        });
    }
});

app.get("/api/bot-info", (req, res) => {
    if (!Gifted || !Gifted.user) {
        return res.json({ 
            connected: false, 
            message: "Bot not connected" 
        });
    }
    
    res.json({
        connected: true,
        botId: Gifted.user.id,
        botName: Gifted.user.name,
        platform: Gifted.user.platform,
        phone: Gifted.user.phone,
        pushname: Gifted.user.pushname,
        sessionActive: true
    });
});

app.post("/api/send-message", async (req, res) => {
    try {
        const { jid, message } = req.body;
        
        if (!Gifted || !Gifted.user) {
            return res.status(400).json({ 
                success: false, 
                message: "Bot not connected" 
            });
        }
        
        if (!jid || !message) {
            return res.status(400).json({ 
                success: false, 
                message: "JID and message are required" 
            });
        }
        
        await Gifted.sendMessage(jid, { text: message });
        
        res.json({ 
            success: true, 
            message: "Message sent successfully" 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Failed to send message", 
            error: error.message 
        });
    }
});

// Helper functions
async function clearSessionFiles() {
    const sessionDir = path.join(__dirname, "gift", "session");
    try {
        if (await fs.pathExists(sessionDir)) {
            await fs.remove(sessionDir);
        }
        await fs.ensureDir(sessionDir);
    } catch (error) {
        console.error("Error clearing session files:", error);
    }
}

async function saveSessionToFile(sessionId) {
    try {
        // Decode session data
        const sessionData = decodeSessionId(sessionId);
        const sessionDir = path.join(__dirname, "gift", "session");
        
        // Create session directory
        await fs.ensureDir(sessionDir);
        
        // Save the session data to creds.json
        const credsFile = path.join(sessionDir, "creds.json");
        
        // Ensure the session data has proper structure
        const validatedSession = validateSessionStructure(sessionData);
        
        await fs.writeJson(credsFile, validatedSession, { spaces: 2 });
        
        console.log("✅ Session saved to file with validated structure");
        
    } catch (error) {
        console.error("Error saving session to file:", error);
        throw error;
    }
}

function decodeSessionId(sessionId) {
    try {
        // Remove 'Gifted~' prefix
        const base64Data = sessionId.replace('Gifted~', '');
        
        // Decode base64
        const compressedData = Buffer.from(base64Data, 'base64');
        
        // Decompress gzip
        const decompressedData = zlib.gunzipSync(compressedData);
        
        // Parse JSON
        return JSON.parse(decompressedData.toString());
        
    } catch (error) {
        console.error("Error decoding session ID:", error);
        throw new Error("Invalid session ID format");
    }
}

function validateSessionStructure(sessionData) {
    // If sessionData is already a proper creds object, return it
    if (sessionData.noiseKey && sessionData.signedIdentityKey) {
        return sessionData;
    }
    
    // If sessionData has a creds property, use that
    if (sessionData.creds && typeof sessionData.creds === 'object') {
        return sessionData.creds;
    }
    
    // Otherwise, create a minimal valid structure
    console.warn("⚠️ Session data missing required fields, creating minimal structure");
    
    return {
        noiseKey: {
            private: Buffer.alloc(32),
            public: Buffer.alloc(32)
        },
        signedIdentityKey: {
            private: Buffer.alloc(32),
            public: Buffer.alloc(32)
        },
        signedPreKey: {
            keyPair: {
                private: Buffer.alloc(32),
                public: Buffer.alloc(32)
            },
            signature: Buffer.alloc(64),
            keyId: 1
        },
        registrationId: 1234,
        advSecretKey: Buffer.alloc(32),
        me: {
            id: 'server:' + Date.now(),
            name: 'Gifted-MD Bot',
            lid: null
        },
        account: {
            details: {},
            accountSignatureKey: Buffer.alloc(32),
            accountSignature: Buffer.alloc(64),
            deviceSignature: Buffer.alloc(64)
        },
        processedHistoryMessages: [],
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        serverHasPreKeys: false
    };
}

// Start Express server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Bot interface available at http://localhost:${PORT}`);
});

// Bot initialization variables
let store;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 50;
const RECONNECT_DELAY = 5000;

async function startGifted() {
    try {
        console.log('🚀 Starting Gifted-MD...');
        
        const { version } = await fetchLatestWaWebVersion();
        console.log(`📱 WhatsApp Web version: ${version}`);
        
        // Always use file-based auth state - more reliable
        const sessionDir = path.join(__dirname, "gift", "session");
        
        // Check if we have a valid session file
        const credsPath = path.join(sessionDir, "creds.json");
        let hasValidSession = false;
        
        if (await fs.pathExists(credsPath)) {
            try {
                const credsData = await fs.readJson(credsPath);
                // Check if it has minimum required fields
                if (credsData.me && credsData.noiseKey) {
                    hasValidSession = true;
                    console.log('✅ Found valid session file');
                } else {
                    console.warn('⚠️ Session file exists but missing required fields');
                }
            } catch (e) {
                console.warn('⚠️ Could not read session file:', e.message);
            }
        }
        
        if (!hasValidSession && currentSessionId) {
            console.log('🔄 No valid session found, trying to use provided session ID...');
            try {
                await saveSessionToFile(currentSessionId);
                console.log('✅ Session saved from ID, restarting...');
                // Wait a bit and retry
                setTimeout(() => startGifted(), 2000);
                return;
            } catch (sessionError) {
                console.error('❌ Failed to use session ID:', sessionError.message);
                console.log('🆕 Creating fresh session...');
            }
        }
        
        // Get auth state
        const { state, saveState } = await useMultiFileAuthState(sessionDir);
        
        // Ensure state has valid structure
        if (!state.creds.me) {
            console.warn('⚠️ Auth state missing "me" object, initializing...');
            state.creds.me = {
                id: 'server:' + Date.now(),
                name: 'Gifted-MD Bot',
                lid: null
            };
        }
        
        if (store) {
            store.destroy();
        }
        store = new gmdStore();
        
        const giftedSock = {
            version,
            logger: pino({ level: "silent" }),
            browser: ['GIFTED-MD', "Chrome", "1.0.0"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            getMessage: async (key) => {
                if (store) {
                    const msg = store.loadMessage(key.remoteJid, key.id);
                    return msg?.message || undefined;
                }
                return { conversation: 'Message not found' };
            },
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            patchMessageBeforeSending: (message) => {
                const requiresPatch = !!(
                    message.buttonsMessage ||
                    message.templateMessage ||
                    message.listMessage
                );
                if (requiresPatch) {
                    message = {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadataVersion: 2,
                                    deviceListMetadata: {},
                                },
                                ...message,
                            },
                        },
                    };
                }
                return message;
            }
        };

        console.log('🔌 Connecting to WhatsApp...');
        Gifted = giftedConnect(giftedSock);
        
        // Update saveState to handle credential updates
        Gifted.ev.on('creds.update', async (creds) => {
            try {
                state.creds = creds;
                await saveState();
                console.log('📝 Credentials updated and saved');
            } catch (error) {
                console.error('❌ Failed to save credentials:', error);
            }
        });
        
        store.bind(Gifted.ev);

        if (autoReact === "true") {
            Gifted.ev.on('messages.upsert', async (mek) => {
                const ms = mek.messages[0];
                try {
                    if (ms.key.fromMe) return;
                    if (!ms.key.fromMe && ms.message) {
                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                        await GiftedAutoReact(randomEmoji, ms, Gifted);
                    }
                } catch (err) {
                    console.error('Error during auto reaction:', err);
                }
            });
        }

        const groupCooldowns = new Map();

        function isGroupSpamming(jid) {
            const now = Date.now();
            const lastTime = groupCooldowns.get(jid) || 0;
            if (now - lastTime < 1500) return true;
            groupCooldowns.set(jid, now);
            return false;
        }
        
        let giftech = { chats: {} };
        const botJid = `${Gifted.user?.id?.split(':')[0]}@s.whatsapp.net` || null;
        const botOwnerJid = `${Gifted.user?.id?.split(':')[0]}@s.whatsapp.net` || null;

        Gifted.ev.on("messages.upsert", async ({ messages }) => {
            try {
                const ms = messages[0];
                if (!ms?.message) return;

                const { key } = ms;
                if (!key?.remoteJid) return;
                if (key.fromMe) return;
                if (key.remoteJid === 'status@broadcast') return;

                const sender = key.remoteJid || key.senderPn || key.participantPn || key.participant;
                const senderPushName = key.pushName || ms.pushName;

                if (sender === botJid || sender === botOwnerJid || key.fromMe) return;

                if (!giftech.chats[key.remoteJid]) giftech.chats[key.remoteJid] = [];
                giftech.chats[key.remoteJid].push({
                    ...ms,
                    originalSender: sender, 
                    originalPushName: senderPushName,
                    timestamp: Date.now()
                });

                if (giftech.chats[key.remoteJid].length > 50) {
                    giftech.chats[key.remoteJid] = giftech.chats[key.remoteJid].slice(-50);
                }

                if (ms.message?.protocolMessage?.type === 0) {
                    const deletedId = ms.message.protocolMessage.key.id;
                    const deletedMsg = giftech.chats[key.remoteJid].find(m => m.key.id === deletedId);
                    if (!deletedMsg?.message) return;

                    const deleter = key.participantPn || key.participant || key.remoteJid;
                    const deleterPushName = key.pushName || ms.pushName;
                    
                    if (deleter === botJid || deleter === botOwnerJid) return;

                    await GiftedAntiDelete(
                        Gifted, 
                        deletedMsg, 
                        key, 
                        deleter, 
                        deletedMsg.originalSender, 
                        botOwnerJid,
                        deleterPushName,
                        deletedMsg.originalPushName
                    );

                    giftech.chats[key.remoteJid] = giftech.chats[key.remoteJid].filter(m => m.key.id !== deletedId);
                }
            } catch (error) {
                console.error('Anti-delete system error:', error);
            }
        });

        if (autoBio === 'true') {
            setTimeout(() => GiftedAutoBio(Gifted), 1000);
            setInterval(() => GiftedAutoBio(Gifted), 1000 * 60);
        }

        Gifted.ev.on("call", async (json) => {
            await GiftedAnticall(json, Gifted);
        });

        Gifted.ev.on("messages.upsert", async ({ messages }) => {
            if (messages && messages.length > 0) {
                await GiftedPresence(Gifted, messages[0].key.remoteJid);
            }
        });

        if (chatBot === 'true' || chatBot === 'audio') {
            GiftedChatBot(Gifted, chatBot, chatBotMode, createContext, createContext2, googleTTS);
        }
        
        Gifted.ev.on('messages.upsert', async ({ messages }) => {
            const message = messages[0];
            if (!message?.message || message.key.fromMe) return;
            if (antiLink !== 'false') {
                await GiftedAntiLink(Gifted, message, antiLink);
            }
        });

        try {
            const pluginsPath = path.join(__dirname, "gifted");
            fs.readdirSync(pluginsPath).forEach((fileName) => {
                if (path.extname(fileName).toLowerCase() === ".js") {
                    try {
                        require(path.join(pluginsPath, fileName));
                    } catch (e) {
                        console.error(`❌ Failed to load ${fileName}: ${e.message}`);
                    }
                }
            });
        } catch (error) {
            console.error("❌ Error reading plugins folder:", error.message);
        }

        Gifted.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === "connecting") {
                console.log("🕗 Connecting to WhatsApp...");
                reconnectAttempts = 0;
            }

            if (connection === "open") {
                console.log("✅ Connected to WhatsApp!");
                console.log(`🤖 Bot ID: ${Gifted.user?.id || 'Unknown'}`);
                console.log(`👤 Bot Name: ${Gifted.user?.name || 'Unknown'}`);
                reconnectAttempts = 0;
                
                setTimeout(async () => {
                    try {
                        const totalCommands = commands.filter((command) => command.pattern).length;
                        console.log(`💜 Active! Loaded ${totalCommands} commands`);
                            
                        if (startMess === 'true') {
                            const md = botMode === 'public' ? "public" : "private";
                            const connectionMsg = `
*${botName} 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃*

𝐏𝐫𝐞𝐟𝐢𝐱       : *[ ${botPrefix} ]*
𝐏𝐥𝐮𝐠𝐢𝐧𝐬      : *${totalCommands.toString()}*
𝐌𝐨𝐝𝐞        : *${md}*
𝐎𝐰𝐧𝐞𝐫       : *${ownerNumber}*
𝐓𝐮𝐭𝐨𝐫𝐢𝐚𝐥𝐬     : *${config.YT || 'Not set'}*
𝐔𝐩𝐝𝐚𝐭𝐞𝐬      : *${newsletterUrl || 'Not set'}*

> *${botCaption || 'Ready to serve!'}*`;

                            await Gifted.sendMessage(
                                Gifted.user.id,
                                {
                                    text: connectionMsg,
                                    ...createContext(botName, {
                                        title: "BOT INTEGRATED",
                                        body: "Status: Ready for Use"
                                    })
                                }
                            );
                        }
                    } catch (err) {
                        console.error("Post-connection setup error:", err);
                    }
                }, 3000);
            }

            if (connection === "close") {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                
                console.log(`🔒 Connection closed: ${reason}`);
                
                if (reason === DisconnectReason.badSession) {
                    console.log("❌ Bad session file, deleting...");
                    try {
                        await fs.remove(__dirname + "/gift/session");
                    } catch (e) {
                        console.error("Failed to remove session:", e);
                    }
                    currentSessionId = null;
                    reconnectWithRetry();
                } else if (reason === DisconnectReason.connectionClosed || 
                          reason === DisconnectReason.connectionLost) {
                    console.log("🔁 Reconnecting...");
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
                } else if (reason === DisconnectReason.connectionReplaced) {
                    console.log("🔄 Connection replaced");
                    currentSessionId = null;
                    process.exit(0);
                } else if (reason === DisconnectReason.loggedOut) {
                    console.log("🚪 Logged out");
                    try {
                        await fs.remove(__dirname + "/gift/session");
                    } catch (e) {
                        console.error("Failed to remove session:", e);
                    }
                    currentSessionId = null;
                    process.exit(0);
                } else if (reason === DisconnectReason.restartRequired || 
                          reason === DisconnectReason.timedOut) {
                    console.log("⏱️ Reconnecting...");
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
                } else {
                    console.log(`❓ Unknown disconnect: ${reason}, reconnecting...`);
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
                }
            }
        });

        const cleanup = () => {
            if (store) {
                store.destroy();
            }
            if (Gifted) {
                Gifted.end(undefined);
            }
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

    } catch (error) {
        console.error('❌ Socket initialization error:', error.message);
        console.error('Stack:', error.stack);
        setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
    }
}

async function reconnectWithRetry() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('❌ Max reconnection attempts reached. Please restart.');
        return;
    }

    reconnectAttempts++;
    const delay = Math.min(RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts - 1), 60000);
    
    console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);
    
    setTimeout(async () => {
        try {
            await startGifted();
        } catch (error) {
            console.error('❌ Reconnection failed:', error.message);
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectWithRetry();
            }
        }
    }, delay);
}

// Start the bot if we have a session ID from environment
if (process.env.SESSION_ID) {
    currentSessionId = process.env.SESSION_ID;
    setTimeout(() => {
        startGifted().catch(console.error);
    }, 2000);
}

// Export for testing
module.exports = { app, startGifted };
