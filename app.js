require('dotenv').config();

const bank = require('./bank');
const coinflip = require('./coinflip');
const io = require('./io');

const connected = {};

const getOnlineCount = () => Object.keys(io.sockets.sockets).length;

(() => {
    coinflip(connected);

    io.on('connection', socket => {
        io.emit('onlineCounter', getOnlineCount());
        setInterval(() => io.emit('onlineCounter', getOnlineCount()), 5000);

        socket.on('balance', steamid => bank.getBalance(steamid, balance => socket.emit('balance', balance)));
    });
})();

