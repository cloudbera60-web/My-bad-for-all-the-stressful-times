const fs = require('fs');
const path = require('path');

// Generate random ID
function giftedId(num = 8) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < num; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Generate random pairing code
function generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Remove file/directory
async function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    try {
        await fs.promises.rm(FilePath, { recursive: true, force: true });
        return true;
    } catch (error) {
        console.error("Remove file error:", error);
        return false;
    }
}

// Load session data
function loadSession() {
    const sessionPath = path.join(__dirname, 'gift', 'session');
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }
    return sessionPath;
}

// Get sudo numbers
function getSudoNumbers() {
    try {
        const sudoPath = path.join(__dirname, 'gift', 'sudo.json');
        if (fs.existsSync(sudoPath)) {
            const data = fs.readFileSync(sudoPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error reading sudo numbers:", error);
    }
    return [];
}

// Set sudo number
function setSudo(number) {
    try {
        const sudoPath = path.join(__dirname, 'gift', 'sudo.json');
        const sudoNumbers = getSudoNumbers();
        if (!sudoNumbers.includes(number)) {
            sudoNumbers.push(number);
            fs.writeFileSync(sudoPath, JSON.stringify(sudoNumbers, null, 2));
            return true;
        }
    } catch (error) {
        console.error("Error setting sudo:", error);
    }
    return false;
}

// Delete sudo number
function delSudo(number) {
    try {
        const sudoPath = path.join(__dirname, 'gift', 'sudo.json');
        let sudoNumbers = getSudoNumbers();
        sudoNumbers = sudoNumbers.filter(n => n !== number);
        fs.writeFileSync(sudoPath, JSON.stringify(sudoNumbers, null, 2));
        return true;
    } catch (error) {
        console.error("Error deleting sudo:", error);
    }
    return false;
}

// Event system for commands
const evt = {
    commands: [],
    command: (pattern, options, func) => {
        evt.commands.push({
            pattern: typeof pattern === 'string' ? pattern.toLowerCase() : pattern,
            fromMe: options.fromMe || false,
            desc: options.desc || '',
            usage: options.usage || '',
            type: options.type || 'general',
            function: func
        });
    }
};

// Auto-react function
async function GiftedAutoReact(emoji, message, sock) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (error) {
        console.error("Auto-react error:", error);
    }
}

// Anti-link function
async function GiftedAntiLink(sock, message, mode) {
    try {
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text || '';
        
        const linkPatterns = ['http://', 'https://', 'www.', '.com', '.net', '.org', '.me'];
        const hasLink = linkPatterns.some(pattern => text.includes(pattern));
        
        if (hasLink) {
            const from = message.key.remoteJid;
            
            if (mode === 'delete') {
                try {
                    await sock.sendMessage(from, {
                        delete: message.key
                    });
                } catch (deleteErr) {
                    console.error("Delete message error:", deleteErr);
                }
                
                await sock.sendMessage(from, {
                    text: '⚠️ Links are not allowed here!'
                });
            } else if (mode === 'warn') {
                await sock.sendMessage(from, {
                    text: '⚠️ Please avoid sharing links in this chat!',
                    quoted: message
                });
            }
        }
    } catch (error) {
        console.error("Anti-link error:", error);
    }
}

// Auto-bio function
async function GiftedAutoBio(sock) {
    try {
        const statuses = [
            "🤖 CLOUD AI | Advanced WhatsApp Bot",
            "⚡ Powered by Cloud AI Technology",
            "🌟 .help for commands | .owner for support",
            "🚀 Running on Cloud Infrastructure",
            "💫 Connected via Web Services"
        ];
        
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        await sock.updateProfileStatus(randomStatus);
    } catch (error) {
        console.error("Auto-bio error:", error);
    }
}

// Anti-call function
async function GiftedAnticall(call, sock) {
    try {
        const from = call.from;
        await sock.updateBlockStatus(from, 'block');
        
        if (call.status === 'offer') {
            await sock.sendMessage(from, {
                text: '⚠️ Voice/Video calls are blocked by CLOUD AI bot for security reasons.'
            });
        }
    } catch (error) {
        console.error("Anti-call error:", error);
    }
}

// Presence function
async function GiftedPresence(sock, jid) {
    try {
        await sock.sendPresenceUpdate('available', jid);
    } catch (error) {
        console.error("Presence error:", error);
    }
}

// Anti-delete function (simplified version)
async function GiftedAntiDelete(sock, deletedMsg, key, deleter, originalSender, owner) {
    try {
        const report = `🚨 *MESSAGE DELETED DETECTED*
        
👤 *Deleted by:* ${deleter?.split('@')[0] || 'Unknown'}
💬 *In chat:* ${key.remoteJid}`;

        await sock.sendMessage(owner, { text: report });
    } catch (error) {
        console.error("Anti-delete error:", error);
    }
}

// Chatbot function (placeholder)
async function GiftedChatBot(sock, mode, chatMode, createContext, createContext2, googleTTS) {
    console.log(`Chatbot enabled in ${mode} mode`);
    // Add your chatbot logic here
}

// Context creation
function createContext(sender, options = {}) {
    return {
        contextInfo: {
            mentionedJid: [sender],
            externalAdReply: {
                title: options.title || 'CLOUD AI',
                body: options.body || 'Powered by Cloud AI Technology',
                thumbnailUrl: 'https://files.catbox.moe/52699c.jpg',
                sourceUrl: 'https://github.com/mauricegift/cloud-ai'
            }
        }
    };
}

function createContext2(sender, options = {}) {
    return {
        contextInfo: {
            mentionedJid: [sender],
            forwardingScore: 999,
            isForwarded: true,
            ...options
        }
    };
}

// Emojis for auto-react
const emojis = ["❤️", "😂", "😮", "😍", "🔥", "👏", "🎉", "🙏", "👌", "🤔", "👍"];

// Logger
const logger = {
    level: "info",
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args)
};

// Export all functions
module.exports = {
    giftedId,
    removeFile,
    generateRandomCode,
    loadSession,
    getSudoNumbers,
    setSudo,
    delSudo,
    evt,
    GiftedAutoReact,
    GiftedAntiLink,
    GiftedAutoBio,
    GiftedAnticall,
    GiftedPresence,
    GiftedAntiDelete,
    GiftedChatBot,
    createContext,
    createContext2,
    emojis,
    logger
};
