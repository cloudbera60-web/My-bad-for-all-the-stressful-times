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

// Serve HTML page for GET request without number
router.get('/', async (req, res) => {
    const num = req.query.number;
    
    // If no number provided, serve the HTML page
    if (!num) {
        return res.sendFile(path.join(__dirname, '..', 'public', 'pair.html'));
    }
    
    // If number provided, process pairing
    const id = giftedId();
    let responseSent = false;

    async function cleanUpSession() {
        try {
            await removeFile(path.join(sessionDir, id));
        } catch (cleanupError) {
            console.error("Cleanup error:", cleanupError);
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
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
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
            
            let pairingTimeout;
            
            CloudAI.ev.on("connection.update", async (update) => {
                const { connection, qr } = update;
                
                // Handle QR code if needed
                if (qr) {
                    console.log("📱 QR Code generated");
                }
                
                // If not registered, request pairing code
                if (!state.creds.registered && !responseSent) {
                    await delay(2000);
                    
                    // Clean the phone number
                    const cleanNum = num.replace(/[^0-9]/g, '');
                    if (!cleanNum || cleanNum.length < 10) {
                        if (!responseSent) {
                            res.json({ 
                                success: false, 
                                message: "Invalid phone number. Must be at least 10 digits." 
                            });
                            responseSent = true;
                        }
                        try {
                            await CloudAI.ws.close();
                        } catch (e) {}
                        await cleanUpSession();
                        return;
                    }
                    
                    try {
                        console.log(`🔑 Requesting pairing code for: ${cleanNum}`);
                        
                        // Use the same method as your working code
                        const code = await CloudAI.requestPairingCode(cleanNum);
                        
                        console.log(`✅ Pairing code generated: ${code}`);
                        
                        if (!responseSent && !res.headersSent) {
                            res.json({ 
                                success: true, 
                                code: code,
                                message: "Pairing code generated successfully. Enter it in WhatsApp Linked Devices."
                            });
                            responseSent = true;
                        }
                        
                        // Setup timeout for connection
                        pairingTimeout = setTimeout(async () => {
                            if (CloudAI) {
                                try {
                                    await CloudAI.ws.close();
                                } catch (e) {}
                            }
                            await cleanUpSession();
                            console.log("⏰ Pairing session timeout");
                        }, 120000); // 2 minutes timeout
                        
                    } catch (pairError) {
                        console.error("❌ Pairing code error:", pairError);
                        if (!responseSent && !res.headersSent) {
                            res.json({ 
                                success: false, 
                                message: "Failed to generate pairing code. Please try again." 
                            });
                            responseSent = true;
                        }
                        await cleanUpSession();
                    }
                }

                if (connection === "open") {
                    console.log("✅ WhatsApp Connected via Pair Code");
                    
                    // Clear pairing timeout
                    if (pairingTimeout) {
                        clearTimeout(pairingTimeout);
                    }
                    
                    // Send welcome message
                    try {
                        await CloudAI.sendMessage(CloudAI.user.id, {
                            text: `*🤖 CLOUD AI Activated!*\n\nYour WhatsApp is now connected to Cloud AI bot.\n\nUse *.* to access commands.\n\nType *.help* to see available commands.\n\nEnjoy! 🚀`
                        });
                    } catch (msgError) {
                        console.error("Welcome message error:", msgError);
                    }
                    
                    if (!responseSent && !res.headersSent) {
                        res.json({
                            success: true,
                            message: "✅ Cloud AI bot activated! You can now use commands.",
                            status: "connected"
                        });
                        responseSent = true;
                    }
                    
                    // Keep the session alive for main bot
                    console.log("🤖 Bot session maintained for main instance");
                    
                    // Don't close the connection - let it stay alive
                    // The main bot will use this session
                }
                
                if (connection === "close") {
                    console.log("🔌 Pairing connection closed");
                    if (pairingTimeout) {
                        clearTimeout(pairingTimeout);
                    }
                    await cleanUpSession();
                }
            });

            // Overall timeout handling
            setTimeout(async () => {
                if (!responseSent && !res.headersSent) {
                    res.json({ 
                        success: false, 
                        message: "Request timeout. Please try again." 
                    });
                    responseSent = true;
                    
                    try {
                        await CloudAI.ws.close();
                    } catch (e) {}
                    await cleanUpSession();
                }
            }, 60000); // 1 minute overall timeout

        } catch (err) {
            console.error("❌ Pairing setup error:", err);
            if (!responseSent && !res.headersSent) {
                res.json({ 
                    success: false, 
                    message: "Setup failed. Server error." 
                });
                responseSent = true;
            }
            await cleanUpSession();
        }
    }

    try {
        await CLOUD_AI_PAIR();
    } catch (error) {
        console.error("❌ Final pairing error:", error);
        await cleanUpSession();
        if (!responseSent && !res.headersSent) {
            res.json({ 
                success: false, 
                message: "Service error occurred. Please try again." 
            });
        }
    }
});

module.exports = router;
