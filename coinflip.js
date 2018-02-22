const async = require('async');

const bank = require('./bank');
const db = require('./database');
const io = require('./io');
const logger = require('./logger').coinflip;

const randomString = length => {
    let text = '';
    for (let i = 0; i < length; i++) text += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.charAt(Math.floor(Math.random() * possible.length));
    return text;
};

module.exports = connected => {
    const Coinflip = {};

    Coinflip.io = io.of('/coinflip');
    Coinflip.socket = null;

    Coinflip.all = callback => {
        db.query('SELECT * FROM `coinflips`', [], (ErrorSelectCoinflips, rows) => {
            if (ErrorSelectCoinflips) {
                console.error('Coinflip.all', {ErrorSelectCoinflips});
                return false;
            }
            async.each(rows, (row, callback) => {
                db.query('SELECT `steam_name` FROM `users` WHERE `steamid` = ?', [row.challenger], (ErrorSelectNickChallenger, challengerNick) => {
                    if (ErrorSelectNickChallenger) {
                        console.error('Coinflip.all', {ErrorSelectNickChallenger});
                        return false;
                    }
                    row.challengerNick = challengerNick[0].steam_name;
                    db.query('SELECT `steam_name` FROM `users` WHERE `steamid` = ?', [row.opposer], (ErrorSelectNickOpposer, opposerNick) => {
                        if (ErrorSelectNickOpposer) {
                            console.error('Coinflip.all', {ErrorSelectNickOpposer});
                            return false;
                        }
                        row.opposerNick = (typeof(opposerNick[0]) === 'undefined' || null) ? 'Looking for Opposer.' : opposerNick[0].steam_name;
                        if (row.result) {
                            row.winner = row.result === row.side ? row.challenger : row.opposer;
                            row.winnerNick = row.winner === row.challenger ? row.challengerNick : row.opposerNick;
                        }
                        callback();
                    });
                });
            }, ErrorSelectCoinflips => ErrorSelectCoinflips ? console.error('Coinflip.all', {ErrorSelectCoinflips}) : callback(rows));
        });
    };

    Coinflip.create = (id, callback) => {
        db.query('SELECT * FROM `coinflips` WHERE `id` = ?', [db.escape(id)])
            .on('error', ErrorSelectCoinflip => {
                console.error('Coinflip.create', {ErrorSelectCoinflip});
                return false;
            })
            .on('result', coinflip => {
                db.query('SELECT * FROM `users` WHERE `steamid` = ?', [coinflip.challenger])
                    .on('error', ErrorSelectUser => {
                        console.error('Coinflip.create', {ErrorSelectUser});
                        return false;
                    })
                    .on('result', challenger => callback({
                        coinflip: coinflip,
                        challenger: challenger
                    }));
            });
    };

    Coinflip.join = (id, callback) => {
        db.query('UPDATE `coinflips` SET `result` = ? WHERE `id` = ?', [Math.floor(Math.random() * 2) === 1 ? 'terror' : 'anti', db.escape(id)])
            .on('error', ErrorUpdateCoinflip => {
                console.error({ErrorUpdateCoinflip});
                return false;
            })
            .on('result', row => {
                if (row.changedRows === 0) {
                    console.error('Coinflip.join: Unexpected 0 returned.', row);
                    return false;
                }
                db.query('SELECT * FROM `coinflips` WHERE `id` = ?', [db.escape(id)])
                    .on('error', ErrorSelectCoinflip => {
                        console.error('Coinflip.join', {ErrorSelectCoinflip});
                        return false;
                    })
                    .on('result', coinflip => {
                        db.query('SELECT * FROM `users` WHERE `steamid` = ?', [coinflip.challenger])
                            .on('error', ErrorSelectChallenger => {
                                console.error('Coinflip.join', {ErrorSelectChallenger});
                                return false;
                            })
                            .on('result', challenger => {
                                db.query('SELECT * FROM `users` WHERE `steamid` = ?', [coinflip.opposer])
                                    .on('error', ErrorSelectOpposer => {
                                        console.error('Coinflip.join', ErrorSelectOpposer);
                                        return false;
                                    })
                                    .on('result', opposer => callback({
                                        coinflip: coinflip,
                                        challenger: challenger,
                                        opposer: opposer
                                    }));
                            });
                    });
            });
    };

    Coinflip.io.on('connection', socket => {
        Coinflip.socket = socket;
        logger.trace('A new Socket has connected to Coinflip.');
        Coinflip.all(coinflips => {
            if (coinflips.length !== 0) {
                let html = ``;
                for (const coinflip of coinflips) {
                    html += `
                        <tr class='${coinflip.result ? 'bg-danger' : 'bg-success'}' data-id='${coinflip.id}'>
                            <td class='challenger'>${coinflip.challengerNick}</td>
                            <td class='opposer'>${coinflip.opposerNick}</td>
                            <td class='value'>${coinflip.value}</td>
                            <td class='side'><img src='https://static.csgocards.net/coinflip/img/${coinflip.side}.png' width='16' height='16' /></td>
                            <td class='watch'><span class="glyphicon glyphicon-eye-open" aria-hidden="true"></span></td>
                            <td class='status'><button type='button' class='btn ${coinflip.result ? '' : 'join'}' ${coinflip.result ? 'disabled' : ''}>${coinflip.result ? coinflip.winnerNick : 'Join Now'}</button></td>
                        </tr>
                     `;
                }
                Coinflip.io.emit('renderAll', html);
            }
        })
    });

    Coinflip.io.on('create', data => {
        logger.trace('A new Socket has connected to Coinflip.');
        Coinflip.create(data.id, data => {
            logger.trace('Setting up a new Coinflip.', data);
            if (!data.coinflip || !data.challenger) {
                Coinflip.socket.emit('error', 'Internal Server Error. Contact an Admin.');
                return false;
            }
            if (connected.hasOwnProperty(data.coinflip.id)) {
                if (connected[data.coinflip.id].includes(Coinflip.socket.id)) {
                    Coinflip.socket.emit('error', 'You are already participating in this game!');
                    return false;
                }
                Coinflip.socket.emit('error', 'Cannot create existing room - this usually means that the Game is already running!');
                return false;
            }
            connected[data.coinflip.id] = [];
            connected[data.coinflip.id].push(socket.id);
            if (io.sockets.adapter.rooms[data.coinflip.id]) {
                Coinflip.socket.emit('error', 'The Room already exists - usually means the Game is running!');
                return false;
            }
            Coinflip.socket.join(data.coinflip.id);
            Coinflip.io.emit('render', `
                    <tr class='bg-success' data-id='${data.coinflip.id}'>
                        <td class='challenger'>${data.challenger.steam_name}</td>
                        <td class='opposer'>Looking for Opposer</td>
                        <td class='value'>${data.coinflip.value}</td>
                        <td class='side'><img src="https://static.csgocards.net/coinflip/img/${data.coinflip.side}.png" width="16px" height="16px" /></td>
                        <td class='watch'><span class="glyphicon glyphicon-eye-open" aria-hidden="true"></span></td>
                        <td class='status'><button type='button' class='btn join'>Join Now</button></td>
                    </tr>
                `);
        });
    });

    Coinflip.io.on('join', data => {
        Coinflip.join(data.id, function (data) {
            logger.trace(`Socket ${Coinflip.socket.id} wants to join Coinflip #${data.coinflip.id}.`);
            if (!data.coinflip || !data.challenger || !data.opposer) {
                Coinflip.socket.emit('error', 'Internal Server Error.Contact an Admin.');
                return false;
            }

            if (!connected.hasOwnProperty(data.coinflip.id)) {
                Coinflip.socket.emit('error', 'Room not found!');
                return false;
            }
            if (connected[data.coinflip.id].includes(Coinflip.socket.id) && process.env.APP_ENV === 'production') {
                Coinflip.socket.emit('error', 'You have already joined this Game!'); //disabled for debug because im playing against myself
                return false;
            }
            connected[data.coinflip.id].push(Coinflip.socket.id);

            const winner = data.coinflip.result === data.coinflip.side ? data.challenger.steamid : data.opposer.steamid;
            const loser = winner === data.coinflip.opposer ? data.challenger.steamid : data.opposer.steamid;
            const winnerNick = winner === data.challenger.steamid ? data.challenger.steam_name : data.opposer.steam_name;
            const loserNick = winnerNick === data.challenger.steam_name ? data.opposer.steam_name : data.challenger.steam_name;

            const room = io.sockets.adapter.rooms[data.coinflip.id];
            if (!room) {
                Coinflip.socket.emit('error', 'Room /coinflip/' + data.coinflip.id + ' does not exist!');
                return false;
            }
            if (room.length > 1) {
                Coinflip.socket.emit('error', 'Room /coinflip/' + data.coinflip.id + ' is full!');
                return false;
            }
            Coinflip.socket.join(data.coinflip.id);

            const container = 'overlay_' + randomString(12);
            io.emit('js', `
                <script>
                ($ => {
                    $(document).ready(function() {
                        const $tr = $('#coinflips').find('tr[data-id="${data.coinflip.id}"]');
                        $tr.removeClass('bg-success').addClass('bg-danger');
                        $tr.find('td.opposer').html('${data.opposer.steam_name}');
                        $('#coinflip').toggle();
                        $('body').prepend('<div id="${container}" style="z-index: 99999; font-size: 96px; color: #fff; position: absolute; top: 45%; width: 100%; text-align: center;"><span class="count"></span></div>');
                        const $container = $('#${container}');
                        let count = 0;
                        let countdown = setInterval(function() {
                            count++;
                            $container.find('.count').html(count);
                            if (count === 4) {
                                clearInterval(countdown);
                                $container.remove();
                                $('#current_coinflip_id').html(${data.coinflip.id});
                                $('#current_coinflip_value').html(${data.coinflip.value});
                                $('#coin').addClass('${(data.coinflip.result === 'terror') ? 'animation1080' : 'animation900'}');
                                setTimeout(() => $tr.find('td.status').html('${winnerNick}'), 3500);
                            }
                        }, 1000);
                    });
                })(window.jQuery || window.$);
                </script>
                `);
            setTimeout(() => {
                bank.increaseBalance(winner, data.coinflip.value, () => {
                });
                setTimeout(() => {
                    const obj = {
                        id: data.coinflip.id,
                        value: data.coinflip.value,
                        result: data.coinflip.result,
                        winner: winner,
                        loser: loser,
                        winnerNick: winnerNick,
                        loserNick: loserNick,
                    };
                    io.to(data.coinflip.id).emit('result', obj);
                    io.to(connected[data.coinflip.id][(data.challenger.steamid === winner) ? 0 : 1]).emit('winner', obj);
                    io.to(connected[data.coinflip.id][(data.challenger.steamid === loser) ? 0 : 1]).emit('loser', obj);
                    delete connected[data.coinflip.id];
                }, 1000);
            }, 6500);
        });
    });
    return Coinflip;
};
