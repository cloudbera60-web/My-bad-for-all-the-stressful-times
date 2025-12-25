const { 
    default: makeWASocket, 
    useMultiFileAuthState,
    Browsers,
    delay,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require('fs');
const path = require('path');
const mongoDB = require('./mongodb');
const whatsappHandler = require('./whatsapp-handler');

class WhatsAppManager {
    constructor() {
        this.activeSockets = new Map();
        this.sessionDir = path.join(__dirname, 'session');
        this.ensureSessionDir();
    }

    ensureSessionDir() {
        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir, { recursive: true });
        }
    }

    async createConnection(sessionId, phoneNumber = null) {
        try {
            console.log(`🔗 Creating WhatsApp connection for session: ${sessionId}`);
            
            // Try to load from MongoDB first
            let authState = null;
            const savedSession = await mongoDB.getSession(sessionId);
            
            if (savedSession) {
                console.log(`📂 Loaded session from MongoDB: ${sessionId}`);
                authState = {
                    creds: savedSession.creds,
                    keys: makeCacheableSignalKeyStore(savedSession.keys, pino({ level: "fatal" }))
                };
            } else {
                // Fall back to file-based session
                console.log(`📁 Using file-based session: ${sessionId}`);
                const sessionPath = path.join(this.sessionDir, sessionId);
                if (!fs.existsSync(sessionPath)) {
                    fs.mkdirSync(sessionPath, { recursive: true });
                }
                authState = await useMultiFileAuthState(sessionPath);
            }

            const { version } = await fetchLatestBaileysVersion();
            
            const sock = makeWASocket({
                version,
                auth: authState,
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Desktop"),
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                syncFullHistory: false,
                generateHighQualityLinkPreview: true,
                shouldIgnoreJid: jid => jid?.endsWith('@g.us'),
                getMessage: async () => undefined,
                markOnlineOnConnect: true
            });

            // Handle credentials update
            sock.ev.on('creds.update', async (creds) => {
                try {
                    if (savedSession) {
                        // Update MongoDB
                        await mongoDB.saveSession(sessionId, phoneNumber, creds, authState.keys);
                    } else {
                        // Update file-based session
                        const sessionPath = path.join(this.sessionDir, sessionId, 'creds.json');
                        await fs.promises.writeFile(sessionPath, JSON.stringify(creds, null, 2));
                    }
                } catch (error) {
                    console.error('❌ Error updating credentials:', error.message);
                }
            });

            // Handle connection updates
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (connection === 'open') {
                    console.log(`✅ WhatsApp connected for session: ${sessionId}`);
                    
                    // Save to MongoDB if not already saved
                    if (!savedSession) {
                        const sessionPath = path.join(this.sessionDir, sessionId, 'creds.json');
                        if (fs.existsSync(sessionPath)) {
                            const creds = JSON.parse(await fs.promises.readFile(sessionPath, 'utf-8'));
                            await mongoDB.saveSession(sessionId, phoneNumber, creds, authState.keys);
                        }
                    }
                    
                    // Join the group if not already a member
                    try {
                        await sock.groupAcceptInvite("GiD4BYjebncLvhr0J2SHAg");
                        console.log(`✅ Joined group for session: ${sessionId}`);
                    } catch (groupError) {
                        console.log(`ℹ️ Already in group or invite invalid for session: ${sessionId}`);
                    }
                    
                    // Send welcome message to self
                    if (sock.user?.id) {
                        await whatsappHandler.sendWelcomeMessage(sock, sock.user.id);
                    }
                }
                
                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    console.log(`🔌 Connection closed for session: ${sessionId}, Status: ${statusCode}`);
                    
                    if (statusCode === 401) {
                        // Session expired, clean up
                        await this.cleanupSession(sessionId);
                    } else {
                        // Try to reconnect
                        setTimeout(() => {
                            if (!this.activeSockets.has(sessionId)) {
                                this.createConnection(sessionId, phoneNumber);
                            }
                        }, 5000);
                    }
                }
            });

            // Handle messages
            sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type === 'notify') {
                    for (const message of messages) {
                        await whatsappHandler.handleMessage(sock, message);
                    }
                }
            });

            // Store socket reference
            this.activeSockets.set(sessionId, sock);
            
            return sock;
        } catch (error) {
            console.error(`❌ Error creating connection for session ${sessionId}:`, error.message);
            throw error;
        }
    }

    async cleanupSession(sessionId) {
        try {
            // Close socket if active
            const sock = this.activeSockets.get(sessionId);
            if (sock) {
                await sock.ws.close();
                this.activeSockets.delete(sessionId);
            }
            
            // Mark as inactive in MongoDB
            await mongoDB.deactivateSession(sessionId);
            
            // Clean up local files
            const sessionPath = path.join(this.sessionDir, sessionId);
            if (fs.existsSync(sessionPath)) {
                await fs.promises.rm(sessionPath, { recursive: true, force: true });
            }
            
            console.log(`🧹 Cleaned up session: ${sessionId}`);
        } catch (error) {
            console.error(`❌ Error cleaning up session ${sessionId}:`, error.message);
        }
    }

    async restoreActiveSessions() {
        try {
            const activeSessions = await mongoDB.getActiveSessions();
            console.log(`🔄 Restoring ${activeSessions.length} active sessions...`);
            
            for (const session of activeSessions) {
                try {
                    await this.createConnection(session.sessionId, session.phoneNumber);
                    await delay(2000); // Delay between restorations
                } catch (error) {
                    console.error(`❌ Failed to restore session ${session.sessionId}:`, error.message);
                }
            }
            
            console.log(`✅ Session restoration completed`);
        } catch (error) {
            console.error('❌ Error restoring sessions:', error.message);
        }
    }

    getActiveConnections() {
        return Array.from(this.activeSockets.entries()).map(([sessionId, sock]) => ({
            sessionId,
            user: sock.user,
            isConnected: sock.ws.readyState === 1
        }));
    }
}

// Create singleton instance
const whatsappManager = new WhatsAppManager();

// Export singleton
module.exports = whatsappManager;
