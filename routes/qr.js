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
    delay,
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
            const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionDir, id));
            
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
                                        * {
                                            margin: 0;
                                            padding: 0;
                                            box-sizing: border-box;
                                            font-family: 'Segoe UI', Arial, sans-serif;
                                        }
                                        
                                        body {
                                            background: linear-gradient(135deg, #0d1b2a 0%, #1b263b 100%);
                                            color: #e0e1dd;
                                            min-height: 100vh;
                                            display: flex;
                                            justify-content: center;
                                            align-items: center;
                                            padding: 20px;
                                        }
                                        
                                        .container {
                                            background: rgba(255, 255, 255, 0.05);
                                            backdrop-filter: blur(10px);
                                            border-radius: 20px;
                                            padding: 40px;
                                            text-align: center;
                                            max-width: 500px;
                                            width: 100%;
                                            border: 1px solid rgba(58, 134, 255, 0.2);
                                            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                                            animation: fadeIn 0.5s ease;
                                        }
                                        
                                        @keyframes fadeIn {
                                            from { opacity: 0; transform: translateY(20px); }
                                            to { opacity: 1; transform: translateY(0); }
                                        }
                                        
                                        h1 {
                                            background: linear-gradient(135deg, #3a86ff, #06d6a0);
                                            -webkit-background-clip: text;
                                            background-clip: text;
                                            color: transparent;
                                            margin-bottom: 20px;
                                            font-size: 2.5rem;
                                            font-weight: 800;
                                        }
                                        
                                        .qr-container {
                                            background: white;
                                            padding: 20px;
                                            border-radius: 15px;
                                            display: inline-block;
                                            margin: 25px 0;
                                            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
                                            animation: pulse 2s infinite;
                                        }
                                        
                                        @keyframes pulse {
                                            0% { box-shadow: 0 5px 20px rgba(58, 134, 255, 0.4); }
                                            50% { box-shadow: 0 5px 30px rgba(58, 134, 255, 0.6); }
                                            100% { box-shadow: 0 5px 20px rgba(58, 134, 255, 0.4); }
                                        }
                                        
                                        .qr-container img {
                                            width: 250px;
                                            height: 250px;
                                            border-radius: 10px;
                                        }
                                        
                                        p {
                                            color: #8d99ae;
                                            margin: 15px 0;
                                            line-height: 1.6;
                                            font-size: 1.1rem;
                                        }
                                        
                                        .instructions {
                                            background: rgba(58, 134, 255, 0.1);
                                            padding: 20px;
                                            border-radius: 10px;
                                            margin: 25px 0;
                                            text-align: left;
                                        }
                                        
                                        .instructions h3 {
                                            color: #3a86ff;
                                            margin-bottom: 10px;
                                        }
                                        
                                        .instructions ol {
                                            padding-left: 20px;
                                            color: #e0e1dd;
                                        }
                                        
                                        .instructions li {
                                            margin-bottom: 8px;
                                        }
                                        
                                        .back-btn {
                                            display: inline-block;
                                            background: linear-gradient(135deg, #3a86ff, #4361ee);
                                            color: white;
                                            padding: 12px 30px;
                                            border-radius: 25px;
                                            text-decoration: none;
                                            font-weight: 600;
                                            margin-top: 20px;
                                            transition: all 0.3s ease;
                                            border: none;
                                            cursor: pointer;
                                        }
                                        
                                        .back-btn:hover {
                                            transform: translateY(-3px);
                                            box-shadow: 0 10px 25px rgba(58, 134, 255, 0.4);
                                        }
                                        
                                        .success {
                                            display: none;
                                            background: rgba(6, 214, 160, 0.1);
                                            padding: 20px;
                                            border-radius: 10px;
                                            margin: 20px 0;
                                            border: 2px solid #06d6a0;
                                            animation: fadeIn 0.5s;
                                        }
                                        
                                        .success i {
                                            font-size: 2.5rem;
                                            color: #06d6a0;
                                            margin-bottom: 10px;
                                        }
                                    </style>
                                </head>
                                <body>
                                    <div class="container">
                                        <h1>🤖 CLOUD AI</h1>
                                        <p>Scan this QR code with WhatsApp to connect</p>
                                        
                                        <div class="qr-container">
                                            <img src="${qrImage}" alt="QR Code"/>
                                        </div>
                                        
                                        <div class="instructions">
                                            <h3>📱 How to connect:</h3>
                                            <ol>
                                                <li>Open WhatsApp on your phone</li>
                                                <li>Tap Menu → Linked Devices</li>
                                                <li>Tap on "Link a Device"</li>
                                                <li>Point your camera at the QR code</li>
                                                <li>Wait for connection confirmation</li>
                                            </ol>
                                        </div>
                                        
                                        <p style="color: #3a86ff; font-weight: 600;">
                                            ⚡ QR code will refresh automatically
                                        </p>
                                        
                                        <a href="/" class="back-btn">
                                            <i class="fas fa-arrow-left"></i> Back to Home
                                        </a>
                                        
                                        <div class="success" id="success">
                                            <i class="fas fa-check-circle"></i>
                                            <h3>✅ Connected Successfully!</h3>
                                            <p>Cloud AI bot is now active. Use <strong>.</strong> prefix for commands.</p>
                                        </div>
                                    </div>
                                    
                                    <script>
                                        // Auto-refresh QR every 30 seconds
                                        setTimeout(() => {
                                            location.reload();
                                        }, 30000);
                                        
                                        // Check for connection every 2 seconds
                                        setInterval(() => {
                                            fetch('/health').then(res => res.json()).then(data => {
                                                if (data.status === 200) {
                                                    document.getElementById('success').style.display = 'block';
                                                    document.querySelector('.qr-container').style.display = 'none';
                                                    document.querySelector('.instructions').innerHTML = 
                                                        '<h3>✅ Connection Established!</h3>' +
                                                        '<p>Cloud AI bot is now connected to your WhatsApp.<br>' +
                                                        'You can start using commands with prefix <strong>.</strong></p>' +
                                                        '<p style="color: #06d6a0; margin-top: 10px;">' +
                                                        'Try: <code>.ping</code> to test the bot</p>';
                                                }
                                            }).catch(() => {});
                                        }, 2000);
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
                    
                    // Keep the session for main bot
                    console.log("🤖 Bot session ready for main instance");
                    
                    // Don't send response here, QR page handles it
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
