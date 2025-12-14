const { 
    giftedId,
    removeFile,
    generateRandomCode
} = require('../gift');
const express = require('express');
const fs = require('fs');
const path = require('path');
let router = express.Router();
const pino = require("pino");
const {
    default: giftedConnect,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

const sessionDir = path.join(__dirname, "..", "session");

// Serve HTML page if no number parameter
router.get('/', async (req, res) => {
    const num = req.query.number;
    
    // If no number provided, serve HTML page
    if (!num) {
        return res.sendFile(path.join(__dirname, '..', 'public', 'pair.html'));
    }
    
    // If number provided, process pairing
    const id = giftedId();
    let responseSent = false;
    let sessionCleanedUp = false;

    async function cleanUpSession() {
        if (!sessionCleanedUp) {
            try {
                await removeFile(path.join(sessionDir, id));
            } catch (cleanupError) {
                console.error("Cleanup error:", cleanupError);
            }
            sessionCleanedUp = true;
        }
    }

    async function CLOUD_AI_PAIR() {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionDir, id));
        
        try {
            let Gifted = giftedConnect({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
                syncFullHistory: false,
                generateHighQualityLinkPreview: true,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000
            });

            if (!Gifted.authState.creds.registered) {
                await delay(1500);
                const cleanNum = num.replace(/[^0-9]/g, '');
                
                // Use the same pairing code method as your working code
                const randomCode = generateRandomCode();
                const code = await Gifted.requestPairingCode(cleanNum);
                
                if (!responseSent && !res.headersSent) {
                    res.json({ 
                        code: code,
                        success: true,
                        message: "Pairing code generated"
                    });
                    responseSent = true;
                }
            }

            Gifted.ev.on('creds.update', saveCreds);
            Gifted.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    console.log("✅ WhatsApp Connected via Pair Code");
                    
                    // Send welcome message
                    await Gifted.sendMessage(Gifted.user.id, {
                        text: `*🤖 CLOUD AI Activated!*\n\nYour WhatsApp is now connected to Cloud AI bot.\n\nUse *.* to access commands.\n\nType *.help* to see available commands.\n\nEnjoy! 🚀`
                    });

                    // Keep connection alive for 30 seconds then close
                    await delay(30000);
                    await Gifted.ws.close();
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error) {
                    console.log("Connection closed");
                    await cleanUpSession();
                }
            });

        } catch (err) {
            console.error("Main error:", err);
            if (!responseSent && !res.headersSent) {
                res.status(500).json({ 
                    code: "Service is Currently Unavailable",
                    success: false
                });
                responseSent = true;
            }
            await cleanUpSession();
        }
    }

    try {
        await CLOUD_AI_PAIR();
    } catch (finalError) {
        console.error("Final error:", finalError);
        await cleanUpSession();
        if (!responseSent && !res.headersSent) {
            res.status(500).json({ 
                code: "Service Error",
                success: false
            });
        }
    }
});

module.exports = router;
