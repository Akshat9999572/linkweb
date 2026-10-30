const { createHash, timingSafeEqual } = require("node:crypto");

function accessGate({ username, passwordHash, proxySecret, host }) {
  if (
    !username ||
    !/^[a-f0-9]{64}$/.test(passwordHash || "") ||
    !proxySecret ||
    proxySecret.length < 32 ||
    !host
  )
    throw new Error("Private Hostinger access is not configured.");
  const expectedUser = Buffer.from(username);
  const expectedHash = Buffer.from(passwordHash, "hex");
  return (req, res) => {
    const header = req.headers.authorization;
    let valid = false;
    if (typeof header === "string" && header.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator >= 0) {
        const user = Buffer.from(decoded.slice(0, separator));
        const hash = createHash("sha256")
          .update(decoded.slice(separator + 1))
          .digest();
        valid =
          user.length === expectedUser.length &&
          timingSafeEqual(user, expectedUser) &&
          timingSafeEqual(hash, expectedHash);
      }
    }
    if (!valid) {
      res.writeHead(401, {
        "WWW-Authenticate": 'Basic realm="Private Linkweb", charset="UTF-8"',
        "Cache-Control": "private, no-store",
      });
      res.end(
        "Private workspace. Sign in with your hosting access credentials."
      );
      return false;
    }
    // Authentication applies to every request, including API calls and assets.
    // Overwrite client headers before opening the persistent personal profile.
    req.headers.host = host;
    req.headers["x-linkweb-proxy-key"] = proxySecret;
    delete req.headers.authorization;
    return true;
  };
}

module.exports = { accessGate };
