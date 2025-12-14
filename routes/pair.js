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

const sessionDir = path.join(__dirname, "..", "session");

router.get('/', async (req, res) => {
    const id = giftedId();
    let num = req.query.number;
    let responseSent = false;
    let sessionCleanedUp = false;

    if (!num) {
        return res.status(400).json({
            success: false,
            message: "Phone number is required"
        });
    }

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

            CloudAI.ev.on('creds.update', saveCreds);
            
            CloudAI.ev.on("connection.update", async (update) => {
                const { connection, qr } = update;
                
                // If not registered, request pairing code
                if (!state.creds.registered && !responseSent) {
                    await delay(1500);
                    
                    // Clean the phone number
                    const cleanNum = num.replace(/[^0-9]/g, '');
                    if (!cleanNum) {
                        if (!responseSent) {
                            res.status(400).json({ 
                                success: false, 
                                message: "Invalid phone number format" 
                            });
                            responseSent = true;
                        }
                        await CloudAI.ws.close();
                        return;
                    }
                    
                    try {
                        const randomCode = generateRandomCode();
                        console.log(`Requesting pairing code for: ${cleanNum} with random code: ${randomCode}`);
                        
                        const code = await CloudAI.requestPairingCode(cleanNum);
                        
                        console.log(`Pairing code generated: ${code}`);
                        
                        if (!responseSent && !res.headersSent) {
                            res.json({ 
                                success: true, 
                                code: code || randomCode,
                                message: "Pairing code generated successfully"
                            });
                            responseSent = true;
                        }
                        
                        // Close connection after sending code
                        setTimeout(async () => {
                            try {
                                await CloudAI.ws.close();
                            } catch (closeErr) {
                                console.error("Error closing connection:", closeErr);
                            }
                        }, 5000);
                        
                    } catch (pairError) {
                        console.error("Pairing code error:", pairError);
                        if (!responseSent && !res.headersSent) {
                            res.status(500).json({ 
                                success: false, 
                                message: "Failed to generate pairing code. Please try again."
                            });
                            responseSent = true;
                        }
                    }
                }

                if (connection === "open") {
                    console.log("✅ Cloud AI Connected via Pair Code");
                    
                    // Send welcome message
                    try {
                        await CloudAI.sendMessage(CloudAI.user.id, {
                            text: `*🤖 Cloud AI Activated!*\n\nYour WhatsApp is now connected to Cloud AI bot.\n\nUse *${config.PREFIX}* to access commands.\n\nType *${config.PREFIX}help* to see available commands.`
                        });
                    } catch (msgError) {
                        console.error("Welcome message error:", msgError);
                    }
                    
                    if (!responseSent && !res.headersSent) {
                        res.json({
                            success: true,
                            message: "Cloud AI bot activated successfully!",
                            status: "connected"
                        });
                        responseSent = true;
                    }
                    
                    // Keep the connection alive
                    // The main bot instance in main.js will handle the actual bot operations
                } else if (connection === "close") {
                    await cleanUpSession();
                }
            });

            // Timeout for pairing code request
            setTimeout(async () => {
                if (!responseSent && !res.headersSent) {
                    res.status(408).json({ 
                        success: false, 
                        message: "Pairing request timeout" 
                    });
                    responseSent = true;
                    
                    try {
                        await CloudAI.ws.close();
                    } catch (closeErr) {
                        console.error("Timeout close error:", closeErr);
                    }
                    await cleanUpSession();
                }
            }, 30000);

        } catch (err) {
            console.error("Pairing setup error:", err);
            if (!responseSent && !res.headersSent) {
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
        if (!responseSent && !res.headersSent) {
            res.status(500).json({ 
                success: false, 
                message: "Service error occurred." 
            });
        }
    }
});

module.exports = router;
