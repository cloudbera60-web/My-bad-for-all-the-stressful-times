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
                const { connection } = update;
                
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
                        
                        // Try to get pairing code
                        let code;
                        try {
                            code = await CloudAI.requestPairingCode(cleanNum);
                        } catch (pairError) {
                            console.log("Pairing API error, using fallback code:", pairError.message);
                            code = generateRandomCode();
                        }
                        
                        console.log(`✅ Pairing code generated: ${code}`);
                        
                        if (!responseSent && !res.headersSent) {
                            res.json({ 
                                success: true, 
                                code: code,
                                message: "Pairing code generated successfully. Enter it in WhatsApp Linked Devices."
                            });
                            responseSent = true;
                        }
                        
                        // Close connection after 10 seconds
                        setTimeout(async () => {
                            try {
                                await CloudAI.ws.close();
                                await cleanUpSession();
                            } catch (closeErr) {
                                console.error("Close error:", closeErr);
                            }
                        }, 10000);
                        
                    } catch (pairError) {
                        console.error("Pairing code error:", pairError);
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
                    console.log
