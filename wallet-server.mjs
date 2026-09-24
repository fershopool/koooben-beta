import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8787);
const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER || "";
const teamIdentifier = process.env.APPLE_TEAM_IDENTIFIER || "";
const webServiceUrl = (process.env.APPLE_WEB_SERVICE_URL || `http://localhost:${port}`).replace(/\/$/, "");
const dataDir = process.env.WALLET_DATA_DIR || path.join(root, ".wallet-data");
const dataFile = path.join(dataDir, "passes.json");
const signingSecret = process.env.WALLET_SIGNING_SECRET || randomBytes(32).toString("hex");
const adminToken = process.env.WALLET_ADMIN_TOKEN || "";
let database = { passes: {}, registrations: {} };

const icon = makePng(96, 96, 116, 73, 43);

function makePng(width, height, red, green, blue) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    for (let x = 0; x < width; x += 1) {
      const pixel = row + 1 + x * 4;
      raw[pixel] = red;
      raw[pixel + 1] = green;
      raw[pixel + 2] = blue;
      raw[pixel + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", Buffer.from([0, 0, 0, width, 0, 0, 0, height, 8, 6, 0, 0, 0])),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(name, content) {
  const type = Buffer.from(name);
  const body = Buffer.concat([type, content]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(content.length, 0);
  return Buffer.concat([length, body, checksum]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function loadDatabase() {
  if (!existsSync(dataFile)) return;
  try {
    database = JSON.parse(await readFile(dataFile, "utf8"));
  } catch {
    console.warn(`No se pudo leer ${dataFile}; se iniciará una base vacía.`);
  }
}

async function saveDatabase() {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(database, null, 2));
}

function json(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  response.end(JSON.stringify(value));
}

function fail(response, status, message) {
  json(response, status, { error: message });
}

function cors(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader("access-control-allow-headers", "Content-Type, Authorization, X-Wallet-Admin-Token");
}

function sameSecret(actual, expected) {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function passToken(serial) {
  return createHmac("sha256", signingSecret).update(serial).digest("hex");
}

function appleAuthorized(request, serial) {
  return sameSecret(request.headers.authorization, `ApplePass ${passToken(serial)}`);
}

function adminAuthorized(request) {
  return Boolean(adminToken) && sameSecret(request.headers["x-wallet-admin-token"], adminToken);
}

function serialFor(name, email, memberId) {
  const identity = (memberId || email || name).trim().toLowerCase();
  return createHash("sha256").update(identity).digest("hex").slice(0, 32);
}

function normalizeMember(name, email) {
  const cleanName = String(name || "").trim().slice(0, 40);
  const cleanEmail = String(email || "").trim().slice(0, 100);
  if (!cleanName) throw new Error("El nombre es obligatorio");
  return { name: cleanName, email: cleanEmail };
}

async function createOrUpdateMember(name, email, memberId) {
  const member = normalizeMember(name, email);
  const serial = serialFor(member.name, member.email, memberId);
  const current = database.passes[serial];
  const changed = !current || current.name !== member.name || current.email !== member.email;
  database.passes[serial] = {
    serial,
    ...member,
    revoked: current?.revoked || false,
    version: changed ? (current?.version || 0) + 1 : current.version,
    updatedAt: changed ? Date.now() : current.updatedAt
  };
  if (changed) await saveDatabase();
  return database.passes[serial];
}

function passJson(member) {
  const pass = {
    formatVersion: 1,
    passTypeIdentifier,
    serialNumber: member.serial,
    teamIdentifier,
    organizationName: "Kóoben",
    description: "Pase de Consentidos de Kóoben",
    logoText: "Kóoben",
    foregroundColor: "rgb(255, 248, 239)",
    backgroundColor: "rgb(116, 73, 43)",
    labelColor: "rgb(255, 220, 180)",
    webServiceURL: `${webServiceUrl}/v1`,
    authenticationToken: passToken(member.serial),
    generic: {
      primaryFields: [{ key: "member", label: "CONSENTIDO", value: member.name }],
      secondaryFields: [{ key: "status", label: "ESTADO", value: member.revoked ? "Revocado" : "Activo" }],
      auxiliaryFields: [{ key: "brand", label: "LUGAR", value: "Kóoben" }]
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: member.serial, messageEncoding: "iso-8859-1" }]
  };
  if (member.revoked) pass.voided = true;
  return pass;
}

function signingFiles(directory) {
  const certFile = path.join(directory, "certificate.pem");
  const keyFile = path.join(directory, "private-key.pem");
  const wwdrFile = path.join(directory, "wwdr.pem");
  if (process.env.APPLE_CERTIFICATE_PEM && process.env.APPLE_PRIVATE_KEY_PEM) {
    writeFileSync(certFile, process.env.APPLE_CERTIFICATE_PEM);
    writeFileSync(keyFile, process.env.APPLE_PRIVATE_KEY_PEM);
  } else {
    const p12Base64 = process.env.APPLE_CERTIFICATE_P12_BASE64;
    const p12Path = process.env.APPLE_CERTIFICATE_P12_PATH;
    if (!p12Base64 && !p12Path) throw new Error("Falta el certificado Apple: usa P12_BASE64/P12_PATH o PEM + PRIVATE_KEY");
    const source = p12Path || path.join(directory, "certificate.p12");
    if (p12Base64) writeFileSync(source, Buffer.from(p12Base64, "base64"));
    const password = process.env.APPLE_CERTIFICATE_PASSWORD || "";
    execFileSync("openssl", ["pkcs12", "-in", source, "-clcerts", "-nokeys", "-passin", `pass:${password}`, "-out", certFile]);
    execFileSync("openssl", ["pkcs12", "-in", source, "-nocerts", "-nodes", "-passin", `pass:${password}`, "-out", keyFile]);
  }
  if (process.env.APPLE_WWDR_CERTIFICATE_PEM) writeFileSync(wwdrFile, process.env.APPLE_WWDR_CERTIFICATE_PEM);
  else if (process.env.APPLE_WWDR_CERTIFICATE_PATH) writeFileSync(wwdrFile, readFileSync(process.env.APPLE_WWDR_CERTIFICATE_PATH));
  else throw new Error("Falta APPLE_WWDR_CERTIFICATE_PEM o APPLE_WWDR_CERTIFICATE_PATH");
  return { certFile, keyFile, wwdrFile };
}

async function buildPass(member) {
  if (!passTypeIdentifier || !teamIdentifier) throw new Error("Faltan APPLE_PASS_TYPE_IDENTIFIER y APPLE_TEAM_IDENTIFIER");
  const temporary = await mkdtemp(path.join(tmpdir(), "kooben-pass-"));
  const passDirectory = path.join(temporary, "pass");
  await mkdir(passDirectory);
  try {
    const files = { "pass.json": Buffer.from(JSON.stringify(passJson(member), null, 2)), "icon.png": icon, "icon@2x.png": icon };
    for (const [name, content] of Object.entries(files)) await writeFile(path.join(passDirectory, name), content);
    const manifest = Object.fromEntries(Object.entries(files).map(([name, content]) => [name, createHash("sha1").update(content).digest("hex")]));
    await writeFile(path.join(passDirectory, "manifest.json"), JSON.stringify(manifest, null, 2));
    const { certFile, keyFile, wwdrFile } = signingFiles(temporary);
    execFileSync("openssl", ["smime", "-binary", "-sign", "-signer", certFile, "-inkey", keyFile, "-certfile", wwdrFile, "-in", path.join(passDirectory, "manifest.json"), "-out", path.join(passDirectory, "signature"), "-outform", "DER"]);
    const output = path.join(temporary, "kooben.pkpass");
    execFileSync("zip", ["-q", "-r", output, "."], { cwd: passDirectory });
    return await readFile(output);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 100_000) throw new Error("Solicitud demasiado grande");
  }
  return JSON.parse(body || "{}");
}

function sendPass(response, buffer, filename = "kooben-consentidos.pkpass") {
  response.writeHead(200, {
    "content-type": "application/vnd.apple.pkpass",
    "content-disposition": `attachment; filename="${filename}"`,
    "content-length": buffer.length,
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  response.end(buffer);
}

async function handleApplePass(request, response, match) {
  const [, passType, serial] = match;
  if (passType !== passTypeIdentifier || !appleAuthorized(request, serial)) return fail(response, 401, "No autorizado");
  const member = database.passes[serial];
  if (!member) return fail(response, 404, "Pase no encontrado");
  const since = request.headers["if-modified-since"] ? Date.parse(request.headers["if-modified-since"]) : 0;
  if (since && member.updatedAt <= since) return response.writeHead(304).end();
  try {
    const buffer = await buildPass(member);
    response.setHeader("last-modified", new Date(member.updatedAt).toUTCString());
    return sendPass(response, buffer);
  } catch (error) {
    return fail(response, 503, error.message);
  }
}

async function handleRequest(request, response) {
  cors(response);
  if (request.method === "OPTIONS") return response.writeHead(204).end();
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = url.pathname;
  if (request.method === "GET" && pathname === "/healthz") return json(response, 200, { ok: true });
  if (request.method === "GET" && pathname === "/api/wallet/pass") {
    try {
      const member = await createOrUpdateMember(url.searchParams.get("name"), url.searchParams.get("email"), url.searchParams.get("memberId"));
      return sendPass(response, await buildPass(member));
    } catch (error) {
      return fail(response, 503, error.message);
    }
  }
  const applePass = pathname.match(/^\/v1\/passes\/([^/]+)\/([^/]+)$/);
  if (request.method === "GET" && applePass) return handleApplePass(request, response, applePass);
  const registration = pathname.match(/^\/v1\/devices\/([^/]+)\/registrations\/([^/]+)\/([^/]+)$/);
  if (registration && ["POST", "DELETE"].includes(request.method)) {
    const [, device, passType, serial] = registration;
    if (passType !== passTypeIdentifier || !database.passes[serial] || !appleAuthorized(request, serial)) return fail(response, 401, "No autorizado");
    database.registrations[device] ||= [];
    if (request.method === "POST" && !database.registrations[device].includes(serial)) database.registrations[device].push(serial);
    if (request.method === "DELETE") database.registrations[device] = database.registrations[device].filter((value) => value !== serial);
    await saveDatabase();
    return response.writeHead(request.method === "POST" ? 201 : 200).end();
  }
  const registrations = pathname.match(/^\/v1\/devices\/([^/]+)\/registrations\/([^/]+)$/);
  if (request.method === "GET" && registrations) {
    const [, device, passType] = registrations;
    const serials = database.registrations[device] || [];
    if (passType !== passTypeIdentifier || !serials.some((serial) => appleAuthorized(request, serial))) return fail(response, 401, "No autorizado");
    const since = Number(url.searchParams.get("passesUpdatedSince") || 0) * 1000;
    const updated = serials.filter((serial) => database.passes[serial]?.updatedAt > since);
    const lastUpdated = Math.max(0, ...updated.map((serial) => database.passes[serial]?.updatedAt || 0));
    return json(response, 200, { serialNumbers: updated, lastUpdated: String(Math.floor(lastUpdated / 1000)) });
  }
  const update = pathname.match(/^\/api\/wallet\/members\/([^/]+)$/);
  if (request.method === "PUT" && update) {
    if (!adminAuthorized(request)) return fail(response, 401, "No autorizado");
    const member = database.passes[update[1]];
    if (!member) return fail(response, 404, "Pase no encontrado");
    try {
      const input = await readJson(request);
      Object.assign(member, normalizeMember(input.name, input.email), { version: member.version + 1, updatedAt: Date.now() });
      await saveDatabase();
      return json(response, 200, { ok: true, serial: member.serial });
    } catch (error) {
      return fail(response, 400, error.message);
    }
  }
  const revoke = pathname.match(/^\/api\/wallet\/revoke\/([^/]+)$/);
  if (request.method === "POST" && revoke) {
    if (!adminAuthorized(request)) return fail(response, 401, "No autorizado");
    const member = database.passes[revoke[1]];
    if (!member) return fail(response, 404, "Pase no encontrado");
    member.revoked = true;
    member.version += 1;
    member.updatedAt = Date.now();
    await saveDatabase();
    return json(response, 200, { ok: true, serial: member.serial, revoked: true });
  }
  return fail(response, 404, "Ruta no encontrada");
}

await loadDatabase();
if (!process.env.WALLET_SIGNING_SECRET) console.warn("WALLET_SIGNING_SECRET no está definido; se usará uno temporal para esta ejecución.");
createServer((request, response) => handleRequest(request, response).catch((error) => fail(response, 500, error.message))).listen(port, () => {
  console.log(`Apple Wallet API escuchando en http://localhost:${port}`);
});
