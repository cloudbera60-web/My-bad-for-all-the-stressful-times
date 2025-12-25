const mongoose = require('mongoose');

class MongoDB {
    constructor() {
        this.connection = null;
        this.Session = null;
        this.init();
    }

    async init() {
        try {
            // MongoDB connection string - can be set via environment variable
            const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gifted-session';
            
            this.connection = await mongoose.connect(mongoURI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
            });

            console.log('✅ MongoDB Connected');

            // Define session schema
            const sessionSchema = new mongoose.Schema({
                sessionId: { type: String, required: true, unique: true },
                phoneNumber: { type: String },
                creds: { type: Object, required: true },
                keys: { type: Object, required: true },
                createdAt: { type: Date, default: Date.now },
                lastActive: { type: Date, default: Date.now },
                isActive: { type: Boolean, default: true }
            });

            // Create index for faster queries
            sessionSchema.index({ sessionId: 1 });
            sessionSchema.index({ phoneNumber: 1 });
            sessionSchema.index({ lastActive: 1 });
            sessionSchema.index({ isActive: 1 });

            this.Session = mongoose.model('Session', sessionSchema);

            // Start cleanup job
            this.startCleanupJob();

        } catch (error) {
            console.error('❌ MongoDB Connection Error:', error.message);
            // Continue without MongoDB - sessions will be file-based only
        }
    }

    async saveSession(sessionId, phoneNumber, creds, keys) {
        try {
            if (!this.Session) return null;

            const sessionData = {
                sessionId,
                phoneNumber,
                creds,
                keys,
                lastActive: new Date(),
                isActive: true
            };

            await this.Session.findOneAndUpdate(
                { sessionId },
                sessionData,
                { upsert: true, new: true }
            );

            console.log(`💾 Session saved to MongoDB: ${sessionId}`);
            return true;
        } catch (error) {
            console.error('❌ Error saving session to MongoDB:', error.message);
            return false;
        }
    }

    async getSession(sessionId) {
        try {
            if (!this.Session) return null;

            const session = await this.Session.findOne({ 
                sessionId, 
                isActive: true 
            });

            if (session) {
                // Update last active timestamp
                await this.Session.updateOne(
                    { _id: session._id },
                    { $set: { lastActive: new Date() } }
                );
                
                return {
                    creds: session.creds,
                    keys: session.keys
                };
            }
            return null;
        } catch (error) {
            console.error('❌ Error getting session from MongoDB:', error.message);
            return null;
        }
    }

    async updateSessionActivity(sessionId) {
        try {
            if (!this.Session) return;

            await this.Session.updateOne(
                { sessionId, isActive: true },
                { $set: { lastActive: new Date() } }
            );
        } catch (error) {
            console.error('❌ Error updating session activity:', error.message);
        }
    }

    async deactivateSession(sessionId) {
        try {
            if (!this.Session) return;

            await this.Session.updateOne(
                { sessionId },
                { $set: { isActive: false } }
            );
            
            console.log(`🔒 Session deactivated: ${sessionId}`);
        } catch (error) {
            console.error('❌ Error deactivating session:', error.message);
        }
    }

    async getActiveSessions() {
        try {
            if (!this.Session) return [];

            const sessions = await this.Session.find({ 
                isActive: true 
            }).select('sessionId phoneNumber createdAt lastActive -_id');

            return sessions;
        } catch (error) {
            console.error('❌ Error getting active sessions:', error.message);
            return [];
        }
    }

    async cleanupInactiveSessions() {
        try {
            if (!this.Session) return;

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const result = await this.Session.updateMany(
                { 
                    lastActive: { $lt: thirtyDaysAgo },
                    isActive: true 
                },
                { $set: { isActive: false } }
            );

            if (result.modifiedCount > 0) {
                console.log(`🧹 Cleaned up ${result.modifiedCount} inactive sessions`);
            }
        } catch (error) {
            console.error('❌ Error cleaning up inactive sessions:', error.message);
        }
    }

    startCleanupJob() {
        // Run cleanup every 24 hours
        setInterval(() => {
            this.cleanupInactiveSessions();
        }, 24 * 60 * 60 * 1000);
    }

    async close() {
        if (this.connection) {
            await mongoose.disconnect();
            console.log('🔒 MongoDB Disconnected');
        }
    }
}

// Create singleton instance
const mongoDB = new MongoDB();

module.exports = mongoDB;
