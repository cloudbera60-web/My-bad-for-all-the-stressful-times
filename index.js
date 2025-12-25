const express = require('express');
const path = require('path');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 50900;
const { 
  qrRoute,
  pairRoute
} = require('./routes');

// Import new modules
const mongoDB = require('./mongodb');
const whatsappManager = require('./whatsapp-manager');
const paymentService = require('./payment-service');

require('events').EventEmitter.defaultMaxListeners = 2000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


app.use('/qr', qrRoute);
app.use('/code', pairRoute);

// Session management endpoints
app.get('/sessions', async (req, res) => {
    try {
        const activeSessions = await mongoDB.getActiveSessions();
        const activeConnections = whatsappManager.getActiveConnections();
        
        res.json({
            success: true,
            data: {
                mongodb: {
                    activeSessions: activeSessions,
                    total: activeSessions.length
                },
                whatsapp: {
                    activeConnections: activeConnections,
                    total: activeConnections.length
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching sessions',
            error: error.message
        });
    }
});

app.get('/cleanup-sessions', async (req, res) => {
    try {
        await mongoDB.cleanupInactiveSessions();
        res.json({
            success: true,
            message: 'Session cleanup completed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error cleaning up sessions',
            error: error.message
        });
    }
});

// Serve HTML pages
app.get('/pair', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

app.get('/payment-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment-test.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 200,
        success: true,
        service: 'Gifted-MD Session & Payment Service',
        timestamp: new Date().toISOString(),
        mongodb: mongoDB.connection ? 'connected' : 'disconnected',
        activeWhatsAppConnections: whatsappManager.getActiveConnections().length,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Ping endpoint for Render health checks
app.get('/ping', (req, res) => {
    res.json({
        pong: Date.now(),
        service: 'Gifted-MD',
        version: '1.0.0'
    });
});

// Test payment endpoints (for web testing)
app.post('/test-payment', async (req, res) => {
    try {
        const { phone, amount } = req.body;
        
        if (!phone || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Phone and amount are required'
            });
        }
        
        // Validate phone number
        if (!paymentService.validatePhoneNumber(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number format. Use: 0712345678, +254712345678, or 254712345678'
            });
        }
        
        // Validate amount
        if (!paymentService.validateAmount(amount)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount. Amount must be between 1 and 150,000 KES'
            });
        }
        
        // Generate reference
        const reference = paymentService.generateReference();
        
        // Test the payment service (but don't actually send STK push in test mode)
        if (process.env.NODE_ENV === 'test' || !process.env.PAYHERO_AUTH_TOKEN) {
            // Return simulated response for testing
            return res.json({
                success: true,
                message: `Test payment initiated for ${phone} - KES ${amount}`,
                reference: reference,
                test_mode: true,
                note: 'This is a test response. In production, STK push would be sent.'
            });
        }
        
        // Actually send STK push in production
        const result = await paymentService.sendSTKPush(phone, amount, reference);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                reference: result.reference,
                transactionId: result.transactionId,
                test_mode: false
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message,
                reference: reference,
                test_mode: false
            });
        }
    } catch (error) {
        console.error('❌ Test payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Test payment failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.get('/test-status', async (req, res) => {
    try {
        const { reference } = req.query;
        
        if (!reference) {
            return res.status(400).json({
                success: false,
                message: 'Reference is required'
            });
        }
        
        // Test mode check
        if (process.env.NODE_ENV === 'test' || !process.env.PAYHERO_AUTH_TOKEN) {
            // Simulated status response
            const statuses = ['pending', 'success', 'failed'];
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            
            return res.json({
                success: true,
                status: randomStatus,
                message: `Test payment ${reference} is ${randomStatus}`,
                test_mode: true,
                note: 'This is a test response. In production, actual payment status would be checked.'
            });
        }
        
        // Actually check status in production
        const result = await paymentService.checkPaymentStatus(reference);
        
        if (result.success) {
            res.json({
                success: true,
                status: result.status,
                message: result.message,
                details: result.details,
                test_mode: false
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message,
                status: 'error',
                test_mode: false
            });
        }
    } catch (error) {
        console.error('❌ Test status error:', error);
        res.status(500).json({
            success: false,
            message: 'Status check failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Test balance endpoint
app.get('/test-balance', async (req, res) => {
    try {
        // Test mode check
        if (process.env.NODE_ENV === 'test' || !process.env.PAYHERO_AUTH_TOKEN) {
            return res.json({
                success: true,
                balance: Math.floor(Math.random() * 100000),
                currency: 'KES',
                message: 'Test balance: KES ' + Math.floor(Math.random() * 100000),
                test_mode: true,
                note: 'This is a test response. In production, actual wallet balance would be checked.'
            });
        }
        
        // Actually check balance in production
        const result = await paymentService.checkWalletBalance();
        
        if (result.success) {
            res.json({
                success: true,
                balance: result.balance,
                currency: result.currency,
                message: result.message,
                test_mode: false
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message,
                test_mode: false
            });
        }
    } catch (error) {
        console.error('❌ Test balance error:', error);
        res.status(500).json({
            success: false,
            message: 'Balance check failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        available_endpoints: {
            GET: [
                '/',
                '/pair',
                '/qr',
                '/payment-test',
                '/health',
                '/ping',
                '/sessions',
                '/test-status',
                '/test-balance'
            ],
            POST: [
                '/test-payment'
            ]
        }
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 SIGTERM received, starting graceful shutdown...');
    
    // Close MongoDB connection
    await mongoDB.close();
    
    // Close server
    server.close(() => {
        console.log('🔒 Server closed');
        process.exit(0);
    });
});

// Start server
const server = app.listen(PORT, async () => {
    console.log(`
🚀 Deployment Successful!

💻 Gifted-MD Session & Payment Server
📡 Running on: http://localhost:${PORT}
🌐 Health Check: http://localhost:${PORT}/health
📊 Active Sessions: http://localhost:${PORT}/sessions
💳 Payment Test: http://localhost:${PORT}/payment-test

📱 Payment Features:
• M-Pesa STK Push via WhatsApp
• Real-time payment status
• Wallet balance checking
• Session persistence via MongoDB

🔧 Support:
• Telegram: @mouricedevs
• WhatsApp Channel: https://whatsapp.com/channel/0029Vb3hlgX5kg7G0nFggl0Y

✅ Server started successfully at ${new Date().toISOString()}
`);

    // Restore active WhatsApp sessions
    setTimeout(async () => {
        await whatsappManager.restoreActiveSessions();
    }, 5000);
});

module.exports = app;
