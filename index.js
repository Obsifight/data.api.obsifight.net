// ==========
// INIT
// ==========
var CronJob = require("cron").CronJob
var express = require("express")
var bodyParser = require('body-parser')
var factionsDataHandler = require("./api/factions/dataHandler")
var factionGraphDataHandler = require("./api/factions/graphDataHandler")
var successDataHandler = require("./api/successDataHandler")

var app = express()
app.use(bodyParser.urlencoded({extended: true}))
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, x-csrf-token");
    next()
})

// ==========
// DAEMON
// ==========
console.log("Start factions daemon...")
new CronJob("0 */15 * * * *", function () {
    console.log("Factions data are updating...")
    factionsDataHandler.generate()
}, function () {
    console.log("Factions data are updated!")
}, true, "Europe/Paris")

console.log("Start factions graph daemon...")
new CronJob("0 */30 * * * *", function () {
    console.log("Factions graph data are updating...")
    factionGraphDataHandler.generate()
}, function () {
    console.log("Factions graph data are updated!")
}, true, "Europe/Paris")

// ==========
// GET DATA
// ==========

app.all('/', function (req, res) {
    res.json({
        name: 'ObsiFight Data Server',
        author: 'Eywek',
        version: require('fs').readFileSync('./VERSION').toString().trim()
    })
})

app.get('/factions', factionsDataHandler.display)
app.get('/factions/:factionId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', factionsDataHandler.displayFaction)
app.get('/factions/:name([A-Za-z0-9-_]+)', factionsDataHandler.displayFaction)
app.get('/factions/search/user/:username', factionsDataHandler.searchUser)
app.get('/factions/:factionId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/success', successDataHandler.faction)
app.get('/factions/:factionId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/graph', factionGraphDataHandler.displayFaction) // ressources

// TODO :
// app.get('/users/:uuid([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', usersDataHandler.displayUser)
// app.get('/users/:name([A-Za-z0-9-_]+)', usersDataHandler.displayUser)
app.get('/users/:uuid([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/success', successDataHandler.user)

// TODO: DEV
app.get('/factions/refresh', function () {
    console.log("Factions data are updating...")
    factionsDataHandler.generate()
})
app.get('/factions/stats/refresh', function () {
    console.log("Factions stats data are updating...")
    factionGraphDataHandler.generate()
})

// ==========
// HANDLE WEB
// ==========
console.log("Start web api...")
app.listen(process.env.PORT || 8080);