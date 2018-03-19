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
            appenders: [ 'coinflip' ],
            level: 'debug'
        }
    }
});

const coinflip = getLogger('coinflip');

module.exports = coinflip;