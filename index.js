"use strict";

const unleash = require("unleash-server");
const trustedProxyAuthHook = require("./auth-hook");

unleash.start({
  authentication: {
    type: "custom",
    customAuthHandler: trustedProxyAuthHook,
  },
});
