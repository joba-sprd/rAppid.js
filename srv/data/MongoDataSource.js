define(['js/data/DataSource', 'mongodb', 'js/data/Model', 'flow'], function (DataSource, mongodb, Model, flow) {


    var MongoDataProcessor = DataSource.Processor.inherit('src.data.MongoDataProcessor', {
        _getReferenceKey: function (key, schema) {
            // correct key of id object
            if (key === "id") {
                return "_id";
            }
            return this.callBase();
        },
        _getCompositionValue: function (value, key, action, options) {
            // add correct id object
            if (key === "id" && value) {
                return this.$datasource.getIdObject(value);
            }
            return this.callBase();
        },
        parse: function (data, action, options) {
            if (data['_id']) {
                data['id'] = data._id.toHexString();
                delete data['_id'];
            }

            return this.callBase(data, action, options);
        }
    });

    var MongoDataSource = DataSource.inherit('srv.data.MongoDataSource', {

        defaults: {
            username: null,
            password: null,

            host: 'localhost',
            port: 27017,
            poolSize: 2,
            database: null,
            autoReconnect: true
        },

        $defaultProcessorFactory: MongoDataProcessor,

        connect: function (callback) {

            var server = new mongodb.Server(this.$.host, this.$.port, {});

            var db = new mongodb.Db(this.$.database, server, {});
            db.open(callback);
            return db;
        },
        _getConfigurationForModel: function (model) {
            return this.$dataSourceConfiguration.getConfigurationForModelClassName(model.constructor.name);
        },
        getIdObject: function (id) {
            return new mongodb.ObjectID(id);
        },
        loadModel: function (model, options, callback) {
            var configuration = this._getConfigurationForModel(model);

            if (!configuration) {
                callback("No configuration found for " + model.constructor.name);
                return;
            }

            try {
                var idObject = this.getIdObject(model.$.id);
            } catch(e) {
                callback("Coulnd't find entry " + configuration.$.collection + "/" + model.$.id);
            }

            // TODO: add loading/linking of sub models
            var self = this, connection;
            flow()
                .seq("collection", function (cb) {
                    connection = self.connect(function (err, client) {
                        cb(err, new mongodb.Collection(client, configuration.$.collection));
                    });
                })
                .seq(function (cb) {
                    this.vars['collection'].findOne({_id: idObject}, function (err, objects) {
                        if (!err) {
                            model.set(model.parse(objects));
                        }
                        cb(err);
                    });
                })
                .exec(function (err) {
                    if (connection) {
                        connection.close();
                    }
                    callback(err, model);

                });

        },

        saveModel: function (model, options, callback) {
            var configuration = this._getConfigurationForModel(model);

            if (!configuration) {
                callback("No configuration found for " + model.constructor.name);
                return;
            }

            var action = DataSource.ACTION.UPDATE, method = MongoDataSource.METHOD.SAVE;

            if (model._status() === Model.STATE.NEW) {
                action = DataSource.ACTION.CREATE;
                method = MongoDataSource.METHOD.INSERT;
            }

            var data = model.compose(this, action, options), self = this, connection;
            flow()
                .seq("collection", function (cb) {
                    connection = self.connect(function (err, client) {
                        cb(err, new mongodb.Collection(client, configuration.$.collection));
                    });
                })
                .seq(function (cb) {
                    if (method === MongoDataSource.METHOD.INSERT) {
                        this.vars['collection'].insert(data, {safe: true}, function (err, objects) {
                            if (!err) {
                                model.set(model.parse(objects[0]));
                            }
                            cb(err);
                        });
                    } else if (method === MongoDataSource.METHOD.SAVE) {
                        this.vars['collection'].update({_id: this.getIdObject(model.$.id)}, data, {safe: true}, function (err, objects) {
                            if (!err) {
                                model.set(model.parse(objects[0]));
                            }
                            cb(err);
                        });
                    } else {
                        cb("Wrong method");
                    }
                })
                .exec(function (err) {
                    if (connection) {
                        connection.close();
                    }
                    callback(err, model);

                });

//            var collection = this.$db.collection(configuration.$.collection);
//            collection[method].call(collection, data, {}, function (err, result) {
//                if (!err) {
//                    if (result) {
//                        // TODO: parse the payload and fill model
//                        if (method == "insert") {
//                            model.set(model.parse(result[0]));
//                        }
//                        callback(null, model);
//                    } else {
//                        callback("Coulnd't save entry " + configuration.$.collection + "/" + model.$.id);
//                    }
//                } else {
//                    callback(err);
//                }
//            });
        },
        loadCollectionPage: function (collection, options, callback) {
            var rootCollection = collection.getRootCollection();
            var config = this.$dataSourceConfiguration.getConfigurationForModelClassName(rootCollection.$modelFactory.prototype.constructor.name);

            if (!config) {
                callback("Couldnt find path config for " + rootCollection.$modelFactory.prototype.constructor.name);
            }

            var mongoCollection = config.$.collection;
            if (!mongoCollection) {
                callback("No mongo collection defined for " + rootCollection.$modelFactory.prototype.constructor.name);
            }

            // TODO: add query, fields and options

            var self = this, connection;
            flow()
                .seq("collection", function (cb) {
                    connection = self.connect(function (err, client) {
                        cb(err, new mongodb.Collection(client, mongoCollection));
                    });
                })
                .seq("cursor", function (cb) {
                    var cursor = this.vars["collection"].find();
                    if(options.limit){
                        cursor = cursor.limit(options.limit);
                    }

                    cursor.toArray(function (err, results) {
                        if (!err) {
                            collection.add(rootCollection.parse(results));
                        }
                        cb(err, cursor);
                    });
                })
                .seq(function (cb) {
                    this.vars["cursor"].count(function (err, count) {
                        collection.$itemsCount = count;
                        cb(err);
                    });
                })
                .exec(function (err) {
                    if (connection) {
                        connection.close();
                    }
                    callback(err, collection, options);
                });
        }
    });

    MongoDataSource.METHOD = {
        SAVE: 'save',
        INSERT: 'insert'
    };

    return MongoDataSource;
});