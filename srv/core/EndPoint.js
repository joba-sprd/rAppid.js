define(['js/core/Component'], function (Component) {

    return Component.inherit('srv.core.EndPoint', {

        /***
         * starts the endpoint
         * @param {srv.core.Server} server
         */
        start: function (server, callback) {
            var self = this;

            this.$server = server;
            this._start(function(err) {
                self.$started = true;
                callback(err);
            });
        },

        /***
         * end point specific implementation to get started
         *
         * @param callback
         * @private
         */
        _start: function (callback) {
            throw "abstract";
        },

        handleRequest: function (request, response) {
            this.$server.handleRequest(this, request, response);
        },

        /***
         * stops the endpoint
         * @param callback
         */
        stop: function (callback) {
            if (!this.$started) {
                callback();
            } else {
                this._stop(callback);
            }
        },

        /***
         * end pint specific implementation to get stopped
         * @param callback
         * @private
         * @abstract
         */
        _stop: function (callback) {
            callback();
        }

    });

});