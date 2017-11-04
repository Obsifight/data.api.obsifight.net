var databases = require('../config/db')
var _ = require('underscore')
var async = require('async')
var successList = [
    {
        name: 'ONLINE_TIME',
        values: [50, 100, 250, 500, 1000],
        type: ['user'],
        get: function (uuid, next) {
            databases.getMysql('logblock').query("SELECT onlinetime AS onlinetime FROM lb-players WHERE UUID = ?", [uuid], function (err, rows) {
                if (err) {
                    console.error(err)
                    return next(0)
                }
                if (rows.length === 0)
                    return next(0)
                next(rows[0].onlinetime)
                databases.closeMysql('logblock')
            })
        }
    },
    {
        name: 'KILLS',
        values: [10, 50, 100, 500, 1000],
        type: ['user', 'faction'],
        get: function (uuid, next) {
            databases.getMysql('killstats').query("SELECT kills AS kills FROM obsikillstats_st WHERE player = ?", [uuid], function (err, rows) {
                if (err) {
                    console.error(err)
                    return next(0)
                }
                if (rows.length === 0)
                    return next(0)
                next(rows[0].kills)
                databases.closeMysql('killstats')
            })
        }
    },
    {
        name: 'SKINS',
        type: ['user'],
        have: function (uuid, next) { // TODO
            next(false)
        }
    },
    {
        name: 'CAPE',
        type: ['user'],
        have: function (uuid, next) { // TODO
            next(false)
        }
    },
    {
        name: 'ONLINE_VERSION_4',
        type: ['user'],
        have: function (uuid, next) { // TODO
            next(false)
        }
    },
    {
        name: 'ONLINE_VERSION_5',
        type: ['user'],
        have: function (uuid, next) { // TODO
            next(false)
        }
    },
    {
        name: 'ONLINE_VERSION_6',
        type: ['user'],
        have: function (uuid, next) { // TODO
            next(false)
        }
    },
    {
        name: 'ONLINE_VERSION_7',
        type: ['user'],
        have: function (uuid, next) { // TODO
            next(false)
        }
    },
    {
        name: 'ONLINE_VERSION_8',
        type: ['user'],
        have: function (uuid, next) { // TODO
            next(false)
        }
    },
    {
        name: 'MONEY',
        values: [100, 1000, 10000],
        type: ['user', 'faction'],
        get: function (uuid, next) {
            databases.getMysql('economy').query('SELECT of_economy_balance.balance as money FROM of_economy_account ' +
                'INNER JOIN of_economy_balance ON of_economy_balance.username_id = of_economy_account.id ' +
                'WHERE uuid = ? LIMIT 1', [uuid],
            function (err, rows) {
                if (err) {
                    console.error(err)
                    return next(0)
                }
                if (rows.length === 0)
                    return next(0)
                next(rows[0].money)
                databases.closeMysql('economy')
            })
        }
    }
]

/*
Example:
var result = {
    'MONEY': {
        100: 8.9,
        1000: 0.9,
        10000: 0.1
    },
    'ONLINE_VERSION_8': true
}
 */
var getSuccessPercentagesFromUser = function (uuid, next, type) {
    if (type === undefined)
        type = 'user'
    var successTypeList = _.filter(successList, function(success) {
        return success.type.indexOf(type) !== -1;
    })
    var result = {}

    async.each(successTypeList, function (success, callback) {

        if (success.have) { // boolean
            success.have(uuid, function (bool) {
                result[success.name] = bool
                callback()
            })
        } else { // percentages
            success.get(uuid, function (value) {
                result[success.name] = {}
                for (var i = 0; i < success.values.length; i++) {
                    result[success.name][success.values[i]] = Math.round(((value / success.values[i]) * 100) * 100) / 100
                }
                callback()
            })
        }

    }, function (err) {
        if (err)
            console.error(err)
        next(result)
    })
}
var getSuccessPercentagesFromFaction = function (factionId, next) {
    var result = {}

    databases.getMongo(function (mongoDatabase) {
        mongoDatabase.collection('factions_mplayer').find({"factionId": factionId}).toArray(function (err, players) {
            if (err) {
                console.error(err)
                next(result)
            }

            async.each(players, function (player, callback) {
                getSuccessPercentagesFromUser(player._id.toString(), function (successList) {

                    // merge add
                    for (name in successList) {
                        if (typeof successList[name] === 'boolean' && successList[name])
                            result[name] = true
                        else {
                            if (result[name] === undefined)
                                result[name] = {}
                            for (value in successList[name]) {
                                if (result[name][value] !== undefined)
                                    result[name][value] += successList[name][value]
                                else
                                    result[name][value] = successList[name][value]
                            }
                        }
                    }

                    callback()
                }, 'faction')
            }, function (err) {
                if (err)
                    console.error(err)
                next(result)
            })
            databases.closeMongo()
        })
    })
}

module.exports = {

    faction: function (req, res) {
        getSuccessPercentagesFromFaction(req.params.factionId, function (successList) {
            return res.json({
                status: true,
                data: successList
            })
        })
    },

    user: function (req, res) {
        getSuccessPercentagesFromUser(req.params.uuid, function (successList) {
            return res.json({
                status: true,
                data: successList
            })
        })
    }

}