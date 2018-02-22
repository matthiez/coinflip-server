const fs = require('fs');
const http = require('http');
const https = require('https');
const socket = require('socket.io');

const HTTPS_PORT = process.env.APP_HTTP_PORT || 443;
const HTTP_PORT = process.env.APP_HTTPS_PORT || 80;

const io = socket(
    process.env.APP_ENV === 'production'
        ? https.createServer({
            key: fs.readFileSync(process.env.APP_CERT_KEY),
            cert: fs.readFileSync(process.env.APP_CERT_CRT)
        },
        console.log(`HTTPS-Server running @ port ${HTTPS_PORT}`)).listen(HTTPS_PORT)
        : http.createServer(console.log(`HTTP-Server running @ port ${HTTP_PORT}`)).listen(HTTP_PORT)
);
module.exports = io;