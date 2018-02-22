const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit: 100,
    host: process.env.APP_MYSQL_HOST || '127.0.0.1',
    database: process.env.APP_MYSQL_DB,
    user: process.env.APP_MYSQL_USER,
    password: process.env.APP_MYSQL_PW,
    charset: 'UTF8MB4_UNICODE_CI',
    supportBigNumbers: true,
    bigNumberStrings: true
});

module.exports = {
    pool,

    query() {
        const events = [];
        const eventNameIndex = {};
        pool.getConnection((err, conn) => {
            if (err && eventNameIndex.error) eventNameIndex.error();
            if (conn) {
                const q = conn.query.apply(conn, Array.prototype.slice.call(arguments));
                q.on('end', () => conn.release());
                events.forEach(args => q.on.apply(q, args));
            }
        });
        return {
            on(eventName, callback) {
                events.push(Array.prototype.slice.call(arguments));
                eventNameIndex[eventName] = callback;
                return this;
            }
        };
    },

    escape(param) {
        return pool.escape(param);
    }
};