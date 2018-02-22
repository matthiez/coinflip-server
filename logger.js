const {configure, getLogger} = require('log4js');

configure({
    appenders: {
        app: {
            type: 'console'
        },
        coinflip: {
            type: 'file',
            filename: 'logs/app.log'
        }
    },
    categories: {
        default: {
            appenders: ['app', 'coinflip'],
            level: 'debug'
        }
    }
});

const app = getLogger('coinflip');
const coinflip = getLogger('coinflip');

module.exports = {
    app,
    coinflip
};