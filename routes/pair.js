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

router.get('/', async (req, res) => {
    const num = req.query.number;
    
    if (!num) {
        return res.status(400).json({
            success: false,
            message: "Phone number is required"
        });
    }
    
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
        try {
            const { version } = await fetchLatestBaileysVersion();
            const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionDir, id));
            
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

            // If not registered, request pairing code
            if (!state.creds.registered) {
                await delay(2000);
                
                const cleanNum = num.replace(/[^0-9]/g, '');
                
                if (!cleanNum || cleanNum.length < 10) {
                    if (!responseSent) {
                        res.json({ 
                            success: false,
                            message: "Invalid phone number format" 
                        });
                        responseSent = true;
                    }
                    await Gifted.ws.close();
                    return;
                }
                
                try {
                    console.log(`Requesting pairing code for: ${cleanNum}`);
                    
                    // Generate pairing code
                    const code = await Gifted.requestPairingCode(cleanNum);
                    
                    console.log(`Pairing code generated: ${code}`);
                    
                    if (!responseSent) {
                        res.json({ 
                            success: true,
                            code: code,
                            message: "Pairing code generated successfully"
                        });
                        responseSent = true;
                    }
                    
                    // Close connection after sending code
                    setTimeout(async () => {
                        try {
                            await Gifted.ws.close();
                            await cleanUpSession();
                        } catch (closeErr) {
                            console.error("Error closing connection:", closeErr);
                        }
                    }, 5000);
                    
                } catch (pairError) {
                    console.error("Pairing code error:", pairError);
                    if (!responseSent) {
                        res.json({ 
                            success: false,
                            message: "Failed to generate pairing code. Please try again."
                        });
                        responseSent = true;
                    }
                    await cleanUpSession();
                }
            } else {
                // Already registered
                if (!responseSent) {
                    res.json({ 
                        success: false,
                        message: "Already registered. Please use QR code instead."
                    });
                    responseSent = true;
                }
            }

            Gifted.ev.on('creds.update', saveCreds);
            
            Gifted.ev.on("connection.update", async (update) => {
                const { connection } = update;

                if (connection === "open") {
                    console.log("✅ WhatsApp Connected via Pair Code");
                    
                    // Send welcome message
                    try {
                        await Gifted.sendMessage(Gifted.user.id, {
                            text: `*🤖 CLOUD AI Activated!*\n\nYour WhatsApp is now connected to Cloud AI bot.\n\nUse *.* to access commands.\n\nType *.help* to see available commands.`
                        });
                    } catch (msgError) {
                        console.error("Welcome message error:", msgError);
                    }
                    
                    if (!responseSent) {
                        res.json({
                            success: true,
                            message: "Cloud AI bot activated successfully!",
                            status: "connected"
                        });
                        responseSent = true;
                    }
                    
                    // Keep connection alive for bot
                    console.log("🤖 Bot connection maintained");
                }
            });

            // Timeout handling
            setTimeout(async () => {
                if (!responseSent) {
                    res.json({ 
                        success: false,
                        message: "Request timeout. Please try again." 
                    });
                    responseSent = true;
                    
                    try {
                        await Gifted.ws.close();
                    } catch (e) {}
                    await cleanUpSession();
                }
            }, 30000);

        } catch (err) {
            console.error("Pairing setup error:", err);
            if (!responseSent) {
                res.status(500).json({ 
                    success: false,
                    message: "Setup failed. Please try again." 
                });
                responseSent = true;
            }
            await cleanUpSession();
        }
    }

    try {
        await CLOUD_AI_PAIR();
    } catch (error) {
        console.error("Final pairing error:", error);
        await cleanUpSession();
        if (!responseSent) {
            res.status(500).json({ 
                success: false,
                message: "Service error occurred." 
            });
        }
    }
});

module.exports = router;
