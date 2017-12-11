var config = require('../config/config')
var request = require('request')
var async = require('async')
var Api = require('obsifight-libs')
var api = new Api(config.api.credentials.user, config.api.credentials.password)
var databases = require('../config/db')

module.exports = {

    displayUser: function (req, res) {
        // Check request
        if (req.params.uuid)
        {
            // get username
            api.request({
                route: '/user/from/uuid/' + req.params.uuid,
                method: 'get'
            }, function (err, result) {
                if (err || !result.status) {
                    console.error(err || result.error || result.body)
                    return res.status(500).json({status: false, error: "Unable to get player's name."})
                }
                getDatas(req.params.uuid, result.body.username)
            })
        }
        else
        {
            // get uuid
            api.request({
                route: '/user/uuid/from/' + req.params.name,
                method: 'get'
            }, function (err, result) {
                if (err || !result.status) {
                    console.error(err || result.error || result.body)
                    return res.status(500).json({status: false, error: "Unable to get player's uuid."})
                }
                getDatas(result.body.uuid, req.params.name)
            })
        }

        function getDatas(uuid, username) {
            async.parallel([
                // Check skin
                function (next) {
                    request.get({
                        url: 'http://skins.obsifight.net/skins/' + username + '.png'
                    }, function (err, httpResponse) {
                        if (err)
                            return next(false)
                        next(undefined, httpResponse.statusCode === 200)
                    })
                },
                // Check cape
                function (next) {
                    request.get({
                        url: 'http://skins.obsifight.net/capes/' + username + '_cape.png'
                    }, function (err, httpResponse) {
                        if (err)
                            return next(false)
                        next(undefined, httpResponse.statusCode === 200)
                    })
                },
                // Kills / deaths
                function (next) {
                    databases.getMysql('killstats').query(
                        'SELECT kills as kills, morts as deaths FROM obsikillstats_st WHERE player = "' + uuid + '" LIMIT 1',
                    function (err, rows) {
                        if (err)
                        {
                            console.error(err)
                            return next(err)
                        }
                        next(undefined, rows[0])
                    })
                },
                // Versions
                function (next) {
                    databases.getMysql('web_v' + config.current_version).query('SELECT users_versions.version FROM users_versions ' +
                        'INNER JOIN users ON users.uuid = ? ' +
                        'WHERE users_versions.user_id = users.id', [uuid], function (err, rows) {
                        if (err) {
                            console.error(err)
                            return next(err, []);
                        }
                        if (rows.length === 0)
                            return next(undefined, []);
                        return next(undefined, rows.map(function (version) {
                            return version.version;
                        }));
                    })
                },
                // Blocks
                function (next) {
                    databases.getMysql('logblock').query('SELECT ' +
                        '(SELECT COUNT(`lb-FACTION`.`id`) AS `broke` FROM `lb-FACTION` ' +
                        'INNER JOIN `lb-players` ON `lb-players`.`UUID` = ?' +
                        'WHERE `lb-FACTION`.`playerid` = `lb-players`.`playerid` AND `lb-FACTION`.`replaced` = 0' +
                        ') AS `broke`,' +
                        '(SELECT COUNT(`lb-FACTION`.`id`) AS `placed` FROM `lb-FACTION` ' +
                        'INNER JOIN `lb-players` ON `lb-players`.`UUID` = ?' +
                        'WHERE `lb-FACTION`.`playerid` = `lb-players`.`playerid` AND `lb-FACTION`.`replaced` = 1' +
                        ') AS `placed`', [uuid, uuid], function (err, rows) {
                        if (err)
                            return next(err)
                        if (rows.length === 0)
                            return next(undefined, false)
                        return next(undefined, rows[0])
                    })
                },
                // Online
                function (next) {
                    databases.getMysql('logblock').query('SELECT lastlogin AS last, onlinetime AS total FROM `lb-players` WHERE UUID = ?', [uuid], function (err, rows) {
                        if (err)
                            return next(err)
                        if (rows.length === 0)
                            return next(undefined, false)
                        return next(undefined, rows[0])
                    })
                }
            ], function (err, results) {
                var data = {
                    online: {
                        total_time: Math.round(results[5] && results[5].total / 3600) || 0,
                        last_connection: results[5] && results[5].last || 0
                    },
                    stats: {
                        kills: results[2] && results[2].kills || 0,
                        deaths: results[2] && results[2].deaths || 0,
                        blocks: {
                            placed: results[4].placed || 0,
                            broken: results[4].broke || 0
                        }
                    },
                    versions: results[3] || [config.current_version],
                    skin: results[0] || false,
                    cape: results[1] || false
                }

                databases.closeMysql('killstats');
                databases.closeMysql('logblock');
                databases.closeMysql('web_v' + config.current_version);
                return res.json({status: true, data: data})
            })
        }
    }

}