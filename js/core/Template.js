var requirejs = (typeof requirejs === "undefined" ? require("requirejs") : requirejs);

requirejs(["rAppid"], function (rAppid) {
    rAppid.defineClass("js.core.Template", ["js.core.Component"],
        function (Component) {
            // this is because circular dependency

            return Component.inherit({

                _initializeDescriptors: function () {
                    this._childrenInitialized();
                },

                createComponents: function (attributes) {
                    // foreach child Descriptor
                    var components = this._getChildrenFromDescriptor(this.$descriptor);

                    for (var c = 0; c < components.length; c++) {
                        components[c].set(attributes);
                        components[c]._initialize("auto", true);

                    }

                    return components
                }
            });
        });
});