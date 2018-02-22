const db = require('./database');

const Bank = {};

Bank.getUser = (token, callback) => {
    db.query('SELECT * FROM `users` WHERE `token` = ? LIMIT 1',
        [token],
        (ErrorGetUser, row) => ErrorGetUser ? console.error({ErrorGetUser}) : callback(row[0]));
};

Bank.getBalance = (steamid, callback) => {
    db.query('SELECT `balance` FROM `users` WHERE `steamid` = ?',
        [steamid],
        (ErrorGetBalance, row) => ErrorGetBalance ? console.error({
            steamid,
            ErrorGetBalance
        }) : callback(row[0].balance));
};

Bank.increaseBalance = (steamid, amount, callback) => {
    db.query('UPDATE `users` SET `balance` = `balance` + ? WHERE `steamid` = ?',
        [amount, steamid],
        (ErrorIncreaseBalance, row) => ErrorIncreaseBalance ? console.error({ErrorIncreaseBalance}) : callback(row[0].balance));
};

module.exports = Bank;