const paymentService = require('./payment-service');
const mongoDB = require('./mongodb');

class WhatsAppHandler {
    constructor() {
        this.pendingPayments = new Map(); // Store pending payments for reminders
    }

    async handleMessage(sock, message) {
        try {
            const from = message.key.remoteJid;
            const text = (message.message?.conversation || 
                         message.message?.extendedTextMessage?.text || 
                         message.message?.buttonsResponseMessage?.selectedDisplayText || '').trim().toLowerCase();

            if (!text || !from || from === 'status@broadcast') return;

            // Update session activity in MongoDB
            const sessionId = sock?.user?.id?.split(':')[0];
            if (sessionId) {
                await mongoDB.updateSessionActivity(sessionId);
            }

            // Handle commands
            if (text === 'menu' || text === 'help') {
                await this.showMenu(sock, from);
            } 
            else if (text.startsWith('send')) {
                await this.handleSendPayment(sock, from, text);
            }
            else if (text.startsWith('status')) {
                await this.handleCheckStatus(sock, from, text);
            }
            else if (text === 'balance') {
                await this.handleCheckBalance(sock, from);
            }
            else if (text === 'ping') {
                await this.handlePing(sock, from);
            }
            else if (text === 'start') {
                await this.sendWelcomeMessage(sock, from);
            }
            else {
                // Only respond to unknown commands if it's a direct message (not group)
                if (!from.endsWith('@g.us')) {
                    await sock.sendMessage(from, {
                        text: `🤖 *Gifted-MD Payment Bot*\n\nType *menu* to see available commands\n\nNeed help? Contact support via Telegram: @mouricedevs`
                    });
                }
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
        }
    }

    async showMenu(sock, from) {
        const menuText = `🤖 *GIFTED-MD PAYMENT BOT MENU*\n
💰 *PAYMENT COMMANDS:*
• *send <amount>* - Send payment to your own number
• *send <amount>,<phone>* - Send to another number
• *status <reference>* - Check payment status
• *balance* - Check wallet balance

📱 *EXAMPLES:*
• *send 100* (send to yourself)
• *send 100,0712345678*
• *send 100,+254712345678*
• *send 100,254712345678*
• *status GFT123456789*

⚡ *OTHER COMMANDS:*
• *menu* - Show this menu
• *ping* - Check bot response time
• *start* - Welcome message

📞 *SUPPORT:*
Telegram: @mouricedevs
WhatsApp Channel: https://whatsapp.com/channel/0029Vb3hlgX5kg7G0nFggl0Y

*Powered by Gifted Tech* 🚀`;

        await sock.sendMessage(from, { text: menuText });
    }

    async handleSendPayment(sock, from, text) {
        try {
            const parts = text.split(' ');
            if (parts.length < 2) {
                await sock.sendMessage(from, {
                    text: '❌ Invalid format. Use: *send <amount>* or *send <amount>,<phone>*\nExample: *send 100,254712345678*'
                });
                return;
            }

            const params = parts[1];
            let amount, phone;

            if (params.includes(',')) {
                [amount, phone] = params.split(',');
            } else {
                amount = params;
                // Extract phone from sender's JID if available
                const senderId = from.split('@')[0];
                phone = senderId.includes('-') ? null : senderId;
            }

            // Validate amount
            if (!paymentService.validateAmount(amount)) {
                await sock.sendMessage(from, {
                    text: '❌ Invalid amount. Please enter a valid amount between 1 and 150,000'
                });
                return;
            }

            // If no phone provided, check if we can get from sender
            if (!phone) {
                await sock.sendMessage(from, {
                    text: '❌ Please provide a phone number: *send <amount>,<phone>*\nExample: *send 100,0712345678*'
                });
                return;
            }

            // Validate phone
            if (!paymentService.validatePhoneNumber(phone)) {
                await sock.sendMessage(from, {
                    text: '❌ Invalid phone number. Please use format: 0712345678, +254712345678, or 254712345678'
                });
                return;
            }

            // Generate reference
            const reference = paymentService.generateReference();

            // Send initial message
            await sock.sendMessage(from, {
                text: `💳 *Processing Payment Request*\n\nAmount: KES ${amount}\nPhone: ${phone}\nReference: ${reference}\n\nProcessing...`
            });

            // Send STK push
            const result = await paymentService.sendSTKPush(phone, amount, reference);

            if (result.success) {
                // Store for reminder
                this.pendingPayments.set(reference, {
                    from,
                    amount,
                    phone,
                    timestamp: Date.now()
                });

                // Schedule reminder in 30 seconds
                setTimeout(async () => {
                    if (this.pendingPayments.has(reference)) {
                        await sock.sendMessage(from, {
                            text: `⏰ *Payment Reminder*\n\nPayment ${reference} is still pending.\n\nCheck your phone for the M-Pesa STK prompt.\n\nType *status ${reference}* to check payment status.`
                        });
                    }
                }, 30000);

                await sock.sendMessage(from, {
                    text: `✅ *STK Push Sent!*\n\n${result.message}\n\nReference: *${reference}*\n\nCheck your phone to complete the payment.\n\nType *status ${reference}* to check payment status.`
                });
            } else {
                await sock.sendMessage(from, {
                    text: `❌ *Payment Failed*\n\n${result.message}\n\nPlease try again or contact support.`
                });
            }
        } catch (error) {
            console.error('❌ Error in handleSendPayment:', error);
            await sock.sendMessage(from, {
                text: '❌ Error processing payment. Please try again later.'
            });
        }
    }

    async handleCheckStatus(sock, from, text) {
        try {
            const parts = text.split(' ');
            if (parts.length < 2) {
                await sock.sendMessage(from, {
                    text: '❌ Please provide a reference number: *status <reference>*\nExample: *status GFT123456789*'
                });
                return;
            }

            const reference = parts[1].toUpperCase();

            await sock.sendMessage(from, {
                text: `🔍 *Checking Payment Status*\n\nReference: ${reference}\n\nChecking...`
            });

            const result = await paymentService.checkPaymentStatus(reference);

            if (result.success) {
                // Remove from pending if completed
                if (result.status.toLowerCase() === 'success' || 
                    result.status.toLowerCase() === 'failed') {
                    this.pendingPayments.delete(reference);
                }

                await sock.sendMessage(from, {
                    text: `📊 *Payment Status*\n\nReference: ${reference}\nStatus: *${result.status.toUpperCase()}*\n\n${result.message}`
                });
            } else {
                await sock.sendMessage(from, {
                    text: `❌ *Status Check Failed*\n\n${result.message}\n\nReference: ${reference}`
                });
            }
        } catch (error) {
            console.error('❌ Error in handleCheckStatus:', error);
            await sock.sendMessage(from, {
                text: '❌ Error checking payment status. Please try again later.'
            });
        }
    }

    async handleCheckBalance(sock, from) {
        try {
            await sock.sendMessage(from, {
                text: `💰 *Checking Wallet Balance*\n\nPlease wait...`
            });

            const result = await paymentService.checkWalletBalance();

            if (result.success) {
                await sock.sendMessage(from, {
                    text: `💎 *Wallet Balance*\n\nBalance: *${result.currency} ${result.balance}*\n\n${result.message}`
                });
            } else {
                await sock.sendMessage(from, {
                    text: `❌ *Balance Check Failed*\n\n${result.message}\n\nPlease try again later or contact support.`
                });
            }
        } catch (error) {
            console.error('❌ Error in handleCheckBalance:', error);
            await sock.sendMessage(from, {
                text: '❌ Error checking balance. Please try again later.'
            });
        }
    }

    async handlePing(sock, from) {
        const startTime = Date.now();
        await sock.sendMessage(from, {
            text: '🏓 Pong!'
        });
        const responseTime = Date.now() - startTime;
        
        await sock.sendMessage(from, {
            text: `⚡ *Response Time: ${responseTime}ms*\n\nBot is active and responsive!`
        });
    }

    async sendWelcomeMessage(sock, from) {
        const welcomeText = `🎉 *Welcome to Gifted-MD Payment Bot!*\n
I'm here to help you with M-Pesa payments directly through WhatsApp.

💰 *AVAILABLE COMMANDS:*
• *menu* - Show all commands
• *send <amount>* - Send to your number
• *send <amount>,<phone>* - Send to another number
• *status <reference>* - Check payment status
• *balance* - Check wallet balance
• *ping* - Check response time

📱 *EXAMPLES:*
• Type *send 100* to send to yourself
• Type *send 100,0712345678* to send to another number
• Type *status GFT123456789* to check status

🔧 *SUPPORT & UPDATES:*
• Telegram: @mouricedevs
• WhatsApp Channel: https://whatsapp.com/channel/0029Vb3hlgX5kg7G0nFggl0Y
• GitHub: https://github.com/mauricegift/gifted-md

Type *menu* to see all commands anytime!

*Powered by Gifted Tech* 🚀`;

        await sock.sendMessage(from, { text: welcomeText });
    }

    // Clean up old pending payments (older than 1 hour)
    cleanupOldPayments() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [reference, payment] of this.pendingPayments.entries()) {
            if (payment.timestamp < oneHourAgo) {
                this.pendingPayments.delete(reference);
            }
        }
    }
}

// Start cleanup interval
const whatsappHandler = new WhatsAppHandler();
setInterval(() => {
    whatsappHandler.cleanupOldPayments();
}, 30 * 60 * 1000); // Clean up every 30 minutes

module.exports = whatsappHandler;
