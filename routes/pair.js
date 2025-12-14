const { giftedId, removeFile, generateRandomCode } = require('../gift');
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pino = require("pino");

const {
    default: giftedConnect,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

const sessionDir = path.join(__dirname, "session");

router.get('/', async (req, res) => {
    const id = giftedId();
    let num = req.query.number;
    let responseSent = false;

    async function cleanUpSession() {
        try {
            await removeFile(path.join(sessionDir, id));
        } catch (error) {
            console.error("Cleanup error:", error);
        }
    }

    async function CLOUD_AI_PAIR() {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionDir, id));
        
        try {
            let CloudAI = giftedConnect({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
                syncFullHistory: false,
                generateHighQualityLinkPreview: true,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000
            });

            if (!CloudAI.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const randomCode = generateRandomCode();
                const code = await CloudAI.requestPairingCode(num, randomCode);
                
                if (!responseSent && !res.headersSent) {
                    res.json({ 
                        success: true, 
                        code: code,
                        message: "Pairing code generated. Enter it in WhatsApp linked devices."
                    });
                    responseSent = true;
                }
            }

            CloudAI.ev.on('creds.update', saveCreds);
            
            CloudAI.ev.on("connection.update", async (update) => {
                const { connection } = update;

                if (connection === "open") {
                    console.log("✅ Cloud AI Connected via Pair Code");
                    
                    // Send welcome message
                    await CloudAI.sendMessage(CloudAI.user.id, {
                        text: `*🤖 Cloud AI Activated!*\n\nYour WhatsApp is now connected to Cloud AI bot.\n\nUse *.* to access commands.\n\nType *.help* to see available commands.`
                    });

                    // Keep the bot running
                    // The bot will now handle commands normally
                    
                    if (!responseSent && !res.headersSent) {
                        res.json({
                            success: true,
                            message: "Cloud AI bot activated successfully!",
                            status: "connected"
                        });
                        responseSent = true;
                    }
                }
            });

        } catch (err) {
            console.error("Pairing error:", err);
            if (!responseSent && !res.headersSent) {
                res.status(500).json({ 
                    success: false, 
                    message: "Pairing failed. Please try again." 
                });
                responseSent = true;
            }
            await cleanUpSession();
        }
    }

    try {
        await CLOUD_AI_PAIR();
    } catch (error) {
        console.error("Final error:", error);
        await cleanUpSession();
        if (!responseSent && !res.headersSent) {
            res.status(500).json({ 
                success: false, 
                message: "Service error occurred." 
            });
        }
    }
});

module.exports = router;
