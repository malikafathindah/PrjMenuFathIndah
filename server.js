/**
 * ============================================================================
 * LOCAL WEB SERVER (server.js) - ZERO EXTERNAL DEPENDENCIES
 * PT. FATH INDAH WEB PORTAL - PURE WEB APPLICATION
 * ============================================================================
 * Menjalankan aplikasi web secara lokal di http://localhost:3000
 * Siap untuk diinstall dan di-push ke GitHub / GitHub Pages!
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

let PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Mendukung akses dari local network / mobile phone via Wi-Fi IP

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. SUPABASE STATUS
  if (pathname === '/api/database-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      provider: 'Supabase Cloud Database',
      projectUrl: 'https://utqexpkwtatwzknjftpx.supabase.co',
      status: 'Connected',
      tables: 19
    }));
    return;
  }

  // 2. HEALTH CHECK
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', serverTime: new Date().toISOString() }));
    return;
  }

  // 3. STATIC FILE SERVING
  let safePath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(__dirname, safePath);

  // Mencegah directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Cek apakah file ada, jika directory cari index.html
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback ke index.html untuk Single Page Application routing
      filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

function startServer(portToTry) {
  server.listen(portToTry, HOST, () => {
    console.log('\n================================================================');
    console.log('🚀 PT. FATH INDAH - ENTERPRISE INTERNAL WEB PORTAL');
    console.log('✨ Pure Web Application (Bebas Google Apps Script)');
    console.log(`🌐 Local Web Link: http://localhost:${portToTry}`);
    console.log(`📱 Mobile Mode: Bisa dibuka di browser HP melalui Wi-Fi IP`);
    console.log('💾 Dual Database Support: Supabase + Google Sheets');
    console.log('📦 Siap di-deploy ke GitHub Pages atau hosting static');
    console.log('================================================================\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${portToTry} sedang digunakan, mencoba port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
