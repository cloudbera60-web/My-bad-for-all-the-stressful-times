const { giftedId, removeFile } = require('../gift');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
let router = express.Router();
const pino = require("pino");

const {
    default: giftedConnect,
    useMultiFileAuthState,
    Browsers,
    delay,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const sessionDir = path.join(__dirname, "session");

router.get('/', async (req, res) => {
    const id = giftedId();
    let responseSent = false;

    async function cleanUpSession() {
        await removeFile(path.join(sessionDir, id));
    }

    async function CLOUD_AI_QR() {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionDir, id));
        
        try {
            let CloudAI = giftedConnect({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"),
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000
            });

            CloudAI.ev.on('creds.update', saveCreds);
            
            CloudAI.ev.on("connection.update", async (update) => {
                const { connection, qr } = update;
                
                if (qr && !responseSent) {
                    const qrImage = await QRCode.toDataURL(qr);
                    if (!res.headersSent) {
                        res.send(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>CLOUD AI | QR CODE</title>
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <style>
                                    body {
                                        background: #0a0a0a;
                                        color: white;
                                        font-family: Arial, sans-serif;
                                        text-align: center;
                                        padding: 20px;
                                    }
                                    .container {
                                        max-width: 400px;
                                        margin: 50px auto;
                                        padding: 30px;
                                        background: rgba(255,255,255,0.05);
                                        border-radius: 20px;
                                        backdrop-filter: blur(10px);
                                    }
                                    h1 {
                                        color: #7b2cbf;
                                        margin-bottom: 20px;
                                    }
                                    .qr-code {
                                        background: white;
                                        padding: 20px;
                                        border-radius: 10px;
                                        display: inline-block;
                                        margin: 20px 0;
                                    }
                                    .success {
                                        color: #4CAF50;
                                        display: none;
                                        padding: 20px;
                                        background: rgba(76,175,80,0.1);
                                        border-radius: 10px;
                                        margin: 20px 0;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <h1>🤖 CLOUD AI</h1>
                                    <p>Scan QR Code with WhatsApp</p>
                                    <div class="qr-code">
                                        <img src="${qrImage}" alt="QR Code" width="250"/>
                                    </div>
                                    <div id="success" class="success">
                                        ✅ Connected! Bot is now active.
                                    </div>
                                    <p>Scan then wait for connection...</p>
                                </div>
                                <script>
                                    // Auto-refresh QR if needed
                                    setTimeout(() => {
                                        location.reload();
                                    }, 30000);
                                </script>
                            </body>
                            </html>
                        `);
                        responseSent = true;
                    }
                }

                if (connection === "open") {
                    console.log("✅ Cloud AI Connected via QR");
                    
                    // Send welcome message
                    await CloudAI.sendMessage(CloudAI.user.id, {
                        text: `*🤖 Cloud AI Activated!*\n\nYour WhatsApp is now connected to Cloud AI bot.\n\nUse *.* to access commands.\n\nType *.help* to see available commands.`
                    });

                    // Send success response to browser
                    if (!res.headersSent) {
                        res.send(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>CLOUD AI | Connected</title>
                                <style>
                                    body {
                                        background: #0a0a0a;
                                        color: white;
                                        font-family: Arial, sans-serif;
                                        text-align: center;
                                        padding: 50px;
                                    }
                                    .success {
                                        color: #4CAF50;
                                        font-size: 24px;
                                        margin: 20px 0;
                                    }
                                    .info {
                                        background: rgba(123,44,191,0.1);
                                        padding: 20px;
                                        border-radius: 10px;
                                        margin: 30px auto;
                                        max-width: 400px;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="success">✅ CONNECTED SUCCESSFULLY!</div>
                                <div class="info">
                                    <h3>🤖 Cloud AI is now active</h3>
                                    <p>Your WhatsApp is connected to Cloud AI bot.</p>
                                    <p>Use <strong>.</strong> prefix for commands</p>
                                    <p>Example: <code>.ping</code></p>
                                </div>
                                <a href="/" style="color: #7b2cbf;">← Back to Home</a>
                            </body>
                            </html>
                        `);
                    }
                    
                    // Keep bot running - no cleanup
                    // The bot will continue running
                }
            });

        } catch (err) {
            console.error("QR error:", err);
            if (!responseSent) {
                res.status(500).json({ error: "QR generation failed" });
                responseSent = true;
            }
            await cleanUpSession();
        }
    }

    try {
        await CLOUD_AI_QR();
    } catch (error) {
        console.error("Final error:", error);
        await cleanUpSession();
        if (!responseSent) {
            res.status(500).json({ error: "Service error" });
        }
    }
});

module.exports = router;
