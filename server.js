const express = require("express");
const path = require("path");
const pdfParse = require("pdf-parse");

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");

const publicAppUrl = process.env.PUBLIC_APP_URL || "https://가약학식.com";
const restaurantPage = "https://www.catholic.ac.kr/ko/campuslife/restaurant.do";
const baseUrl = "https://www.catholic.ac.kr";

const restaurants = [
  {
    id: "buon",
    name: "Buon Pranzo",
    label: "부온 프란조(2층)",
    markers: ["Buon Pranzo", "부온", "프란조"],
  },
  {
    id: "bona",
    name: "Cafe Bona",
    label: "카페 보나(1층)",
    markers: ["Cafe Bona", "Caf&eacute; Bona", "Café Bona", "카페 보나"],
  },
];

let cachedLinks = null;
let cachedAt = 0;
const cacheMs = 1000 * 60 * 10;

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.use(express.static(publicDir, {
  etag: true,
  setHeaders(res, filePath) {
    if (/\.(html|css|js|json)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "no-store");
    }
  },
}));

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(href) {
  if (!href) return "";
  return href.startsWith("http") ? href : new URL(href, baseUrl).href;
}

function getAnchorItems(html) {
  const anchors = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html))) {
    const href = decodeEntities(match[1]);
    const title = stripTags(match[2]);
    const context = stripTags(html.slice(Math.max(0, match.index - 900), match.index + match[0].length + 900));
    anchors.push({
      href,
      title,
      context,
      pdfUrl: absoluteUrl(href),
    });
  }

  return anchors.filter((anchor) => {
    return /\.pdf(?:$|[?#])/i.test(anchor.href) || /etcResource(?:Down|Open)|atchfileid|file|download/i.test(anchor.href);
  });
}

function scoreAnchor(anchor, restaurant) {
  const haystack = `${anchor.title} ${anchor.context}`.toLowerCase();
  return restaurant.markers.reduce((score, marker) => {
    return haystack.includes(decodeEntities(marker).toLowerCase()) ? score + 1 : score;
  }, 0);
}

function findMarkerIndex(html, markers, fromIndex = 0) {
  return markers.reduce((best, marker) => {
    const index = html.indexOf(marker, fromIndex);
    if (index < 0) return best;
    return best < 0 || index < best ? index : best;
  }, -1);
}

function findSectionEnd(html, start, restaurant) {
  return restaurants.reduce((best, other) => {
    if (other.id === restaurant.id) return best;
    const index = findMarkerIndex(html, other.markers, start + 1);
    if (index < 0) return best;
    return best < 0 || index < best ? index : best;
  }, -1);
}

function findAnchorInRestaurantSection(html, restaurant) {
  const start = findMarkerIndex(html, restaurant.markers);
  if (start < 0) return null;

  const end = findSectionEnd(html, start, restaurant);
  const section = html.slice(start, end > start ? end : start + 2500);
  return getAnchorItems(section)[0] || null;
}

function parseRestaurantLinks(html) {
  const anchors = getAnchorItems(html);

  return restaurants.map((restaurant) => {
    const anchor = findAnchorInRestaurantSection(html, restaurant) || anchors
      .map((candidate) => ({ ...candidate, score: scoreAnchor(candidate, restaurant) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    return {
      id: restaurant.id,
      name: restaurant.name,
      label: restaurant.label,
      title: anchor?.title || "메뉴표 확인하기",
      pdfUrl: anchor?.pdfUrl || "",
      available: Boolean(anchor?.pdfUrl),
    };
  });
}

async function getRestaurantLinks(force = false) {
  if (!force && cachedLinks && Date.now() - cachedAt < cacheMs) {
    return cachedLinks;
  }

  const response = await fetch(restaurantPage, {
    headers: {
      "user-agent": "GayaakMealPWA/1.0",
      "accept": "text/html,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Restaurant page responded ${response.status}`);
  }

  const html = await response.text();
  cachedLinks = parseRestaurantLinks(html);
  cachedAt = Date.now();
  return cachedLinks;
}

async function getSelectedRestaurant(id, force = false) {
  const links = await getRestaurantLinks(force);
  const selected = links.find((item) => item.id === id) || links[0];

  if (!selected?.pdfUrl) {
    const error = new Error("PDF 메뉴표를 찾지 못했습니다.");
    error.status = 404;
    throw error;
  }

  return selected;
}

async function fetchPdfBuffer(pdfUrl) {
  const response = await fetch(pdfUrl, {
    headers: {
      "user-agent": "GayaakMealPWA/1.0",
      "accept": "application/pdf,*/*",
      "referer": restaurantPage,
    },
  });

  if (!response.ok) {
    const error = new Error("PDF 메뉴표를 내려받지 못했습니다.");
    error.status = 502;
    throw error;
  }

  return {
    contentType: response.headers.get("content-type") || "application/pdf",
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}

function cleanMenuText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMenuText(text) {
  const cleaned = cleanMenuText(text);
  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    text: cleaned,
    lines,
  };
}

app.get("/healthz", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/restaurants", async (req, res, next) => {
  try {
    const force = req.query.refresh === "1";
    res.json({
      appName: "가약학식",
      appUrl: publicAppUrl,
      sourceName: "가톨릭대학교 식당",
      sourcePage: restaurantPage,
      restaurants: await getRestaurantLinks(force),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/pdf", async (req, res, next) => {
  try {
    const selected = await getSelectedRestaurant(req.query.id || "buon");
    const { contentType, buffer } = await fetchPdfBuffer(selected.pdfUrl);
    const fileName = encodeURIComponent(`${selected.label}-menu.pdf`);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${fileName}`);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.end(buffer);
  } catch (error) {
    next(error);
  }
});

app.get("/api/menu", async (req, res, next) => {
  try {
    const selected = await getSelectedRestaurant(req.query.id || "buon", req.query.refresh === "1");
    const { buffer } = await fetchPdfBuffer(selected.pdfUrl);
    const parsedPdf = await pdfParse(buffer);
    const parsedMenu = parseMenuText(parsedPdf.text);

    res.json({
      restaurant: selected,
      sourcePage: restaurantPage,
      pdfUrl: selected.pdfUrl,
      pageCount: parsedPdf.numpages,
      info: parsedPdf.info || {},
      menu: parsedMenu,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || "가톨릭대학교 식당 메뉴표를 처리하지 못했습니다.",
  });
});

app.listen(port, () => {
  console.log(`Gayaak meal app: http://localhost:${port}`);
});
