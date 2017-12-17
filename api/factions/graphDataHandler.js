var databases = require('../../config/db')
var async = require('async')
var _ = require('underscore')

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
                        "ON faction_material_count.material_id = material.id AND faction_material_count.faction_id = ? " +
                        "WHERE material.name IN ('GARNET_INGOT', 'GARNET_BLOCK', 'AMETHYST_INGOT', 'AMETHYST_BLOCK', 'TITANIUM_INGOT', 'TITANIUM_BLOCK', 'OBSIDIAN_INGOT', 'OBSIDIAN_BLOCK', 'INGOT_XENOTIUM', 'XENOTIUM_BLOCK', 'TNT', 'XTNT', 'ENDER_PEARL', 'GOLDEN_APPLE')", [faction.id],
                        function (err, rows) {
                            if (err) {
                                console.error(err)
                                return
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
        // Remove old (1 week max)
        databases.getMysql('cache').query('DELETE stats.*, materials_stats.* FROM stats ' +
            'INNER JOIN materials_stats ON materials_stats.stats_id = stats.id ' +
            'WHERE stats.created_at <= DATE_SUB(NOW(), INTERVAL 1 WEEK);', function (err) {
            if (err)
                console.error(err)
        });
    },

    /*

    {
        counts: {
            position: "+3",
            money: 0,
        }
        graphs: {
            materials: {
                x_axis: ["days.monday", ...],
                data: [{
                    name: 'Installation',
                    data: [43934, 52503, 57177, 69658, 97031, 119931, 137133, 154175]
                }, {
                    name: 'Manufacturing',
                    data: [24916, 24064, 29742, 29851, 32490, 30282, 38121, 40434]
                }]
            }
        }
        last_update: "YYYY-m-d H:i:s",
        update_range: "0, 0, 0, 0, 30, 0, 0"
    }

     */
    displayFaction: function (req, res) {
        // Find faction on cache
        databases.getMysql('cache').query('SELECT stats.id, stats.position, stats.money, stats.created_at FROM stats WHERE stats.faction_id = ? ORDER BY created_at',
            [req.params.factionId], function (err, statsList) {
            if (err) {
                console.error(err)
                return res.status(500).json({status: false, error: "Unable to get factions."})
            }
            if (statsList.length === 0)
                return res.status(404).json({status: false, error: "Faction not found."})
            var data = {
                counts: {
                    position: statsList[0].position - statsList[statsList.length - 1].position,
                    money: statsList[statsList.length - 1].money - statsList[0].money
                },
                graphs: {
                    materials: {
                        x_axis: [],
                        data: []
                    }
                },
                last_update: statsList[statsList.length - 1].created_at,
                update_range: "0, 0, 0, 0, 0, 30, 0"
            }

            async.eachSeries(statsList, function (stats, next) {
                data.graphs.materials.x_axis.push(stats.created_at)
                // Get materials
                databases.getMysql('cache').query('SELECT name, count FROM materials_stats WHERE stats_id = ?', [stats.id], function (err, materials) {
                    if (err) {
                        console.error(err)
                        return res.status(500).json({status: false, error: "Unable to get factions materials."})
                    }
                    async.each(materials, function (material, callback) {
                        // Add to graph if first call
                        if (getIndexFromSeries(material.name.toLowerCase(), data.graphs.materials.data) === -1)
                            data.graphs.materials.data.push({
                                name: material.name.toLowerCase(),
                                data: []
                            })
                        data.graphs.materials.data[getIndexFromSeries(material.name.toLowerCase(), data.graphs.materials.data)].data.push(material.count)
                        callback()
                    }, function () {
                        next()
                    })
                })
            }, function () {
              res.json({status: true, data: data})
            })
        })
        var getIndexFromSeries = function (name, series) {
            for (var i = 0; i < series.length; i++)
                if (series[i].name === name)
                    return i;
            return -1;
        }
    }

}