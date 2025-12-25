const express = require('express');
const path = require('path');
const app = express();
const __path = process.cwd();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 50900;
const { 
  qrRoute,
  pairRoute
} = require('./routes');

// Import new modules
const mongoDB = require('./mongodb');
const whatsappManager = require('./whatsapp-manager');

require('events').EventEmitter.defaultMaxListeners = 2000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
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
