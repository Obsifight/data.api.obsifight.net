var config = require('../config/config')
var https = require('https')
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
                    https.request({method: 'GET', host: 'skins.obsifight.net', path: '/skins/' + username + '.png'}, function (result) {
                        next(result.statusCode === 200)
                    })
                },
                // Check cape
                function (next) {
                    https.request({method: 'GET', host: 'skins.obsifight.net', path: '/capes/' + username + '_cape.png'}, function (result) {
                        next(result.statusCode === 200)
                    })
                },
                // Kills / deaths
                function (next) {
                    databases.getMysql('killstats').query(
                        'SELECT kills as kills, morts as deaths FROM obsikillstats_st WHERE player = "' + uuid + '" LIMIT 1',
                    function (err, rows) {
                        if (err)
                            return next(err)
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
                    databases.getMysql('logblock').query('', [uuid], function (err, rows) { // TODO: sql query
                        if (err)
                            return next(err)
                        if (rows.length === 0)
                            return next(undefined, false)
                        return next(undefined, rows[0])
                    })
                },
                // Online
                function (next) {
                    databases.getMysql('logblock').query('', [uuid], function (err, rows) { // TODO: sql query
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
                        total_time: results[5].total || 0,
                        last_connection: results[5].last || 0
                    },
                    stats: {
                        kills: results[2].kills || 0,
                        deaths: results[2].deaths || 0,
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
                return res.json({status: true, data: data})
            })
        }
    }

}