const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 50900;
const bodyParser = require("body-parser");

// Import routes
const { qrRoute, pairRoute } = require('./routes');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Use routes
app.use('/qr', qrRoute);
app.use('/code', pairRoute);  // Changed from /pair to /code to avoid conflict

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 200,
        success: true,
        service: 'CLOUD AI Bot',
        timestamp: new Date().toISOString()
    });
});

// Serve HTML pages
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start bot after server starts
app.listen(PORT, () => {
    console.log(`✅ Cloud AI Server running on port ${PORT}`);
    console.log(`🌐 Home page: http://localhost:${PORT}`);
    console.log(`🔗 Pair page: http://localhost:${PORT}/pair`);
    console.log(`📱 QR page: http://localhost:${PORT}/qr`);
    
    // Start the bot
    require('./bot');
});
