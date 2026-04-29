#!/usr/bin/env node

// Script untuk restart otomatis aplikasi jika terjadi error
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_SCRIPT = 'app-whatsapp-only.js';
const LOG_FILE = 'logs/restart.log';
const MAX_RESTARTS = 5;
const RESTART_DELAY = 10000; // 10 detik

let restartCount = 0;
let isRestarting = false;

// Fungsi untuk menulis log
function writeLog(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    // Pastikan direktori logs ada
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.appendFileSync(LOG_FILE, logEntry);
    console.log(message);
}

// Fungsi untuk start aplikasi
function startApp() {
    if (isRestarting) {
        writeLog('App is already restarting, skipping...');
        return;
    }

    writeLog(`Starting application (attempt ${restartCount + 1}/${MAX_RESTARTS})`);
    
    const app = spawn('node', [APP_SCRIPT], {
        stdio: ['inherit', 'inherit', 'inherit'],
        detached: false
    });

    app.on('error', (error) => {
        writeLog(`Error starting app: ${error.message}`);
        handleAppError();
    });

    app.on('exit', (code, signal) => {
        writeLog(`App exited with code ${code} and signal ${signal}`);
        
        if (code !== 0 && restartCount < MAX_RESTARTS) {
            handleAppError();
        } else if (restartCount >= MAX_RESTARTS) {
            writeLog(`Maximum restart attempts (${MAX_RESTARTS}) reached. Stopping restart attempts.`);
            process.exit(1);
        }
    });

    // Handle process termination
    process.on('SIGINT', () => {
        writeLog('Received SIGINT, terminating app...');
        app.kill('SIGINT');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        writeLog('Received SIGTERM, terminating app...');
        app.kill('SIGTERM');
        process.exit(0);
    });
}

// Fungsi untuk handle error aplikasi
function handleAppError() {
    if (isRestarting) return;
    
    isRestarting = true;
    restartCount++;
    
    writeLog(`App crashed, restarting in ${RESTART_DELAY/1000} seconds...`);
    
    setTimeout(() => {
        isRestarting = false;
        startApp();
    }, RESTART_DELAY);
}

// Main execution
writeLog('Starting application with auto-restart enabled');
startApp(); 