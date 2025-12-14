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
                                            transition: all 0
