var mysql = require("mysql")
var config = require("./config")
var mongoClient = require("mongodb").MongoClient;

module.exports = {

    getMongo: function (next) {
        var self = this

        if (self.mongo !== undefined)
            return next(self.mongo)
        mongoClient.connect("mongodb://" + config.db.factions.user + ":" + config.db.factions.password + "@" + config.db.factions.host + ":" + config.db.factions.port + "/" + config.db.factions.database, function(err, db) {
            if (err)
                return console.error(err)

            self.mongo = db;
            next(db);
        });
    },

    closeMongo: function () {
        if (this.mongo !== undefined)
            this.mongo.close()
        this.mongo = undefined
    },

    getMysql: function (connectionName) {
        if (this[connectionName] !== undefined)
            return this[connectionName]
        var db = mysql.createConnection({
            host: config.db[connectionName].host,
            user: config.db[connectionName].user,
            password: config.db[connectionName].password,
            database: config.db[connectionName].database
        })
        db.connect()
        this[connectionName] = db
        return db
    },

    closeMysql: function (connectionName) {
        if (this[connectionName] !== undefined)
            this[connectionName].end()
        this[connectionName] = undefined
    }

}