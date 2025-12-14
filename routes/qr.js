const { giftedId, removeFile } = require('../gift');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const router = express.Router();
const pino = require("pino");

const {
    default: giftedConnect,
    useMultiFileAuthState,
    Browsers,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const sessionDir = path.join(__dirname, "..", "session");

router.get('/', async (req, res) => {
    const id = giftedId();
    let responseSent = false;

    async function cleanUpSession() {
        try {
            await removeFile(path.join(sessionDir, id));
        } catch (error) {
            console.error("QR cleanup error:", error);
        }
    }

    async function CLOUD_AI_QR() {
        try {
            const { version } = await fetchLatestBaileysVersion();
            const { state } = await useMultiFileAuthState(path.join(sessionDir, id));
            
            let CloudAI = giftedConnect({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"),
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000
            });
            
            CloudAI.ev.on("connection.update", async (update) => {
                const { connection, qr } = update;
                
                if (qr && !responseSent) {
                    try {
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
                                            background: #0d1b2a;
                                            color: #e0e1dd;
                                            font-family: Arial, sans-serif;
                                            text-align: center;
                                            padding: 20px;
                                            display: flex;
                                            justify-content: center;
                                            align-items: center;
                                            min-height: 100vh;
                                            margin: 0;
                                        }
                                        .container {
                                            max-width: 500px;
                                            width: 100%;
                                            padding: 30px;
                                            background: rgba(255, 255, 255, 0.05);
                                            border-radius: 20px;
                                            border: 1px solid rgba(58, 134, 255, 0.2);
                                        }
                                        h1 {
                                            color: #3a86ff;
                                            margin-bottom: 20px;
                                        }
                                        .qr-code {
                                            background: white;
                                            padding: 20px;
                                            border-radius: 15px;
                                            display: inline-block;
                                            margin: 20px 0;
                                        }
                                        .qr-code img {
                                            width: 250px;
                                            height: 250px;
                                        }
                                        p {
                                            color: #8d99ae;
                                            margin: 15px 0;
                                        }
                                        .back-btn {
                                            display: inline-block;
                                            background: #3a86ff;
                                            color: white;
                                            padding: 10px 25px;
                                            border-radius: 25px;
                                            text-decoration: none;
                                            margin-top: 20px;
                                        }
                                    </style>
                                </head>
                                <body>
                                    <div class="container">
                                        <h1>🤖 CLOUD AI</h1>
                                        <p>Scan QR Code with WhatsApp</p>
                                        <div class="qr-code">
                                            <img src="${qrImage}" alt="QR Code"/>
                                        </div>
                                        <p>Open WhatsApp → Linked Devices → Scan QR Code</p>
                                        <a href="/" class="back-btn">Back to Home</a>
                                    </div>
                                    <script>
                                        setTimeout(() => location.reload(), 30000);
                                    </script>
                                </body>
                                </html>
                            `);
                            responseSent = true;
                        }
                    } catch (qrError) {
                        console.error("QR generation error:", qrError);
                        if (!responseSent) {
                            res.status(500).json({ error: "QR generation failed" });
                            responseSent = true;
                        }
                        await cleanUpSession();
                    }
                }

                if (connection === "open") {
                    console.log("✅ WhatsApp Connected via QR");
                    
                    // Send welcome message
                    try {
                        await CloudAI.sendMessage(CloudAI.user.id, {
                            text: `*🤖 CLOUD AI Activated!*\n\nYour WhatsApp is now connected to Cloud AI bot.\n\nUse *.* to access commands.\n\nType *.help* to see available commands.\n\nEnjoy! 🚀`
                        });
                    } catch (msgError) {
                        console.error("Welcome message error:", msgError);
                    }
                    
                    // Don't close the connection
                    console.log("🤖 Bot session maintained for main instance");
                }
            });

        } catch (err) {
            console.error("QR error:", err);
            if (!responseSent) {
                res.status(500).json({ error: "QR service failed" });
                responseSent = true;
            }
            await cleanUpSession();
        }
    }

    try {
        await CLOUD_AI_QR();
    } catch (error) {
        console.error("Final QR error:", error);
        await cleanUpSession();
        if (!responseSent) {
            res.status(500).json({ error: "Service error" });
        }
    }
});

module.exports = router;
