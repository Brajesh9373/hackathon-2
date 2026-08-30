/**
 * NagarSetu Backend Server
 * Vigilant Administration & Accountability Network Intelligence
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cron = require('node-cron');

const connectDB = require('./config/db');
const setupSocket = require('./socket/socket');
const { setSocketIO } = require('./services/notifications');

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
setupSocket(io);
setSocketIO(io);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/case-officer', require('./routes/caseOfficer'));
app.use('/api', require('./routes/api'));
app.use('/api/priority', require('../priority_engine/index'));
app.use('/api/civic', require('./routes/priority')); // Kopargaon Civic Platform integration
app.use('/api/verification', require('./routes/verification')); // AI Verification
app.use('/api/voice-intake', require('./routes/voiceIntake'));
app.use('/api/recovery', require('./routes/recovery'));
app.use('/api/truth', require('./routes/truth'));
app.use('/mock', require('./routes/mock'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'NagarSetu Backend',
    version: '1.0.0',
    demo_mode: process.env.DEMO_MODE === 'true',
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect DB + Start Server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║       NagarSetu Backend Server Started           ║
║   Vigilant Administration & Accountability       ║
║        Network Intelligence                      ║
╠══════════════════════════════════════════════════╣
║  Port:      ${PORT}                                  ║
║  Mode:      ${process.env.DEMO_MODE === 'true' ? 'DEMO (OTP: 123456)' : 'PRODUCTION'}               ║
║  API:       http://localhost:${PORT}/api              ║
║  Health:    http://localhost:${PORT}/api/health        ║
║  Socket.io: http://localhost:${PORT}                  ║
╚══════════════════════════════════════════════════╝
    `);

    // Schedule Cron Jobs
    const { checkSLABreaches } = require('./jobs/sla-check');
    const { checkSpeedAnomaly, checkAfterHoursClosure, checkCopyPasteSpeakingOrders, checkRecurrence } = require('./jobs/anti-gaming');
    const { runCaseOfficerSweep } = require('./services/caseOfficerService');

    // Every 30 minutes: SLA breach check + speed anomaly
    cron.schedule('*/30 * * * *', async () => {
      try {
        await checkSLABreaches();
        await checkSpeedAnomaly();
        await runCaseOfficerSweep();
      } catch (err) { console.error('Cron error (30min):', err.message); }
    });

    // Every hour: After-hours closure check
    cron.schedule('0 * * * *', async () => {
      try {
        await checkAfterHoursClosure();
      } catch (err) { console.error('Cron error (hourly):', err.message); }
    });

    // Daily at 2 AM: Recurrence + copy-paste check
    cron.schedule('0 2 * * *', async () => {
      try {
        await checkRecurrence();
        await checkCopyPasteSpeakingOrders();
      } catch (err) { console.error('Cron error (daily):', err.message); }
    });

    // Initialize verification state on startup
    const { initVerificationState } = require('./controllers/verificationController');
    initVerificationState().catch(err => console.error('Verification init error:', err.message));

    console.log('⏰ Cron jobs scheduled: SLA (30min), Anti-gaming (hourly), Recurrence (daily 2AM)');
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
