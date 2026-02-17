const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { env } = require("process")

const app = express();
app.set("port", "80");
const DEFAULT_ALLOWED_ORIGINS = [
  "https://tuan.chat",
  "https://www.tuan.chat",
  "https://test.tuan.chat",
  "https://www.test.tuan.chat",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5177",
  "http://127.0.0.1:5177",
];

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/$/, "");
}

function createAllowedOriginSet() {
  const raw = String(env.WEBGAL_ALLOWED_ORIGINS || "").trim();
  const list = (raw ? raw.split(",") : DEFAULT_ALLOWED_ORIGINS)
    .map(item => normalizeOrigin(item))
    .filter(Boolean);
  return new Set(list);
}

const allowedOriginSet = createAllowedOriginSet();

function resolveAllowedOrigin(requestOrigin) {
  if (!requestOrigin) {
    return null;
  }
  const normalized = normalizeOrigin(requestOrigin);
  if (allowedOriginSet.has("*") || allowedOriginSet.has(normalized)) {
    return requestOrigin;
  }
  return null;
}

app.all("*", function (req, res, next) {
  // CORS + PNA（Private Network Access）预检支持
  const allowedOrigin = resolveAllowedOrigin(req.headers.origin);
  if (allowedOrigin) {
    res.header("Access-Control-Allow-Origin", allowedOrigin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Vary", "Origin");
  }

  if (req.headers["access-control-request-private-network"] === "true") {
    res.header("Access-Control-Allow-Private-Network", "true");
  }

  const requestHeaders = req.headers["access-control-request-headers"];
  if (requestHeaders) {
    res.header("Access-Control-Allow-Headers", requestHeaders);
  } else {
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type,Content-Length, Authorization, Accept,X-Requested-With"
    );
  }

  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
  } else {
    next();
  }
});

let WEBGAL_PORT = 3000; // default port
if (env.WEBGAL_PORT) {
  WEBGAL_PORT = Number.parseInt(env.WEBGAL_PORT);
}

app.use(
  createProxyMiddleware("/api", {
    target: `http://localhost:${WEBGAL_PORT + 1}`, // http代理跨域目标接口
    changeOrigin: true,
      ws:true
  })
);

app.use(
    createProxyMiddleware("/template-preview", {
        target: `http://localhost:${WEBGAL_PORT + 1}`, // http代理跨域目标接口
        changeOrigin: true,
    })
);

app.use(
  createProxyMiddleware("/games", {
    target: `http://localhost:${WEBGAL_PORT + 1}`, // http代理跨域目标接口
    changeOrigin: true,
  })
);

app.use(
    createProxyMiddleware("/templates", {
        target: `http://localhost:${WEBGAL_PORT + 1}`, // http代理跨域目标接口
        changeOrigin: true,
    })
);

app.use(
  createProxyMiddleware("/", {
    target: `http://localhost:${WEBGAL_PORT}`, // http代理跨域目标接口
    ws: true,
    changeOrigin: true,
  })
);

app.listen(app.get("port"), () => {
  console.log(`反向代理已开启，端口：${app.get("port")}`);
  console.log(`[CORS] allowed origins: ${Array.from(allowedOriginSet).join(", ")}`);
});
