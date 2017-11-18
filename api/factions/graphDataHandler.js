var databases = require('../../config/db')
var async = require('async')

module.exports = {

    generate: function () {
        // Find faction on cache
        databases.getMysql('cache').query('SELECT * FROM factions', function (err, factions) {
            if (err) {
                console.error(err)
                return res.status(500).json({status: false, error: "Unable to get factions."})
            }

            async.each(factions, function (faction, next) {
                // Store basics
                databases.getMysql('cache').query('INSERT INTO stats SET faction_id = ?, position = ?, money = ?,' +
                    'kills = ?, deaths = ?, created_at = ?', [faction.id, faction.position, faction.money, faction.kills_count,
                    faction.deaths_count, new Date()], function (err, stats) {
                    if (err) {
                        console.error(err)
                        return res.status(500).json({status: false, error: "Unable to set factions's stats."})
                    }
                    // Get materials data
                    databases.getMysql('blockstats').query("SELECT material.name AS name, faction_material_count.count AS count\n" +
                        "FROM material\n" +
                        "LEFT JOIN faction_material_count\n" +
                        "ON faction_material_count.material_id = material.id AND faction_material_count.faction_id = ?", [faction.id],
                        function (err, rows) {
                            if (err) {
                                console.error(err)
                                return res.status(500).json({
                                    status: false,
                                    error: "Unable to find faction's materials"
                                })
                            }

                            var materials = []
                            for (var i = 0; i < rows.length; i++) {
                                if (rows[i].count)
                                    materials[i] = {
                                        name: rows[i].name,
                                        count: rows[i].count,
                                        stats_id: stats.insertId
                                    }
                                else
                                    materials[i] = {
                                        name: rows[i].name,
                                        count: 0,
                                        stats_id: stats.insertId
                                    }
                            }

                            // Store it
                            var keys = Object.keys(materials[0])
                            var keysString = keys.join(', ')
                            var values = []
                            for (var i = 0; i < materials.length; i++) {
                                values.push(_.values(materials[i]))
                            }

                            databases.getMysql('cache').query("INSERT INTO materials_stats (" + keysString + ") VALUES ?", [values], function (err) {
                                if (err)
                                    return console.error(err)
                                next()
                            })
                    })
                })
            }, function () {
                databases.closeMysql('cache')
                databases.closeMysql('blockstats')
            })
        })
        // TODO : Remove old stats
    },

    displayFaction: function (req, res) {
        // TODO
    }

}