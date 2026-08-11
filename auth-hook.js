"use strict";

const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const tenantId = process.env.AZURE_TENANT_ID;
const audience = process.env.AZURE_CLIENT_ID;

const jwks = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 24 * 60 * 60 * 1000,
  rateLimit: true,
});

function getSigningKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      {
        audience,
        issuer: [
          `https://login.microsoftonline.com/${tenantId}/v2.0`,
          `https://sts.windows.net/${tenantId}/`,
        ],
        algorithms: ["RS256"],
      },
      (err, decoded) => (err ? reject(err) : resolve(decoded)),
    );
  });
}

function trustedProxyAuthHook(app, config, services) {
  const { userService } = services;

  // Check only /api to allow the health check endpoint to be accessed without authentication
  app.use("/api", async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    if (!token) {
      return res
        .status(401)
        .json({
          message: "Missing bearer token from reverse proxy",
          path: "/api/admin/error-login",
        })
        .end();
    }

    let claims;
    try {
      claims = await verifyToken(token);
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired token" })
        .end();
    }

    const email = claims.preferred_username || claims.email || claims.upn;
    if (!email) {
      return res
        .status(401)
        .json({ message: "Token missing email claim" })
        .end();
    }

    try {
      const user = await userService.loginUserWithoutPassword(email, true);
      req.user = user;
      next();
    } catch (err) {
      res.status(401).json({ message: "Could not authenticate user" }).end();
    }
  });
}

module.exports = trustedProxyAuthHook;
