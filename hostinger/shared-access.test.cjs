const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { accessGate } = require("./shared-access.cjs");

const password = "a-random-test-access-password";
const settings = {
  username: "owner",
  passwordHash: createHash("sha256").update(password).digest("hex"),
  proxySecret: "z".repeat(64),
  host: "bookmarks.example.com",
};
const gate = accessGate(settings);
function request(authorization) {
  const req = { headers: { authorization, "x-linkweb-proxy-key": "spoofed" } };
  const res = {
    writeHead(status) {
      this.status = status;
    },
    end() {
      this.ended = true;
    },
  };
  return { req, res };
}
test("anonymous and invalid authentication is denied before reaching any app route", () => {
  for (const header of [
    undefined,
    "Bearer unknown",
    "Basic !!!",
    "Basic " + Buffer.from("owner:wrong").toString("base64"),
  ]) {
    const { req, res } = request(header);
    assert.equal(gate(req, res), false);
    assert.equal(res.status, 401);
    assert.equal(res.ended, true);
  }
});
test("valid owner access overwrites the trusted header and sets the canonical host", () => {
  const { req, res } = request(
    "Basic " + Buffer.from("owner:" + password).toString("base64")
  );
  assert.equal(gate(req, res), true);
  assert.equal(req.headers["x-linkweb-proxy-key"], settings.proxySecret);
  assert.equal(req.headers.host, settings.host);
  assert.equal(req.headers.authorization, undefined);
});
test("a different username cannot use the owner's password", () => {
  const { req, res } = request(
    "Basic " + Buffer.from("other:" + password).toString("base64")
  );
  assert.equal(gate(req, res), false);
});
test("missing protection prevents startup", () => {
  assert.throws(() => accessGate({}), /not configured/);
  assert.throws(
    () => accessGate({ ...settings, proxySecret: "short" }),
    /not configured/
  );
});
