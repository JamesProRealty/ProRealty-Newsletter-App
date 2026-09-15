import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Type, Image as ImageIcon, MousePointerClick, Minus, MoveVertical,
  PanelBottom, LayoutTemplate, Trash2, Copy, Download, Upload,
  Code2, X, GripVertical, Plus, Menu, Users, Images, UploadCloud, Wand2, Save, FolderOpen, Palette, LayoutGrid, ChevronUp, ChevronDown, Newspaper, Building2,
  Facebook, Linkedin, Instagram, Twitter, Youtube, ClipboardCheck
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const ink = "#171B21";
const inkSoft = "#5B6470";
const workspaceBg = "#EEF0F3";
const panelBg = "#FFFFFF";
const border = "#DBDFE5";
const accent = "#B8863B"; // brass — real-estate/print-adjacent, not the usual clay/terracotta
const accentSoft = "#F4ECDD";
const canvasSerif = "'Iowan Old Style', 'Palatino Linotype', Georgia, serif";
const uiSans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_HELVETICA = "Helvetica, Arial, sans-serif"; // default typeface for new block content
const BRAND_NAVY = "#20334f"; // standard template background — matches the branded header banners

const FALLBACK_IMG = "https://placehold.co/400x300/EEF0F3/9AA2AC?text=Image+not+found";
function handleImgError(e) {
  e.currentTarget.onerror = null;
  e.currentTarget.src = FALLBACK_IMG;
}

// Talks to the real newsletter-app backend (same origin — this builder is
// served by that Express app at /builder). Every admin call needs the
// x-admin-token header; ADMIN_TOKEN in the server's .env must match.
async function apiFetch(path, token, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...(options.headers || {}), "x-admin-token": token || "" },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new Error(message || `Request to ${path} failed`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const FONT_OPTIONS = [
  { label: "Georgia (serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Courier New (monospace)", value: "'Courier New', Courier, monospace" },
];

// ---------------------------------------------------------------------------
// Theme presets — one click restyles every block's colors and fonts to a
// coordinated palette. Each theme is a flat set of role-based values (not
// tied to any one block type); applyTheme() below maps these roles onto
// whatever props each block actually has.
// ---------------------------------------------------------------------------
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";
const FRIENDLY_SANS = "'Trebuchet MS', sans-serif";

const THEMES = [
  {
    id: "bold-editorial",
    name: "Bold & Editorial",
    description: "High contrast, big serif headlines, brass accent",
    swatches: ["#14181F", "#B8863B", "#FFFFFF"],
    headingFont: SERIF,
    bodyFont: SANS,
    ink: "#14181F",
    accent: "#B8863B",
    onAccent: "#FFFFFF",
    surface: "#FFFFFF",
    muted: "#6B7280",
    dividerColor: "#B8863B",
    dividerThickness: 2,
    headingSize: 30,
  },
  {
    id: "warm-boutique",
    name: "Warm & Boutique",
    description: "Softer palette, cream tones, more breathing room",
    swatches: ["#FBF6EF", "#C98C6B", "#3B2E2A"],
    headingFont: SERIF,
    bodyFont: FRIENDLY_SANS,
    ink: "#3B2E2A",
    accent: "#C98C6B",
    onAccent: "#FFFFFF",
    surface: "#FBF6EF",
    muted: "#8A7A6D",
    dividerColor: "#E8D9C8",
    dividerThickness: 1,
    headingSize: 26,
  },
  {
    id: "clean-minimal",
    name: "Clean & Minimal",
    description: "Lots of white, restrained single accent",
    swatches: ["#FFFFFF", "#111111", "#2F6F5E"],
    headingFont: SANS,
    bodyFont: SANS,
    ink: "#111111",
    accent: "#2F6F5E",
    onAccent: "#FFFFFF",
    surface: "#FFFFFF",
    muted: "#767676",
    dividerColor: "#E5E5E5",
    dividerThickness: 1,
    headingSize: 22,
  },
];

// Social platforms available for the footer's social icon row. `abbr` is
// used in the exported email HTML (a simple letter badge — far more
// reliable across email clients than inline SVG icons); `Icon` is used for
// the on-screen canvas preview only.
const SOCIAL_PLATFORMS = [
  { key: "facebook", label: "Facebook", abbr: "f", Icon: Facebook },
  { key: "linkedin", label: "LinkedIn", abbr: "in", Icon: Linkedin },
  { key: "instagram", label: "Instagram", abbr: "ig", Icon: Instagram },
  { key: "twitter", label: "Twitter / X", abbr: "X", Icon: Twitter },
  { key: "youtube", label: "YouTube", abbr: "yt", Icon: Youtube },
];

// ---------------------------------------------------------------------------
// Block definitions
// ---------------------------------------------------------------------------
const BLOCK_TYPES = [
  { type: "navbar", label: "Nav Bar", icon: Menu },
  { type: "header", label: "Header", icon: LayoutTemplate },
  { type: "text", label: "Text", icon: Type },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "stats", label: "Property Stats", icon: LayoutGrid },
  { type: "article", label: "Article", icon: Newspaper },
  { type: "listings", label: "Listings Grid", icon: Building2 },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "agents", label: "Agent(s)", icon: Users },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "spacer", label: "Spacer", icon: MoveVertical },
  { type: "footer", label: "Footer", icon: PanelBottom },
];

const VARIABLES = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{address}}", label: "Address" },
  { token: "{{price}}", label: "Price" },
  { token: "{{agent_name}}", label: "Agent name" },
];

let idCounter = 1;
const nextId = () => `blk_${idCounter++}`;

function defaultProps(type) {
  switch (type) {
    case "navbar":
      return {
        showLogo: true,
        logoSrc: "https://placehold.co/220x56/171B21/FFFFFF?text=ProRealty",
        logoAlt: "ProRealty",
        logoLink: "https://www.prorealty.com.au",
        logoHeight: 32,
        bg: BRAND_NAVY,
        linkColor: "#FFFFFF",
        fontFamily: FONT_HELVETICA,
        fontSize: 13,
        align: "right",
        links: [
          { label: "For Lease", url: "https://prorealty.com.au/listings?saleOrRental=Rental&rental_period=week&status=all&viewType=gallery" },
          { label: "For Sale", url: "https://prorealty.com.au/listings?saleOrRental=Sale&rental_period=week&status=all&viewType=gallery" },
          { label: "Property Management", url: "https://prorealty.com.au/expert-commercial-lease-property-management-solutions/" },
          { label: "Contact Us", url: "https://prorealty.com.au/contact-us" },
        ],
      };
    case "header":
      return {
        title: "New listing just hit the market",
        subtitle: "{{address}}",
        bg: BRAND_NAVY,
        titleColor: "#FFFFFF",
        titleFontFamily: FONT_HELVETICA,
        titleFontSize: 24,
        titleAlign: "left",
        subtitleColor: "#FFFFFF",
        subtitleFontFamily: FONT_HELVETICA,
        subtitleFontSize: 15,
        subtitleAlign: "left",
        cornerRadius: 0,
        outerMargin: 0,
        borderWidth: 0,
        borderColor: "#DBDFE5",
        innerBorderWidth: 0,
        innerBorderColor: "#DBDFE5",
        innerBorderGap: 6,
        textPaddingY: 40,
        bgImage: "", // optional photo behind the text (e.g. a reusable newsletter banner)
        bgOverlayOpacity: 0.35, // darkens bgImage so text stays legible
        mode: "text", // "text" | "image"
        activeVariant: "sale", // "sale" | "lease" — which banner shows in image mode
        imageSale: HEADER_BANNER_SALE,
        imageLease: HEADER_BANNER_LEASE,
        imageAlt: "New listing",
      };
    case "text":
      return { content: "Hi {{first_name}},\n\nWe thought you'd want an early look at this one — {{address}} is now on the market at {{price}}.", fontSize: 16, align: "left", color: "#FFFFFF", fontFamily: FONT_HELVETICA, bg: BRAND_NAVY };
    case "image":
      return {
        layout: "single",
        width: "full",
        bg: BRAND_NAVY,
        outerMargin: 32,
        photos: [
          { id: nextId(), src: "https://placehold.co/1200x700/e8e2d6/171B21?text=Listing+Photo", alt: "Listing photo" },
        ],
      };
    case "stats":
      return {
        bg: BRAND_NAVY,
        rows: 2, // 1 | 2
        textColor: "#FFFFFF",
        fontFamily: FONT_HELVETICA,
        fontSize: 12,
        align: "center",
        iconSize: 40,
        rowGap: 16,
        iconColor: "white", // "white" | "navy" — match to your section background
        items: [
          { id: nextId(), icon: ICON_LEASE_SRC, label: "Lease Term" },
          { id: nextId(), icon: ICON_ZONING_SRC, label: "Zoning" },
          { id: nextId(), icon: ICON_PARKING_SRC, label: "Parking" },
          { id: nextId(), icon: ICON_INCOME_SRC, label: "Income" },
          { id: nextId(), icon: ICON_LAND_AREA_SRC, label: "Land Area" },
          { id: nextId(), icon: ICON_BUILDING_AREA_SRC, label: "Building Area" },
        ],
      };
    case "article":
      return {
        bg: "#FFFFFF",
        imagePosition: "left", // "left" | "right"
        photo: "https://placehold.co/500x400/D9CBB0/171B21?text=Article+Photo",
        photoAlt: "Article photo",
        title: "Commercial vacancies fall in Adelaide's lifestyle precincts",
        titleColor: BRAND_NAVY,
        titleFontFamily: FONT_HELVETICA,
        titleFontSize: 18,
        summary: "Prospective tenants seeking a commercial property are gravitating to \u2018lifestyle-led\u2019 suburban areas with a mix of cafes, restaurants, shops and housing, according to new research.",
        summaryColor: "#4A5568",
        summaryFontFamily: FONT_HELVETICA,
        summaryFontSize: 14,
        buttonLabel: "Read More",
        buttonUrl: "https://example.com",
        buttonBg: BRAND_NAVY,
        buttonColor: "#FFFFFF",
      };
    case "listings":
      return {
        bg: BRAND_NAVY,
        heading: "Featured Listings",
        headingColor: "#FFFFFF",
        headingFontFamily: FONT_HELVETICA,
        headingFontSize: 20,
        headingAlign: "center",
        headingBg: "#cbff00",
        columns: 2, // 1 | 2 | 3 | 4
        tileLayout: "stacked", // "stacked" | "side-by-side" — side-by-side only applies at columns = 1
        cardBg: "#FFFFFF",
        textColor: BRAND_NAVY,
        fontFamily: FONT_HELVETICA,
        fontSize: 13,
        photoHeight: 200, // px — set to 0 for natural/auto aspect ratio
        showSizes: true, // toggle the whole stats row (any icon+label pairs) on each tile
        iconColor: "navy", // "navy" | "white" — match to your card background
        listings: [
          {
            id: nextId(),
            photo: "https://placehold.co/500x400/D9CBB0/171B21?text=Listing+Photo",
            photoAlt: "Listing photo",
            address: "G1 / 55 Grenfell Street, ADELAIDE SA 5000",
            url: "https://example.com",
            stats: [{ id: nextId(), icon: ICON_BUILDING_AREA_SRC, label: "180m²" }],
          },
          {
            id: nextId(),
            photo: "https://placehold.co/500x400/C7D2CC/171B21?text=Listing+Photo",
            photoAlt: "Listing photo",
            address: "585-589 Salisbury Highway, GREENFIELDS SA 5107",
            url: "https://example.com",
            stats: [
              { id: nextId(), icon: ICON_BUILDING_AREA_SRC, label: "620m²" },
              { id: nextId(), icon: ICON_LAND_AREA_SRC, label: "1,200m²" },
            ],
          },
        ],
      };
    case "button":
      return { label: "View the listing", url: "https://example.com", bg: "#cbff00", color: BRAND_NAVY, align: "center", fontFamily: FONT_HELVETICA, fontSize: 14, sectionBg: BRAND_NAVY };
    case "agents":
      return {
        heading: "Contact our agents",
        headingColor: "#FFFFFF",
        headingFontFamily: FONT_HELVETICA,
        headingFontSize: 18,
        headingAlign: "left",
        bg: BRAND_NAVY,
        textColor: "#FFFFFF",
        fontFamily: FONT_HELVETICA,
        fontSize: 13,
        align: "center",
        columns: 2,
        agents: [
          {
            id: nextId(),
            photoSrc: "https://placehold.co/160x160/EEF0F3/171B21?text=Photo",
            photoPosY: 30,
            name: "Jordan Blake",
            role: "Senior Sales Agent",
            phone: "0412 345 678",
            email: "jordan@prorealty.com.au",
          },
          {
            id: nextId(),
            photoSrc: "https://placehold.co/160x160/EEF0F3/171B21?text=Photo",
            photoPosY: 30,
            name: "Priya Nair",
            role: "Property Manager",
            phone: "0498 765 432",
            email: "priya@prorealty.com.au",
          },
        ],
      };
    case "divider":
      return { color: "#4A6280", thickness: 1, bg: BRAND_NAVY };
    case "spacer":
      return { height: 24, bg: BRAND_NAVY };
    case "footer":
      return {
        bg: "#FFFFFF",
        logo: "",
        logoAlt: "Company logo",
        logoWidth: 220,
        contactLinks: [
          { id: nextId(), label: "(08) 8362 1555", url: "tel:0883621555" },
          { id: nextId(), label: "admin@prorealty.com.au", url: "mailto:admin@prorealty.com.au" },
          { id: nextId(), label: "prorealty.com.au", url: "https://prorealty.com.au" },
        ],
        contactColor: BRAND_NAVY,
        addressText: "Suite 13, 15 Fullarton Road, Kent Town SA 5067 &nbsp;|&nbsp; PO Box 213, Kent Town SA 5071",
        socialLinks: [
          { id: nextId(), platform: "linkedin", url: "https://linkedin.com" },
          { id: nextId(), platform: "facebook", url: "https://facebook.com" },
        ],
        disclaimerText: "You have received this newsletter because you have either subscribed to our mailing list or given us contact details to receive information.",
        manageSubscriptionLabel: "Manage your subscription",
        disclaimerColor: "#5D5D5D",
        fontFamily: FONT_HELVETICA,
        fontSize: 12,
        align: "center",
      };
    default:
      return {};
  }
}

function makeBlock(type) {
  return { id: nextId(), type, props: defaultProps(type) };
}

// Branded header banners and stat icons — served as real files by the
// backend (see src/routes/data.js seed-brand-assets) rather than embedded
// as base64, so they don't bloat sent emails or get clipped by Gmail.
//
// Built as ABSOLUTE URLs (not "/uploads/...") using the app's own live
// address. This matters because the exported HTML gets pasted into an
// external CRM to actually send — a relative path only resolves against
// "the current page", which doesn't exist once the HTML is sitting in an
// email; without the full domain, every one of these images would just be
// broken in the real sent email even though they look fine in the builder.
const ASSET_ORIGIN = typeof window !== "undefined" && window.location ? window.location.origin : "";
const HEADER_BANNER_SALE = `${ASSET_ORIGIN}/uploads/brand-header-for-sale.jpg`;
const HEADER_BANNER_LEASE = `${ASSET_ORIGIN}/uploads/brand-header-for-lease.jpg`;
const ICON_LEASE_SRC = `${ASSET_ORIGIN}/uploads/icon-lease.png`;
const ICON_ZONING_SRC = `${ASSET_ORIGIN}/uploads/icon-zoning.png`;
const ICON_PARKING_SRC = `${ASSET_ORIGIN}/uploads/icon-parking.png`;
const ICON_INCOME_SRC = `${ASSET_ORIGIN}/uploads/icon-income.png`;
const ICON_LAND_AREA_SRC = `${ASSET_ORIGIN}/uploads/icon-land-area.png`;
const ICON_BUILDING_AREA_SRC = `${ASSET_ORIGIN}/uploads/icon-building-area.png`;
// Navy-colored versions of the same icons, for use on light/white backgrounds
// (the white versions above are invisible there) — pre-made as real files
// rather than a live CSS color filter, since filters are unreliable across
// email clients like Outlook.
const ICON_LEASE_SRC_NAVY = `${ASSET_ORIGIN}/uploads/icon-lease-navy.png`;
const ICON_ZONING_SRC_NAVY = `${ASSET_ORIGIN}/uploads/icon-zoning-navy.png`;
const ICON_PARKING_SRC_NAVY = `${ASSET_ORIGIN}/uploads/icon-parking-navy.png`;
const ICON_INCOME_SRC_NAVY = `${ASSET_ORIGIN}/uploads/icon-income-navy.png`;
const ICON_LAND_AREA_SRC_NAVY = `${ASSET_ORIGIN}/uploads/icon-land-area-navy.png`;
const ICON_BUILDING_AREA_SRC_NAVY = `${ASSET_ORIGIN}/uploads/icon-building-area-navy.png`;

const ICON_VARIANTS = {
  lease: { white: ICON_LEASE_SRC, navy: ICON_LEASE_SRC_NAVY },
  zoning: { white: ICON_ZONING_SRC, navy: ICON_ZONING_SRC_NAVY },
  parking: { white: ICON_PARKING_SRC, navy: ICON_PARKING_SRC_NAVY },
  income: { white: ICON_INCOME_SRC, navy: ICON_INCOME_SRC_NAVY },
  landArea: { white: ICON_LAND_AREA_SRC, navy: ICON_LAND_AREA_SRC_NAVY },
  buildingArea: { white: ICON_BUILDING_AREA_SRC, navy: ICON_BUILDING_AREA_SRC_NAVY },
};
// Reverse lookup: given whichever concrete icon URL is already stored (the
// Property Stats block saves the resolved URL per item, from before this
// color toggle existed), figure out which of the 6 icons it is so the
// toggle can still switch it — falls through unchanged for a custom/uploaded
// icon that isn't one of ours.
const ICON_URL_TO_KIND = Object.fromEntries(
  Object.entries(ICON_VARIANTS).flatMap(([kind, { white, navy }]) => [[white, kind], [navy, kind]])
);
function resolveIconColor(iconUrl, color) {
  const kind = ICON_URL_TO_KIND[iconUrl];
  return kind ? ICON_VARIANTS[kind][color] || iconUrl : iconUrl;
}

// Labeled choices for icon-picker dropdowns — "Parking" is labeled "Car
// Parks" here since that's the more natural term for a per-listing stat.
const STAT_ICON_CHOICES = [
  { kind: "buildingArea", label: "Building Area" },
  { kind: "landArea", label: "Land Area" },
  { kind: "zoning", label: "Zoning" },
  { kind: "parking", label: "Car Parks" },
  { kind: "lease", label: "Lease Term" },
  { kind: "income", label: "Income" },
];

const STARTER_BLOCKS = [
  makeBlock("navbar"),
  { ...makeBlock("header"), props: { ...defaultProps("header"), mode: "image" } },
  makeBlock("image"),
  makeBlock("stats"),
  makeBlock("text"),
  makeBlock("button"),
  makeBlock("agents"),
  makeBlock("divider"),
  makeBlock("footer"),
];



// ---------------------------------------------------------------------------
// HTML export
// ---------------------------------------------------------------------------
function escapeHtml(str = "") {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// For rich-text fields (which may contain <b>/<i>/<u>) used somewhere that
// can't hold markup, like an alt attribute — strips tags down to plain text.
function stripTags(html = "") {
  return html.replace(/<[^>]*>/g, "");
}

// Converts "#RRGGBB" + an opacity (0-1) into an rgba() string, used to darken
// a background photo just enough for overlaid text to stay legible.
function hexToRgba(hex, alpha) {
  const clean = (hex || "#000000").replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Strips a trailing " STATE POSTCODE" (e.g. " SA 5018") off an Australian
// address for compact display — used in the Listings Grid tiles, where the
// full address is redundant/long for a small card. Leaves the address
// untouched if it doesn't end in that exact pattern, rather than guessing.
function shortAddress(address = "") {
  return address.replace(/\s+[A-Z]{2,3}\s+\d{4}$/, "").trim();
}

// Returns a Listings Grid tile's stat list (icon+label pairs). Falls back to
// building/land size for tiles saved before this flexible list existed, so
// older templates keep working without needing to be manually re-edited.
function tileStats(l) {
  if (Array.isArray(l.stats) && l.stats.length > 0) return l.stats;
  const fallback = [];
  if (l.buildingSize) fallback.push({ id: "legacy-building", icon: ICON_BUILDING_AREA_SRC, label: l.buildingSize });
  if (l.landSize) fallback.push({ id: "legacy-land", icon: ICON_LAND_AREA_SRC, label: l.landSize });
  return fallback;
}

function blockToHtml(block) {
  const p = block.props;
  switch (block.type) {
    case "navbar": {
      const linkCell = (l) =>
        `<a href="${l.url}" style="color:${p.linkColor};text-decoration:none;font-family:${p.fontFamily};font-size:${p.fontSize}px;font-weight:600;white-space:nowrap;">${l.label}</a>`;
      const withLogo = p.links.map((l) =>
        `<a href="${l.url}" style="color:${p.linkColor};text-decoration:none;font-family:${p.fontFamily};font-size:${p.fontSize}px;font-weight:600;padding:0 10px;white-space:nowrap;">${l.label}</a>`
      ).join("");
      const inner = p.showLogo
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
             <td style="vertical-align:middle;"><a href="${p.logoLink}"><img src="${p.logoSrc}" alt="${escapeHtml(p.logoAlt)}" style="height:${p.logoHeight}px;display:block;" /></a></td>
             <td style="vertical-align:middle;text-align:${p.align};">${withLogo}</td>
           </tr></table>`
        // No logo: equal-width cells spread the links evenly across the full
        // bar — flexbox space-between isn't reliable enough in email clients
        // (Outlook desktop especially), so this uses a plain table instead.
        : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
             ${p.links.map((l, i) => `<td style="width:${Math.floor(100 / p.links.length)}%;text-align:${i === 0 ? "left" : i === p.links.length - 1 ? "right" : "center"};vertical-align:middle;">${linkCell(l)}</td>`).join("")}
           </tr></table>`;
      return `
      <tr><td style="background:${p.bg};padding:16px 32px;border-bottom:1px solid #EEF0F3;">
        ${inner}
      </td></tr>`;
    }
    case "header": {
      const activeImg = p.activeVariant === "lease" ? p.imageLease : p.imageSale;
      const content = `
          <div style="font-family:${p.titleFontFamily};font-size:${p.titleFontSize}px;font-weight:600;line-height:1.3;color:${p.titleColor};text-align:${p.titleAlign};">${p.title}</div>
          ${p.subtitle ? `<div style="font-family:${p.subtitleFontFamily};font-size:${p.subtitleFontSize}px;opacity:0.75;margin-top:8px;color:${p.subtitleColor};text-align:${p.subtitleAlign};">${p.subtitle}</div>` : ""}`;
      // Nested rounded corners need progressively smaller radii to stay
      // concentric — otherwise each inner layer's corners look pinched/misaligned
      // relative to the layer around it.
      const outerRadius = p.cornerRadius;
      const innerBorderRadius = Math.max(0, outerRadius - p.borderWidth);
      const bgRadius = Math.max(0, innerBorderRadius - p.innerBorderWidth - p.innerBorderGap);
      // Text mode background: a photo (with a darkening overlay so text stays
      // legible) if one's set, otherwise just the plain background color.
      // Outlook desktop ignores CSS background-image on divs, so it falls
      // back to the solid color there — acceptable degradation.
      const textModeBg = p.bgImage
        ? `background-color:${p.bg};background-image:linear-gradient(${hexToRgba(p.bg, p.bgOverlayOpacity)},${hexToRgba(p.bg, p.bgOverlayOpacity)}),url('${p.bgImage}');background-size:cover;background-position:center;`
        : `background:${p.bg};`;
      const bgBox = p.mode === "image"
        ? `<img src="${activeImg}" alt="${escapeHtml(p.imageAlt)}" style="display:block;width:100%;border-radius:${bgRadius}px;" />`
        : `<div style="${textModeBg}border-radius:${bgRadius}px;padding:${p.textPaddingY}px 32px;">${content}</div>`;
      const noBorderBox = p.mode === "image"
        ? `<img src="${activeImg}" alt="${escapeHtml(p.imageAlt)}" style="display:block;width:100%;border-radius:${outerRadius}px;border:${p.borderWidth}px solid ${p.borderColor};box-sizing:border-box;" />`
        : `<div style="${textModeBg}border-radius:${outerRadius}px;border:${p.borderWidth}px solid ${p.borderColor};padding:${p.textPaddingY}px 32px;">${content}</div>`;
      const framed = p.innerBorderWidth > 0
        ? `<div style="border:${p.borderWidth}px solid ${p.borderColor};border-radius:${outerRadius}px;padding:0;">
             <div style="border:${p.innerBorderWidth}px solid ${p.innerBorderColor};border-radius:${innerBorderRadius}px;padding:${p.innerBorderGap}px;">
               ${bgBox}
             </div>
           </div>`
        : noBorderBox;
      return `
      <tr><td style="padding:${p.outerMargin}px;">
        ${framed}
      </td></tr>`;
    }
    case "text":
      return `
      <tr><td style="background:${p.bg};padding:24px 32px;text-align:${p.align};font-family:${p.fontFamily};font-size:${p.fontSize}px;line-height:1.6;color:${p.color};white-space:pre-wrap;">${p.content}</td></tr>`;
    case "image": {
      const maxW = 600 - p.outerMargin * 2;
      if (p.layout === "hero2") {
        const [hero, small1, small2] = p.photos;
        return `
      <tr><td style="background:${p.bg};padding:0 ${p.outerMargin}px;">
        <img src="${hero?.src || ""}" alt="${escapeHtml(hero?.alt || "")}" style="width:100%;max-width:${maxW}px;display:block;border-radius:4px;" />
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr>
          <td style="width:50%;padding-right:4px;"><img src="${small1?.src || ""}" alt="${escapeHtml(small1?.alt || "")}" style="width:100%;display:block;border-radius:4px;" /></td>
          <td style="width:50%;padding-left:4px;"><img src="${small2?.src || ""}" alt="${escapeHtml(small2?.alt || "")}" style="width:100%;display:block;border-radius:4px;" /></td>
        </tr></table>
      </td></tr>`;
      }
      const photo = p.photos[0];
      return `
      <tr><td style="background:${p.bg};padding:0 ${p.outerMargin}px;">
        <img src="${photo?.src || ""}" alt="${escapeHtml(photo?.alt || "")}" style="width:100%;max-width:${p.width === "half" ? Math.round(maxW / 2) : maxW}px;display:block;border-radius:4px;" />
      </td></tr>`;
    }
    case "stats": {
      const chunkSize = Math.ceil(p.items.length / p.rows);
      const cellPct = Math.floor(100 / chunkSize);
      const cell = (item) => `
        <td style="width:${cellPct}%;text-align:${p.align};vertical-align:top;padding:${p.rowGap / 2}px 6px;">
          <img src="${resolveIconColor(item.icon, p.iconColor)}" width="${p.iconSize}" height="${p.iconSize}" style="width:${p.iconSize}px;height:${p.iconSize}px;display:block;margin:${p.align === "left" ? "0" : p.align === "right" ? "0 0 0 auto" : "0 auto"} 10px;" alt="" />
          <div style="font-family:${p.fontFamily};font-size:${p.fontSize}px;color:${p.textColor};">${item.label}</div>
        </td>`;
      const rows = chunk(p.items, chunkSize).map((row) => `
        <tr>
          ${row.map(cell).join("")}
          ${row.length < chunkSize ? `<td style="width:${cellPct}%;"></td>`.repeat(chunkSize - row.length) : ""}
        </tr>`).join("");
      return `
      <tr><td style="background:${p.bg};padding:24px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td></tr>`;
    }
    case "article": {
      const imgCell = `<td style="width:42%;vertical-align:top;"><img src="${p.photo}" alt="${escapeHtml(p.photoAlt)}" style="width:100%;display:block;border-radius:4px;" /></td>`;
      const textPadding = p.imagePosition === "left" ? "0 0 0 24px" : "0 24px 0 0";
      const textCell = `<td style="width:58%;vertical-align:top;padding:${textPadding};">
        <div style="font-family:${p.titleFontFamily};font-size:${p.titleFontSize}px;font-weight:700;color:${p.titleColor};line-height:1.3;margin-bottom:10px;">${p.title}</div>
        <div style="font-family:${p.summaryFontFamily};font-size:${p.summaryFontSize}px;color:${p.summaryColor};line-height:1.5;margin-bottom:14px;">${p.summary}</div>
        <a href="${p.buttonUrl}" style="background:${p.buttonBg};color:${p.buttonColor};padding:10px 22px;border-radius:4px;text-decoration:none;font-family:${p.titleFontFamily};font-size:13px;font-weight:600;display:inline-block;">${escapeHtml(p.buttonLabel)}</a>
      </td>`;
      const cells = p.imagePosition === "left" ? imgCell + textCell : textCell + imgCell;
      return `
      <tr><td style="background:${p.bg};padding:24px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>
      </td></tr>`;
    }
    case "listings": {
      const iconSize = 14;
      const sizeChips = (l) => {
        if (!p.showSizes) return "";
        const stats = tileStats(l);
        return stats
          .map((s, i) => {
            const iconSrc = resolveIconColor(s.icon, p.iconColor);
            const marginRight = i < stats.length - 1 ? "margin-right:14px;" : "";
            return `<span style="display:inline-block;${marginRight}"><img src="${iconSrc}" width="${iconSize}" height="${iconSize}" style="width:${iconSize}px;height:${iconSize}px;vertical-align:middle;margin-right:4px;" alt="" />${escapeHtml(s.label)}</span>`;
          })
          .join("");
      };
      const photoStyle = p.photoHeight > 0
        ? `width:100%;height:${p.photoHeight}px;display:block;object-fit:cover;`
        : `width:100%;display:block;`;
      const cardInner = (l) => `
        <a href="${l.url}" style="text-decoration:none;font-family:${p.fontFamily};font-size:${p.fontSize + 3}px;font-weight:700;color:${p.textColor};display:block;margin-bottom:8px;">${escapeHtml(shortAddress(l.address))}</a>
        ${sizeChips(l) ? `<div style="font-family:${p.fontFamily};font-size:${p.fontSize}px;color:${p.textColor};opacity:0.75;">${sizeChips(l)}</div>` : ""}`;

      let bodyHtml;
      if (p.columns === 1 && p.tileLayout === "side-by-side") {
        bodyHtml = p.listings.map((l) => `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${p.cardBg};border-radius:6px;margin-bottom:16px;"><tr>
            <td style="width:38%;vertical-align:top;"><a href="${l.url}"><img src="${l.photo}" alt="${escapeHtml(l.photoAlt)}" style="${photoStyle}border-radius:6px 0 0 6px;" /></a></td>
            <td style="width:62%;vertical-align:top;padding:16px;">${cardInner(l)}</td>
          </tr></table>`).join("");
      } else {
        const chunkSize = p.columns;
        const cellPct = Math.floor(100 / chunkSize);
        const tileCell = (l) => `
          <td style="width:${cellPct}%;vertical-align:top;padding:8px;">
            <div style="background:${p.cardBg};border-radius:6px;">
              <a href="${l.url}"><img src="${l.photo}" alt="${escapeHtml(l.photoAlt)}" style="${photoStyle}border-radius:6px 6px 0 0;" /></a>
              <div style="padding:14px;">${cardInner(l)}</div>
            </div>
          </td>`;
        const rows = chunk(p.listings, chunkSize).map((row) => `
          <tr>
            ${row.map(tileCell).join("")}
            ${row.length < chunkSize ? `<td style="width:${cellPct}%;"></td>`.repeat(chunkSize - row.length) : ""}
          </tr>`).join("");
        bodyHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
      }

      const headingRow = p.heading
        ? `<tr><td style="background:${p.headingBg};padding:14px 32px;text-align:${p.headingAlign};">
             <div style="font-family:${p.headingFontFamily};font-size:${p.headingFontSize}px;font-weight:700;color:${p.headingColor};">${p.heading}</div>
           </td></tr>`
        : "";

      return `
      <tr><td style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${headingRow}
          <tr><td style="background:${p.bg};padding:20px 24px;">${bodyHtml}</td></tr>
        </table>
      </td></tr>`;
    }
    case "button":
      return `
      <tr><td style="background:${p.sectionBg};padding:24px 32px;text-align:${p.align};">
        <a href="${p.url}" style="background:${p.bg};color:${p.color};padding:12px 28px;border-radius:4px;text-decoration:none;font-family:${p.fontFamily};font-size:${p.fontSize}px;font-weight:600;display:inline-block;">${p.label}</a>
      </td></tr>`;
    case "agents": {
      const cellPct = Math.floor(100 / p.columns);
      const agentCard = (a) => `
        <td style="width:${cellPct}%;vertical-align:top;padding:0 10px;text-align:${p.align};font-family:${p.fontFamily};font-size:${p.fontSize}px;color:${p.textColor};line-height:1.5;">
          <img src="${a.photoSrc}" alt="${escapeHtml(stripTags(a.name))}" width="108" height="108" style="width:108px;height:108px;border-radius:50%;display:block;margin:${p.align === "left" ? "0" : "0 auto"} 14px;object-fit:cover;object-position:center ${a.photoPosY ?? 50}%;" />
          <div style="font-weight:700;">${a.name}</div>
          <div style="opacity:0.75;">${a.role}</div>
          <div><a href="tel:${a.phone.replace(/\s+/g, "")}" style="color:${p.textColor};text-decoration:none;">${escapeHtml(a.phone)}</a></div>
          <div><a href="mailto:${a.email}" style="color:${p.textColor};text-decoration:none;">${escapeHtml(a.email)}</a></div>
        </td>`;
      const rows = chunk(p.agents, p.columns).map((row) => `
        <tr>
          ${row.map(agentCard).join("")}
          ${row.length < p.columns ? `<td style="width:${cellPct}%;"></td>`.repeat(p.columns - row.length) : ""}
        </tr>`).join("");
      const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:20px;" colspan="${p.columns}"></td></tr>${rows}</table>`;
      return `
      <tr><td style="background:${p.bg};padding:24px 32px;">
        <div style="font-family:${p.headingFontFamily};font-size:${p.headingFontSize}px;font-weight:600;color:${p.headingColor};text-align:${p.headingAlign};margin-bottom:16px;">${p.heading}</div>
        ${table}
      </td></tr>`;
    }
    case "divider":
      return `
      <tr><td style="background:${p.bg};padding:12px 0;"><div style="border-top:${p.thickness}px solid ${p.color};line-height:0;font-size:0;">&nbsp;</div></td></tr>`;
    case "spacer":
      return `
      <tr><td style="background:${p.bg};height:${p.height}px;line-height:${p.height}px;font-size:0;">&nbsp;</td></tr>`;
    case "footer": {
      const contactRow = p.contactLinks
        .map((c, i) => `${i > 0 ? " &nbsp;|&nbsp; " : ""}<a href="${c.url}" style="color:${p.contactColor};text-decoration:underline;">${escapeHtml(c.label)}</a>`)
        .join("");
      const socialBadge = (s) => {
        const abbr = SOCIAL_PLATFORMS.find((sp) => sp.key === s.platform)?.abbr || "?";
        return `<a href="${s.url}" style="display:inline-block;width:28px;height:28px;line-height:28px;border-radius:50%;background:#4A5568;color:#ffffff;text-align:center;font-family:${p.fontFamily};font-size:11px;font-weight:700;text-decoration:none;margin:0 4px;">${abbr}</a>`;
      };
      return `
      <tr><td style="background:${p.bg};padding:32px 24px;text-align:${p.align};">
        ${p.logo ? `<img src="${p.logo}" alt="${escapeHtml(p.logoAlt)}" style="max-width:${p.logoWidth}px;width:100%;display:block;margin:0 auto 18px;" />` : ""}
        <div style="font-family:${p.fontFamily};font-size:${p.fontSize}px;font-weight:700;line-height:1.6;">${contactRow}</div>
        <div style="font-family:${p.fontFamily};font-size:${p.fontSize}px;color:${p.contactColor};margin-bottom:16px;">${p.addressText}</div>
        <div style="margin-bottom:18px;">${p.socialLinks.map(socialBadge).join("")}</div>
        <div style="font-family:${p.fontFamily};font-size:11px;color:${p.disclaimerColor};line-height:1.6;max-width:480px;margin:0 auto;">
          ${p.disclaimerText}<br /><a href="{{{unsubscribe_url}}}" style="color:${p.disclaimerColor};text-decoration:underline;">${escapeHtml(p.manageSubscriptionLabel)}</a>
        </div>
      </td></tr>`;
    }
    default:
      return "";
  }
}

function buildFullHtml(blocks, templateName) {
  const rows = blocks.map(blockToHtml).join("\n");
  let html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(templateName)}</title>
  </head>
  <body style="margin:0;padding:24px 0;background:#EEF0F3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:${BRAND_NAVY};max-width:600px;width:100%;">
            ${rows}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  // Safety net: catches any image still referenced by a relative "/uploads/..."
  // path (e.g. photos uploaded before URLs were made absolute) and fixes it
  // up at export time too — this HTML is meant to be pasted into an external
  // CRM to send, where a relative path has nothing to resolve against.
  if (ASSET_ORIGIN) {
    html = html.replace(/(["'(])\/uploads\//g, `$1${ASSET_ORIGIN}/uploads/`);
  }
  return html;
}

// ---------------------------------------------------------------------------
// Small UI primitives
// ---------------------------------------------------------------------------
function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: inkSoft, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  border: `1px solid ${border}`,
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: uiSans,
  color: ink,
  boxSizing: "border-box",
  outline: "none",
};

function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function TextArea(props) {
  return <textarea {...props} style={{ ...inputStyle, resize: "vertical", minHeight: 90, ...(props.style || {}) }} />;
}
function ColorInput({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: 34, height: 30, border: `1px solid ${border}`, borderRadius: 6, padding: 2, cursor: "pointer" }} />
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
    </div>
  );
}

// Strips everything except bold/italic/underline/line-break formatting from a
// contentEditable's HTML — run on every change so stored content can only
// ever contain the handful of tags the toolbar below actually produces.
const RICH_TEXT_ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "BR"]);
function sanitizeRichHtml(html) {
  if (typeof document === "undefined") return html || "";
  const container = document.createElement("div");
  container.innerHTML = html || "";
  const clean = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) return; // plain text — leave as-is
      if (child.nodeType !== 1) { node.removeChild(child); return; } // comments etc.
      if (child.tagName === "SCRIPT" || child.tagName === "STYLE") {
        node.removeChild(child);
        return;
      }
      if (!RICH_TEXT_ALLOWED_TAGS.has(child.tagName)) {
        clean(child); // sanitize its contents first, then unwrap it
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        node.removeChild(child);
      } else {
        Array.from(child.attributes).forEach((attr) => child.removeAttribute(attr.name));
        clean(child);
      }
    });
  };
  clean(container);
  return container.innerHTML;
}

// A lightweight rich-text field: contentEditable + a Bold/Italic/Underline
// toolbar. Used anywhere the person is writing real content (headings, body
// copy, labels) rather than structured data (URLs, emails, numbers).
function RichTextInput({ value, onChange, placeholder, multiline = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const commit = () => {
    if (ref.current) onChange(sanitizeRichHtml(ref.current.innerHTML));
  };

  const applyFormat = (cmd) => {
    ref.current?.focus();
    document.execCommand(cmd);
    commit();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  };

  const handleFocus = () => {
    // Otherwise Enter wraps each line in a new <div>, which our sanitizer
    // (allowlisting only inline formatting tags) would unwrap and collapse.
    document.execCommand("defaultParagraphSeparator", false, "br");
  };

  const handleKeyDown = (e) => {
    if (!multiline && e.key === "Enter") e.preventDefault();
  };

  const toolbarBtn = (cmd, label, style) => (
    <button key={cmd} type="button"
      onMouseDown={(e) => e.preventDefault()} // keep focus/selection in the editor
      onClick={() => applyFormat(cmd)}
      title={cmd[0].toUpperCase() + cmd.slice(1)}
      style={{
        width: 26, height: 24, border: `1px solid ${border}`, borderRadius: 4, background: "#fff",
        cursor: "pointer", fontSize: 12, color: inkSoft, lineHeight: 1, ...style,
      }}>
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {toolbarBtn("bold", "B", { fontWeight: 700 })}
        {toolbarBtn("italic", "I", { fontStyle: "italic" })}
        {toolbarBtn("underline", "U", { textDecoration: "underline" })}
      </div>
      <div style={{ position: "relative" }}>
        {!value && placeholder && (
          <div style={{ position: "absolute", top: 8, left: 10, fontSize: 13, color: "#B7BEC7", pointerEvents: "none" }}>
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={commit}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          style={{
            ...inputStyle,
            minHeight: multiline ? 90 : 34,
            maxHeight: multiline ? 220 : 34,
            overflowY: multiline ? "auto" : "hidden",
            whiteSpace: multiline ? "pre-wrap" : "nowrap",
            cursor: "text",
            marginBottom: 14,
          }}
        />
      </div>
    </div>
  );
}
function SegButton({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", border: `1px solid ${border}`, borderRadius: 6, overflow: "hidden" }}>
      {options.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: "7px 0", fontSize: 12, fontFamily: uiSans, border: "none", cursor: "pointer",
            background: value === opt.value ? ink : "#fff", color: value === opt.value ? "#fff" : inkSoft,
            borderRight: opt !== options[options.length - 1] ? `1px solid ${border}` : "none",
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];
function FontControls({ props: p, set }) {
  return (
    <>
      <Field label="Font">
        <Select value={p.fontFamily} onChange={(v) => set({ fontFamily: v })} options={FONT_OPTIONS} />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Size (px)">
            <TextInput type="number" value={p.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Color"><ColorInput value={p.color ?? p.linkColor} onChange={(v) => set(p.linkColor !== undefined ? { linkColor: v } : { color: v })} /></Field>
        </div>
      </div>
      <Field label="Alignment">
        <SegButton value={p.align} onChange={(v) => set({ align: v })} options={ALIGN_OPTIONS} />
      </Field>
    </>
  );
}

// ---------------------------------------------------------------------------
// Property panel per block type
// ---------------------------------------------------------------------------
function ImageField({ label, value, onChange, openLibrary }) {
  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 6 }}>
        <TextInput value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="https://... or choose from library" style={{ flex: 1 }} />
        <button type="button" onClick={() => openLibrary(onChange)} title="Choose from image library"
          style={{ border: `1px solid ${border}`, borderRadius: 6, background: "#fff", padding: "0 9px", cursor: "pointer", color: inkSoft, display: "flex", alignItems: "center" }}>
          <Images size={14} />
        </button>
      </div>
    </Field>
  );
}

function VariableChips({ onInsert }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: -4, marginBottom: 14 }}>
      {VARIABLES.map((v) => (
        <button key={v.token} onClick={() => onInsert(v.token)}
          style={{
            fontSize: 11, fontFamily: uiSans, padding: "4px 8px", borderRadius: 20,
            border: `1px solid ${border}`, background: accentSoft, color: "#7A5A20", cursor: "pointer",
          }}>
          + {v.label}
        </button>
      ))}
    </div>
  );
}

function PropertyPanel({ block, updateProps, openLibrary, openListingsPicker }) {
  const set = (patch) => updateProps(block.id, patch);

  const appendToContent = (token) => set({ content: (block.props.content || "") + token });

  const setLink = (index, patch) => {
    const links = block.props.links.map((l, i) => (i === index ? { ...l, ...patch } : l));
    set({ links });
  };
  const addLink = () => set({ links: [...block.props.links, { label: "New link", url: "https://" }] });
  const removeLink = (index) => set({ links: block.props.links.filter((_, i) => i !== index) });

  const setAgent = (index, patch) => {
    const agents = block.props.agents.map((a, i) => (i === index ? { ...a, ...patch } : a));
    set({ agents });
  };
  const addAgent = () => set({
    agents: [...block.props.agents, {
      id: `agent_${Date.now()}`,
      photoSrc: "https://placehold.co/160x160/EEF0F3/171B21?text=Photo",
      photoPosY: 50,
      name: "New Agent",
      role: "Sales Agent",
      phone: "",
      email: "",
    }],
  });
  const removeAgent = (index) => set({ agents: block.props.agents.filter((_, i) => i !== index) });

  const setStatItem = (index, patch) => {
    const items = block.props.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    set({ items });
  };
  const addStatItem = () => {
    openLibrary((iconUrl) => {
      set({ items: [...block.props.items, { id: `stat_${Date.now()}`, icon: iconUrl, label: "Detail" }] });
    });
  };
  const removeStatItem = (index) => set({ items: block.props.items.filter((_, i) => i !== index) });
  const moveStatItem = (index, direction) => {
    const items = [...block.props.items];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    set({ items });
  };

  const setListing = (index, patch) => {
    const listings = block.props.listings.map((l, i) => (i === index ? { ...l, ...patch } : l));
    set({ listings });
  };
  const addListing = () => {
    openLibrary((photoUrl) => {
      set({
        listings: [...block.props.listings, {
          id: `listing_${Date.now()}`,
          photo: photoUrl,
          photoAlt: "Listing photo",
          address: "New listing address",
          url: "https://example.com",
          stats: [],
        }],
      });
    });
  };
  const removeListing = (index) => set({ listings: block.props.listings.filter((_, i) => i !== index) });
  const moveListing = (index, direction) => {
    const listings = [...block.props.listings];
    const target = index + direction;
    if (target < 0 || target >= listings.length) return;
    [listings[index], listings[target]] = [listings[target], listings[index]];
    set({ listings });
  };

  // Per-tile stat list (icon + label pairs, e.g. Building Area, Zoning, Car Parks)
  const addListingStat = (listingIndex) => {
    const listing = block.props.listings[listingIndex];
    const stats = [...tileStats(listing), { id: nextId(), icon: ICON_BUILDING_AREA_SRC, label: "" }];
    setListing(listingIndex, { stats });
  };
  const setListingStat = (listingIndex, statIndex, patch) => {
    const listing = block.props.listings[listingIndex];
    const stats = tileStats(listing).map((s, i) => (i === statIndex ? { ...s, ...patch } : s));
    setListing(listingIndex, { stats });
  };
  const removeListingStat = (listingIndex, statIndex) => {
    const listing = block.props.listings[listingIndex];
    const stats = tileStats(listing).filter((_, i) => i !== statIndex);
    setListing(listingIndex, { stats });
  };

  const setContactLink = (index, patch) => {
    const contactLinks = block.props.contactLinks.map((c, i) => (i === index ? { ...c, ...patch } : c));
    set({ contactLinks });
  };
  const addContactLink = () => set({ contactLinks: [...block.props.contactLinks, { id: `contact_${Date.now()}`, label: "New link", url: "https://" }] });
  const removeContactLink = (index) => set({ contactLinks: block.props.contactLinks.filter((_, i) => i !== index) });

  const setSocialLink = (index, patch) => {
    const socialLinks = block.props.socialLinks.map((s, i) => (i === index ? { ...s, ...patch } : s));
    set({ socialLinks });
  };
  const addSocialLink = () => set({ socialLinks: [...block.props.socialLinks, { id: `social_${Date.now()}`, platform: "facebook", url: "https://" }] });
  const removeSocialLink = (index) => set({ socialLinks: block.props.socialLinks.filter((_, i) => i !== index) });

  const setPhoto = (index, patch) => {
    const photos = block.props.photos ? [...block.props.photos] : [];
    photos[index] = { ...(photos[index] || {}), ...patch };
    set({ photos });
  };
  const switchImageLayout = (layout) => {
    const current = block.props.photos || [];
    const blank = () => ({ id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, src: "https://placehold.co/600x400/EEF0F3/9AA2AC?text=Photo", alt: "" });
    const targetLength = layout === "hero2" ? 3 : 1;
    const photos = Array.from({ length: targetLength }, (_, i) => current[i] || blank());
    set({ layout, photos });
  };

  switch (block.type) {
    case "navbar":
      return (
        <>
          <Field label="Logo">
            <SegButton value={block.props.showLogo} onChange={(v) => set({ showLogo: v })}
              options={[{ value: true, label: "Show" }, { value: false, label: "Hide" }]} />
          </Field>
          {!block.props.showLogo && (
            <div style={{ fontSize: 11, color: inkSoft, lineHeight: 1.5, marginBottom: 14 }}>
              With the logo hidden, links spread out evenly across the full width.
            </div>
          )}
          {block.props.showLogo && (
            <>
              <ImageField label="Logo image URL" value={block.props.logoSrc} onChange={(v) => set({ logoSrc: v })} openLibrary={openLibrary} />
              <Field label="Logo alt text">
                <TextInput value={block.props.logoAlt} onChange={(e) => set({ logoAlt: e.target.value })} />
              </Field>
              <Field label="Logo links to">
                <TextInput value={block.props.logoLink} onChange={(e) => set({ logoLink: e.target.value })} />
              </Field>
              <Field label={`Logo height — ${block.props.logoHeight}px`}>
                <input type="range" min="16" max="120" value={block.props.logoHeight}
                  onChange={(e) => set({ logoHeight: Number(e.target.value) })}
                  style={{ width: "100%" }} />
              </Field>
            </>
          )}
          <Field label="Background"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>
          <FontControls props={block.props} set={set} />

          <div style={{ fontSize: 12, fontWeight: 600, color: inkSoft, margin: "16px 0 8px" }}>Nav links</div>
          {block.props.links.map((l, i) => (
            <div key={i} style={{ border: `1px solid ${border}`, borderRadius: 6, padding: 8, marginBottom: 8 }}>
              <RichTextInput value={l.label} onChange={(html) => setLink(i, { label: html })} placeholder="Label" />
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput value={l.url} onChange={(e) => setLink(i, { url: e.target.value })}
                  placeholder="https://..." style={{ flex: 1 }} />
                <button onClick={() => removeLink(i)}
                  style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer", color: "#C0503D" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <button onClick={addLink}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 6, border: `1px dashed ${border}`, background: "#fff", color: inkSoft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={13} /> Add link
          </button>
        </>
      );
    case "header":
      return (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "4px 0 10px" }}>Style</div>
          <Field label="Header type">
            <SegButton value={block.props.mode} onChange={(v) => set({ mode: v })}
              options={[{ value: "text", label: "Text" }, { value: "image", label: "Branded image" }]} />
          </Field>

          {block.props.mode === "image" ? (
            <>
              <Field label="Listing type shown">
                <SegButton value={block.props.activeVariant} onChange={(v) => set({ activeVariant: v })}
                  options={[{ value: "sale", label: "For Sale" }, { value: "lease", label: "For Lease" }]} />
              </Field>
              <div style={{ fontSize: 11, color: inkSoft, lineHeight: 1.5, marginBottom: 12 }}>
                Set automatically when you use "Populate from listing" — pick manually here to preview either version.
              </div>
              <ImageField label="For Sale image" value={block.props.imageSale} onChange={(v) => set({ imageSale: v })} openLibrary={openLibrary} />
              <ImageField label="For Lease image" value={block.props.imageLease} onChange={(v) => set({ imageLease: v })} openLibrary={openLibrary} />
              <Field label="Alt text">
                <TextInput value={block.props.imageAlt} onChange={(e) => set({ imageAlt: e.target.value })} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Background color"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>
              <ImageField label="Background photo (optional)" value={block.props.bgImage} onChange={(v) => set({ bgImage: v })} openLibrary={openLibrary} />
              {block.props.bgImage && (
                <Field label={`Photo darkness — ${Math.round(block.props.bgOverlayOpacity * 100)}%`}>
                  <input type="range" min="0" max="80" value={Math.round(block.props.bgOverlayOpacity * 100)}
                    onChange={(e) => set({ bgOverlayOpacity: Number(e.target.value) / 100 })} style={{ width: "100%" }} />
                </Field>
              )}
              <div style={{ fontSize: 11, color: inkSoft, lineHeight: 1.5, marginBottom: 12 }}>
                Great for a reusable newsletter banner — same photo every month, just edit the title/subtitle text below (e.g. the month) each time instead of re-making an image.
              </div>
            </>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "16px 0 10px" }}>Shape</div>
          <Field label={`Corner radius — ${block.props.cornerRadius}px`}>
            <input type="range" min="0" max="40" value={block.props.cornerRadius}
              onChange={(e) => set({ cornerRadius: Number(e.target.value) })} style={{ width: "100%" }} />
          </Field>
          <Field label={`Outer spacing — ${block.props.outerMargin}px`}>
            <input type="range" min="0" max="40" value={block.props.outerMargin}
              onChange={(e) => set({ outerMargin: Number(e.target.value) })} style={{ width: "100%" }} />
          </Field>
          <Field label={`Outer border thickness — ${block.props.borderWidth}px`}>
            <input type="range" min="0" max="10" value={block.props.borderWidth}
              onChange={(e) => set({ borderWidth: Number(e.target.value) })} style={{ width: "100%" }} />
          </Field>
          {block.props.borderWidth > 0 && (
            <Field label="Outer border color"><ColorInput value={block.props.borderColor} onChange={(v) => set({ borderColor: v })} /></Field>
          )}
          <Field label={`Inner border thickness — ${block.props.innerBorderWidth}px`}>
            <input type="range" min="0" max="10" value={block.props.innerBorderWidth}
              onChange={(e) => set({ innerBorderWidth: Number(e.target.value) })} style={{ width: "100%" }} />
          </Field>
          {block.props.innerBorderWidth > 0 && (
            <>
              <Field label={`Whitespace before background — ${block.props.innerBorderGap}px`}>
                <input type="range" min="2" max="20" value={block.props.innerBorderGap}
                  onChange={(e) => set({ innerBorderGap: Number(e.target.value) })} style={{ width: "100%" }} />
              </Field>
              <Field label="Inner border color"><ColorInput value={block.props.innerBorderColor} onChange={(v) => set({ innerBorderColor: v })} /></Field>
              <div style={{ fontSize: 11, color: inkSoft, lineHeight: 1.5, marginBottom: 4 }}>
                The outer and inner borders sit flush against each other — this controls the gap between that border frame and where the background color starts.
              </div>
            </>
          )}
          <div style={{ fontSize: 11, color: inkSoft, lineHeight: 1.5, marginBottom: 4 }}>
            Outer spacing applies to all four sides, revealing the card background around the block — set it to 0 for a full-width edge-to-edge header, or increase it (with a corner radius) for a floating rounded panel.
          </div>
          {block.props.mode === "text" && (
            <Field label={`Space above/below text — ${block.props.textPaddingY}px`}>
              <input type="range" min="0" max="100" value={block.props.textPaddingY}
                onChange={(e) => set({ textPaddingY: Number(e.target.value) })} style={{ width: "100%" }} />
            </Field>
          )}

          {block.props.mode === "text" && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "16px 0 10px" }}>Title</div>
              <Field label="Title text">
                <RichTextInput value={block.props.title} onChange={(html) => set({ title: html })} placeholder="Header title" />
              </Field>
              <VariableChips onInsert={(t) => set({ title: block.props.title + t })} />
              <FontControls
                props={{ fontFamily: block.props.titleFontFamily, fontSize: block.props.titleFontSize, color: block.props.titleColor, align: block.props.titleAlign }}
                set={(patch) => set({
                  ...(patch.fontFamily !== undefined && { titleFontFamily: patch.fontFamily }),
                  ...(patch.fontSize !== undefined && { titleFontSize: patch.fontSize }),
                  ...(patch.color !== undefined && { titleColor: patch.color }),
                  ...(patch.align !== undefined && { titleAlign: patch.align }),
                })}
              />

              <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "20px 0 10px" }}>Subtitle</div>
              <Field label="Subtitle text">
                <RichTextInput value={block.props.subtitle} onChange={(html) => set({ subtitle: html })} placeholder="Subtitle" />
              </Field>
              <VariableChips onInsert={(t) => set({ subtitle: block.props.subtitle + t })} />
              <FontControls
                props={{ fontFamily: block.props.subtitleFontFamily, fontSize: block.props.subtitleFontSize, color: block.props.subtitleColor, align: block.props.subtitleAlign }}
                set={(patch) => set({
                  ...(patch.fontFamily !== undefined && { subtitleFontFamily: patch.fontFamily }),
                  ...(patch.fontSize !== undefined && { subtitleFontSize: patch.fontSize }),
                  ...(patch.color !== undefined && { subtitleColor: patch.color }),
                  ...(patch.align !== undefined && { subtitleAlign: patch.align }),
                })}
              />
            </>
          )}
        </>
      );
    case "text":
      return (
        <>
          <Field label="Content">
            <RichTextInput value={block.props.content} onChange={(html) => set({ content: html })} placeholder="Write your text here…" multiline />
          </Field>
          <VariableChips onInsert={appendToContent} />
          <FontControls props={block.props} set={set} />
          <Field label="Background"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>
        </>
      );
    case "image": {
      const photos = block.props.photos || [];
      return (
        <>
          <Field label="Layout">
            <SegButton value={block.props.layout} onChange={switchImageLayout}
              options={[{ value: "single", label: "Single photo" }, { value: "hero2", label: "Hero + 2 smaller" }]} />
          </Field>

          {block.props.layout === "hero2" ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "14px 0 8px" }}>Main photo</div>
              <ImageField label="Image URL" value={photos[0]?.src} onChange={(v) => setPhoto(0, { src: v })} openLibrary={openLibrary} />
              <Field label="Alt text">
                <TextInput value={photos[0]?.alt || ""} onChange={(e) => setPhoto(0, { alt: e.target.value })} />
              </Field>

              <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "18px 0 8px" }}>Photo 2 (small)</div>
              <ImageField label="Image URL" value={photos[1]?.src} onChange={(v) => setPhoto(1, { src: v })} openLibrary={openLibrary} />
              <Field label="Alt text">
                <TextInput value={photos[1]?.alt || ""} onChange={(e) => setPhoto(1, { alt: e.target.value })} />
              </Field>

              <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "18px 0 8px" }}>Photo 3 (small)</div>
              <ImageField label="Image URL" value={photos[2]?.src} onChange={(v) => setPhoto(2, { src: v })} openLibrary={openLibrary} />
              <Field label="Alt text">
                <TextInput value={photos[2]?.alt || ""} onChange={(e) => setPhoto(2, { alt: e.target.value })} />
              </Field>
            </>
          ) : (
            <>
              <ImageField label="Image URL" value={photos[0]?.src} onChange={(v) => setPhoto(0, { src: v })} openLibrary={openLibrary} />
              <Field label="Alt text">
                <TextInput value={photos[0]?.alt || ""} onChange={(e) => setPhoto(0, { alt: e.target.value })} />
              </Field>
              <Field label="Width">
                <SegButton value={block.props.width} onChange={(v) => set({ width: v })}
                  options={[{ value: "full", label: "Full" }, { value: "half", label: "Half" }]} />
              </Field>
            </>
          )}
          <Field label={`Outer spacing — ${block.props.outerMargin}px`}>
            <input type="range" min="0" max="60" value={block.props.outerMargin}
              onChange={(e) => set({ outerMargin: Number(e.target.value) })} style={{ width: "100%" }} />
          </Field>
          <div style={{ fontSize: 11, color: inkSoft, lineHeight: 1.5, marginBottom: 4 }}>
            Set to 0 for the photo to run edge-to-edge across the newsletter.
          </div>
          <Field label="Background"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>
        </>
      );
    }
    case "stats":
      return (
        <>
          <Field label="Layout">
            <SegButton value={block.props.rows} onChange={(v) => set({ rows: v })}
              options={[{ value: 1, label: "1 row" }, { value: 2, label: "2 rows" }]} />
          </Field>
          {block.props.rows > 1 && (
            <Field label={`Space between rows — ${block.props.rowGap}px`}>
              <input type="range" min="0" max="48" value={block.props.rowGap}
                onChange={(e) => set({ rowGap: Number(e.target.value) })} style={{ width: "100%" }} />
            </Field>
          )}
          <Field label="Background"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>
          <Field label={`Icon size — ${block.props.iconSize}px`}>
            <input type="range" min="20" max="72" value={block.props.iconSize}
              onChange={(e) => set({ iconSize: Number(e.target.value) })} style={{ width: "100%" }} />
          </Field>
          <Field label="Icon color">
            <SegButton value={block.props.iconColor} onChange={(v) => set({ iconColor: v })}
              options={[{ value: "white", label: "White" }, { value: "navy", label: "Navy" }]} />
            <div style={{ fontSize: 10.5, color: inkSoft, marginTop: 4 }}>Pick whichever shows up against your background — white for navy/dark, navy for light backgrounds.</div>
          </Field>
          <FontControls
            props={{ fontFamily: block.props.fontFamily, fontSize: block.props.fontSize, color: block.props.textColor, align: block.props.align }}
            set={(patch) => set({
              ...(patch.fontFamily !== undefined && { fontFamily: patch.fontFamily }),
              ...(patch.fontSize !== undefined && { fontSize: patch.fontSize }),
              ...(patch.color !== undefined && { textColor: patch.color }),
              ...(patch.align !== undefined && { align: patch.align }),
            })}
          />

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "20px 0 10px" }}>Items</div>
          {block.props.items.map((item, i) => (
            <div key={item.id} style={{ border: `1px solid ${border}`, borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
                <img src={resolveIconColor(item.icon, block.props.iconColor)} alt="" onError={handleImgError}
                  style={{
                    width: 32, height: 32, objectFit: "contain", flexShrink: 0, borderRadius: 6, padding: 4,
                    background: block.props.iconColor === "navy" ? "#fff" : BRAND_NAVY,
                    border: block.props.iconColor === "navy" ? `1px solid ${border}` : "none",
                  }} />
                <button type="button" onClick={() => openLibrary((v) => setStatItem(i, { icon: v }))} title="Choose icon from image library"
                  style={{ border: `1px solid ${border}`, borderRadius: 6, background: "#fff", padding: "0 9px", height: 32, cursor: "pointer", color: inkSoft, display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <Images size={14} />
                </button>
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <button onClick={() => moveStatItem(i, -1)} disabled={i === 0} title="Move up"
                    style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 6, padding: "0 6px", height: 32, cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#D5DAE0" : inkSoft }}>
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => moveStatItem(i, 1)} disabled={i === block.props.items.length - 1} title="Move down"
                    style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 6, padding: "0 6px", height: 32, cursor: i === block.props.items.length - 1 ? "default" : "pointer", color: i === block.props.items.length - 1 ? "#D5DAE0" : inkSoft }}>
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => removeStatItem(i)}
                    style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 6, padding: "0 8px", height: 32, cursor: "pointer", color: "#C0503D" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <RichTextInput value={item.label} onChange={(html) => setStatItem(i, { label: html })} placeholder="Caption" />
            </div>
          ))}
          <button onClick={addStatItem}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 6, border: `1px dashed ${border}`, background: "#fff", color: inkSoft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={13} /> Add item
          </button>
        </>
      );
    case "article":
      return (
        <>
          <Field label="Image position">
            <SegButton value={block.props.imagePosition} onChange={(v) => set({ imagePosition: v })}
              options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} />
          </Field>
          <ImageField label="Photo" value={block.props.photo} onChange={(v) => set({ photo: v })} openLibrary={openLibrary} />
          <Field label="Photo alt text">
            <TextInput value={block.props.photoAlt} onChange={(e) => set({ photoAlt: e.target.value })} />
          </Field>

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "16px 0 10px" }}>Title</div>
          <RichTextInput value={block.props.title} onChange={(html) => set({ title: html })} placeholder="Article title" />
          <FontControls
            props={{ fontFamily: block.props.titleFontFamily, fontSize: block.props.titleFontSize, color: block.props.titleColor, align: "left" }}
            set={(patch) => set({
              ...(patch.fontFamily !== undefined && { titleFontFamily: patch.fontFamily }),
              ...(patch.fontSize !== undefined && { titleFontSize: patch.fontSize }),
              ...(patch.color !== undefined && { titleColor: patch.color }),
            })}
          />

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "16px 0 10px" }}>Summary</div>
          <RichTextInput value={block.props.summary} onChange={(html) => set({ summary: html })} placeholder="Summary text" multiline />
          <FontControls
            props={{ fontFamily: block.props.summaryFontFamily, fontSize: block.props.summaryFontSize, color: block.props.summaryColor, align: "left" }}
            set={(patch) => set({
              ...(patch.fontFamily !== undefined && { summaryFontFamily: patch.fontFamily }),
              ...(patch.fontSize !== undefined && { summaryFontSize: patch.fontSize }),
              ...(patch.color !== undefined && { summaryColor: patch.color }),
            })}
          />

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "16px 0 10px" }}>Button</div>
          <RichTextInput value={block.props.buttonLabel} onChange={(html) => set({ buttonLabel: html })} placeholder="Read More" />
          <Field label="Link URL">
            <TextInput value={block.props.buttonUrl} onChange={(e) => set({ buttonUrl: e.target.value })} />
          </Field>
          <Field label="Button color"><ColorInput value={block.props.buttonBg} onChange={(v) => set({ buttonBg: v })} /></Field>
          <Field label="Button text color"><ColorInput value={block.props.buttonColor} onChange={(v) => set({ buttonColor: v })} /></Field>

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "16px 0 10px" }}>Section</div>
          <Field label="Background"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>
        </>
      );
    case "listings":
      return (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "4px 0 10px" }}>Heading</div>
          <RichTextInput value={block.props.heading} onChange={(html) => set({ heading: html })} placeholder="Featured Listings" />
          <Field label="Heading background"><ColorInput value={block.props.headingBg} onChange={(v) => set({ headingBg: v })} /></Field>
          <FontControls
            props={{ fontFamily: block.props.headingFontFamily, fontSize: block.props.headingFontSize, color: block.props.headingColor, align: block.props.headingAlign }}
            set={(patch) => set({
              ...(patch.fontFamily !== undefined && { headingFontFamily: patch.fontFamily }),
              ...(patch.fontSize !== undefined && { headingFontSize: patch.fontSize }),
              ...(patch.color !== undefined && { headingColor: patch.color }),
              ...(patch.align !== undefined && { headingAlign: patch.align }),
            })}
          />

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "16px 0 10px" }}>Layout</div>
          <Field label="Columns">
            <SegButton value={block.props.columns} onChange={(v) => set({ columns: v })}
              options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }]} />
          </Field>
          {block.props.columns === 1 && (
            <Field label="Tile style">
              <SegButton value={block.props.tileLayout} onChange={(v) => set({ tileLayout: v })}
                options={[{ value: "stacked", label: "Photo on top" }, { value: "side-by-side", label: "Photo beside text" }]} />
            </Field>
          )}
          <Field label={`Tile photo height — ${block.props.photoHeight > 0 ? `${block.props.photoHeight}px` : "Auto"}`}>
            <input type="range" min="0" max="400" step="10" value={block.props.photoHeight}
              onChange={(e) => set({ photoHeight: Number(e.target.value) })} style={{ width: "100%" }} />
          </Field>
          <Field label="Show stats row (size, zoning, etc)">
            <SegButton value={block.props.showSizes} onChange={(v) => set({ showSizes: v })}
              options={[{ value: true, label: "On" }, { value: false, label: "Off" }]} />
          </Field>
          {block.props.showSizes && (
            <Field label="Size icon color">
              <SegButton value={block.props.iconColor} onChange={(v) => set({ iconColor: v })}
                options={[{ value: "navy", label: "Navy" }, { value: "white", label: "White" }]} />
              <div style={{ fontSize: 10.5, color: inkSoft, marginTop: 4 }}>Pick whichever shows up against your card background — navy for light cards, white for dark ones.</div>
            </Field>
          )}
          <Field label="Section background"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>
          <Field label="Card background"><ColorInput value={block.props.cardBg} onChange={(v) => set({ cardBg: v })} /></Field>
          <FontControls
            props={{ fontFamily: block.props.fontFamily, fontSize: block.props.fontSize, color: block.props.textColor, align: "left" }}
            set={(patch) => set({
              ...(patch.fontFamily !== undefined && { fontFamily: patch.fontFamily }),
              ...(patch.fontSize !== undefined && { fontSize: patch.fontSize }),
              ...(patch.color !== undefined && { textColor: patch.color }),
            })}
          />

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "20px 0 10px" }}>Listings</div>
          <button onClick={() => openListingsPicker(block.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", marginBottom: 8, borderRadius: 6, border: "none", background: ink, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <ClipboardCheck size={13} /> Select from system listings
          </button>
          {block.props.listings.map((l, i) => (
            <div key={l.id} style={{ border: `1px solid ${border}`, borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <img src={l.photo} alt="" onError={handleImgError} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <button onClick={() => moveListing(i, -1)} disabled={i === 0} title="Move up"
                    style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 6, padding: "0 6px", height: 32, cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#D5DAE0" : inkSoft }}>
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => moveListing(i, 1)} disabled={i === block.props.listings.length - 1} title="Move down"
                    style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 6, padding: "0 6px", height: 32, cursor: i === block.props.listings.length - 1 ? "default" : "pointer", color: i === block.props.listings.length - 1 ? "#D5DAE0" : inkSoft }}>
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => removeListing(i)}
                    style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 6, padding: "0 8px", height: 32, cursor: "pointer", color: "#C0503D" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <ImageField label="Photo" value={l.photo} onChange={(v) => setListing(i, { photo: v })} openLibrary={openLibrary} />
              <Field label="Address">
                <TextInput value={l.address} onChange={(e) => setListing(i, { address: e.target.value })} />
              </Field>

              <div style={{ fontSize: 10.5, fontWeight: 700, color: inkSoft, textTransform: "uppercase", letterSpacing: 0.3, margin: "10px 0 6px" }}>Stats shown on this tile</div>
              {tileStats(l).map((s, si) => (
                <div key={s.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 4, background: BRAND_NAVY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <img src={s.icon} alt="" onError={handleImgError} style={{ width: 14, height: 14, objectFit: "contain" }} />
                  </div>
                  <div style={{ width: 118, flexShrink: 0 }}>
                    <Select
                      value={ICON_URL_TO_KIND[s.icon] || "custom"}
                      onChange={(kind) => {
                        if (kind === "custom") { openLibrary((v) => setListingStat(i, si, { icon: v })); return; }
                        setListingStat(i, si, { icon: ICON_VARIANTS[kind].white });
                      }}
                      options={[...STAT_ICON_CHOICES.map((c) => ({ value: c.kind, label: c.label })), { value: "custom", label: "Custom icon…" }]}
                    />
                  </div>
                  <TextInput value={s.label} onChange={(e) => setListingStat(i, si, { label: e.target.value })} placeholder="e.g. 180m²" style={{ flex: 1 }} />
                  <button onClick={() => removeListingStat(i, si)}
                    style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 6, padding: "0 8px", height: 32, cursor: "pointer", color: "#C0503D", flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button onClick={() => addListingStat(i)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 0", marginBottom: 10, borderRadius: 6, border: `1px dashed ${border}`, background: "#fff", color: inkSoft, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                <Plus size={12} /> Add a stat
              </button>

              <Field label="External link (photo links here)">
                <TextInput value={l.url} onChange={(e) => setListing(i, { url: e.target.value })} placeholder="https://..." />
              </Field>
            </div>
          ))}
          <button onClick={addListing}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 6, border: `1px dashed ${border}`, background: "#fff", color: inkSoft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={13} /> Add a blank listing manually
          </button>
        </>
      );
    case "button":
      return (
        <>
          <Field label="Button text">
            <RichTextInput value={block.props.label} onChange={(html) => set({ label: html })} placeholder="Button text" />
          </Field>
          <Field label="Link URL">
            <TextInput value={block.props.url} onChange={(e) => set({ url: e.target.value })} />
          </Field>
          <Field label="Button color"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>
          <FontControls props={block.props} set={set} />
          <Field label="Section background"><ColorInput value={block.props.sectionBg} onChange={(v) => set({ sectionBg: v })} /></Field>
        </>
      );
    case "agents":
      return (
        <>
          <Field label="Background"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "4px 0 10px" }}>Heading</div>
          <Field label="Heading text">
            <RichTextInput value={block.props.heading} onChange={(html) => set({ heading: html })} placeholder="Contact our agents" />
          </Field>
          <FontControls
            props={{ fontFamily: block.props.headingFontFamily, fontSize: block.props.headingFontSize, color: block.props.headingColor, align: block.props.headingAlign }}
            set={(patch) => set({
              ...(patch.fontFamily !== undefined && { headingFontFamily: patch.fontFamily }),
              ...(patch.fontSize !== undefined && { headingFontSize: patch.fontSize }),
              ...(patch.color !== undefined && { headingColor: patch.color }),
              ...(patch.align !== undefined && { headingAlign: patch.align }),
            })}
          />

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "20px 0 10px" }}>Agent details style</div>
          <FontControls
            props={{ fontFamily: block.props.fontFamily, fontSize: block.props.fontSize, color: block.props.textColor, align: block.props.align }}
            set={(patch) => set({
              ...(patch.fontFamily !== undefined && { fontFamily: patch.fontFamily }),
              ...(patch.fontSize !== undefined && { fontSize: patch.fontSize }),
              ...(patch.color !== undefined && { textColor: patch.color }),
              ...(patch.align !== undefined && { align: patch.align }),
            })}
          />

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "20px 0 10px" }}>Layout</div>
          <Field label="Agents per row">
            <SegButton value={block.props.columns} onChange={(v) => set({ columns: v })}
              options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} />
          </Field>

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "20px 0 10px" }}>Agents</div>
          {block.props.agents.map((a, i) => (
            <div key={a.id} style={{ border: `1px solid ${border}`, borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <img src={a.photoSrc} alt="" onError={handleImgError}
                  style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", objectPosition: `center ${a.photoPosY ?? 50}%`, flexShrink: 0, border: `1px solid ${border}` }} />
                <TextInput value={a.photoSrc} onChange={(e) => setAgent(i, { photoSrc: e.target.value })} placeholder="Photo URL" style={{ flex: 1 }} />
                <button type="button" onClick={() => openLibrary((v) => setAgent(i, { photoSrc: v }))} title="Choose from image library"
                  style={{ border: `1px solid ${border}`, borderRadius: 6, background: "#fff", padding: "0 9px", cursor: "pointer", color: inkSoft, display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <Images size={14} />
                </button>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: inkSoft, marginBottom: 4 }}>
                  <span>Photo position</span><span>{a.photoPosY ?? 50}%</span>
                </div>
                <input type="range" min="0" max="100" value={a.photoPosY ?? 50}
                  onChange={(e) => setAgent(i, { photoPosY: Number(e.target.value) })}
                  style={{ width: "100%" }} />
              </div>
              <RichTextInput value={a.name} onChange={(html) => setAgent(i, { name: html })} placeholder="Name" />
              <RichTextInput value={a.role} onChange={(html) => setAgent(i, { role: html })} placeholder="Role / title" />
              <TextInput value={a.phone} onChange={(e) => setAgent(i, { phone: e.target.value })} placeholder="Phone" style={{ marginBottom: 6 }} />
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput value={a.email} onChange={(e) => setAgent(i, { email: e.target.value })} placeholder="Email" style={{ flex: 1 }} />
                <button onClick={() => removeAgent(i)}
                  style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer", color: "#C0503D" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <button onClick={addAgent}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 6, border: `1px dashed ${border}`, background: "#fff", color: inkSoft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={13} /> Add agent
          </button>
        </>
      );
    case "divider":
      return (
        <>
          <Field label="Color"><ColorInput value={block.props.color} onChange={(v) => set({ color: v })} /></Field>
          <Field label="Thickness (px)">
            <TextInput type="number" min="1" value={block.props.thickness} onChange={(e) => set({ thickness: Number(e.target.value) })} />
          </Field>
          <Field label="Background"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>
        </>
      );
    case "spacer":
      return (
        <>
          <Field label="Height (px)">
            <TextInput type="number" value={block.props.height} onChange={(e) => set({ height: Number(e.target.value) })} />
          </Field>
          <Field label="Background"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>
        </>
      );
    case "footer":
      return (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "4px 0 10px" }}>Logo</div>
          <ImageField label="Logo (optional)" value={block.props.logo} onChange={(v) => set({ logo: v })} openLibrary={openLibrary} />
          {block.props.logo && (
            <>
              <Field label="Logo alt text">
                <TextInput value={block.props.logoAlt} onChange={(e) => set({ logoAlt: e.target.value })} />
              </Field>
              <Field label={`Logo width — ${block.props.logoWidth}px`}>
                <input type="range" min="80" max="400" value={block.props.logoWidth}
                  onChange={(e) => set({ logoWidth: Number(e.target.value) })} style={{ width: "100%" }} />
              </Field>
            </>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "18px 0 10px" }}>Contact links</div>
          {block.props.contactLinks.map((c, i) => (
            <div key={c.id} style={{ border: `1px solid ${border}`, borderRadius: 6, padding: 8, marginBottom: 8 }}>
              <TextInput value={c.label} onChange={(e) => setContactLink(i, { label: e.target.value })} placeholder="Label" style={{ marginBottom: 6 }} />
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput value={c.url} onChange={(e) => setContactLink(i, { url: e.target.value })} placeholder="tel:... / mailto:... / https://..." style={{ flex: 1 }} />
                <button onClick={() => removeContactLink(i)}
                  style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer", color: "#C0503D" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <button onClick={addContactLink}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 6, border: `1px dashed ${border}`, background: "#fff", color: inkSoft, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}>
            <Plus size={13} /> Add contact link
          </button>
          <Field label="Contact text color"><ColorInput value={block.props.contactColor} onChange={(v) => set({ contactColor: v })} /></Field>

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "18px 0 10px" }}>Address</div>
          <RichTextInput value={block.props.addressText} onChange={(html) => set({ addressText: html })} placeholder="Address" />

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "18px 0 10px" }}>Social icons</div>
          {block.props.socialLinks.map((s, i) => (
            <div key={s.id} style={{ border: `1px solid ${border}`, borderRadius: 6, padding: 8, marginBottom: 8 }}>
              <Select value={s.platform} onChange={(v) => setSocialLink(i, { platform: v })}
                options={SOCIAL_PLATFORMS.map((sp) => ({ label: sp.label, value: sp.key }))} />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <TextInput value={s.url} onChange={(e) => setSocialLink(i, { url: e.target.value })} placeholder="https://..." style={{ flex: 1 }} />
                <button onClick={() => removeSocialLink(i)}
                  style={{ border: `1px solid ${border}`, background: "#fff", borderRadius: 6, padding: "0 8px", cursor: "pointer", color: "#C0503D" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <button onClick={addSocialLink}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 6, border: `1px dashed ${border}`, background: "#fff", color: inkSoft, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={13} /> Add social icon
          </button>

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "18px 0 10px" }}>Disclaimer</div>
          <RichTextInput value={block.props.disclaimerText} onChange={(html) => set({ disclaimerText: html })} placeholder="Disclaimer text" multiline />
          <Field label={`"Manage subscription" link text`}>
            <TextInput value={block.props.manageSubscriptionLabel} onChange={(e) => set({ manageSubscriptionLabel: e.target.value })} />
          </Field>
          <Field label="Disclaimer text color"><ColorInput value={block.props.disclaimerColor} onChange={(v) => set({ disclaimerColor: v })} /></Field>
          <div style={{ fontSize: 11, color: inkSoft, lineHeight: 1.5, marginBottom: 4 }}>
            The "Manage subscription" link is automatically wired to your unsubscribe page on export.
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, margin: "18px 0 10px" }}>Section</div>
          <Field label="Background"><ColorInput value={block.props.bg} onChange={(v) => set({ bg: v })} /></Field>
          <Field label="Font">
            <Select value={block.props.fontFamily} onChange={(v) => set({ fontFamily: v })} options={FONT_OPTIONS} />
          </Field>
          <Field label={`Font size — ${block.props.fontSize}px`}>
            <input type="range" min="10" max="18" value={block.props.fontSize}
              onChange={(e) => set({ fontSize: Number(e.target.value) })} style={{ width: "100%" }} />
          </Field>
          <Field label="Alignment">
            <SegButton value={block.props.align} onChange={(v) => set({ align: v })} options={ALIGN_OPTIONS} />
          </Field>
        </>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Canvas block renderer (visual, matches export HTML)
// ---------------------------------------------------------------------------
function BlockPreview({ block }) {
  const p = block.props;
  switch (block.type) {
    case "navbar":
      return (
        <div style={{ background: p.bg, padding: "16px 32px", borderBottom: "1px solid #EEF0F3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          {p.showLogo && (
            <img src={p.logoSrc} alt={p.logoAlt} onError={handleImgError} draggable={false} style={{ height: p.logoHeight, display: "block" }} />
          )}
          <div style={{
            display: "flex", gap: 4, flexWrap: "wrap", flex: 1,
            justifyContent: p.showLogo
              ? (p.align === "left" ? "flex-start" : p.align === "center" ? "center" : "flex-end")
              : "space-between",
          }}>
            {p.links.map((l, i) => (
              <span key={i} style={{ color: p.linkColor, fontFamily: p.fontFamily, fontSize: p.fontSize, fontWeight: 600, padding: "4px 10px" }}
                dangerouslySetInnerHTML={{ __html: l.label }} />
            ))}
          </div>
        </div>
      );
    case "header": {
      const activeImg = p.activeVariant === "lease" ? p.imageLease : p.imageSale;
      const titleBlock = (
        <>
          <div style={{ fontFamily: p.titleFontFamily, fontSize: p.titleFontSize, fontWeight: 600, lineHeight: 1.3, color: p.titleColor, textAlign: p.titleAlign }}
            dangerouslySetInnerHTML={{ __html: p.title || "Header title" }} />
          {p.subtitle && (
            <div style={{ fontFamily: p.subtitleFontFamily, fontSize: p.subtitleFontSize, opacity: 0.75, marginTop: 8, color: p.subtitleColor, textAlign: p.subtitleAlign }}
              dangerouslySetInnerHTML={{ __html: p.subtitle }} />
          )}
        </>
      );
      // Nested rounded corners need progressively smaller radii to stay
      // concentric — otherwise each inner layer's corners look pinched/misaligned.
      const outerRadius = p.cornerRadius;
      const innerBorderRadius = Math.max(0, outerRadius - p.borderWidth);
      const bgRadius = Math.max(0, innerBorderRadius - p.innerBorderWidth - p.innerBorderGap);
      const textModeBgStyle = p.bgImage
        ? {
            backgroundColor: p.bg,
            backgroundImage: `linear-gradient(${hexToRgba(p.bg, p.bgOverlayOpacity)},${hexToRgba(p.bg, p.bgOverlayOpacity)}),url('${p.bgImage}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
        : { background: p.bg };
      const bgBox = p.mode === "image" ? (
        <img src={activeImg} alt={p.imageAlt} onError={handleImgError} draggable={false}
          style={{ display: "block", width: "100%", borderRadius: bgRadius }} />
      ) : (
        <div style={{ ...textModeBgStyle, borderRadius: bgRadius, padding: `${p.textPaddingY}px 32px` }}>
          {titleBlock}
        </div>
      );
      const noBorderBox = p.mode === "image" ? (
        <img src={activeImg} alt={p.imageAlt} onError={handleImgError} draggable={false}
          style={{ display: "block", width: "100%", borderRadius: outerRadius, border: `${p.borderWidth}px solid ${p.borderColor}`, boxSizing: "border-box" }} />
      ) : (
        <div style={{ ...textModeBgStyle, borderRadius: outerRadius, border: `${p.borderWidth}px solid ${p.borderColor}`, padding: `${p.textPaddingY}px 32px` }}>
          {titleBlock}
        </div>
      );
      return (
        <div style={{ padding: p.outerMargin }}>
          {p.innerBorderWidth > 0 ? (
            <div style={{ border: `${p.borderWidth}px solid ${p.borderColor}`, borderRadius: outerRadius }}>
              <div style={{ border: `${p.innerBorderWidth}px solid ${p.innerBorderColor}`, borderRadius: innerBorderRadius, padding: p.innerBorderGap }}>
                {bgBox}
              </div>
            </div>
          ) : noBorderBox}
        </div>
      );
    }
    case "text":
      return (
        <div style={{ background: p.bg, padding: "24px 32px", textAlign: p.align, fontFamily: p.fontFamily, fontSize: p.fontSize, lineHeight: 1.6, color: p.color, whiteSpace: "pre-wrap" }}
          dangerouslySetInnerHTML={{ __html: p.content || "Text block" }} />
      );
    case "image": {
      if (p.layout === "hero2") {
        const [hero, small1, small2] = p.photos;
        return (
          <div style={{ background: p.bg, padding: `0 ${p.outerMargin}px` }}>
            <img src={hero?.src} alt={hero?.alt} onError={handleImgError} draggable={false} style={{ width: "100%", display: "block", borderRadius: 4 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <img src={small1?.src} alt={small1?.alt} onError={handleImgError} draggable={false} style={{ width: "50%", display: "block", borderRadius: 4 }} />
              <img src={small2?.src} alt={small2?.alt} onError={handleImgError} draggable={false} style={{ width: "50%", display: "block", borderRadius: 4 }} />
            </div>
          </div>
        );
      }
      const photo = p.photos[0];
      return (
        <div style={{ background: p.bg, padding: `0 ${p.outerMargin}px` }}>
          <img src={photo?.src} alt={photo?.alt} onError={handleImgError} draggable={false} style={{ width: p.width === "half" ? "50%" : "100%", display: "block", borderRadius: 4 }} />
        </div>
      );
    }
    case "stats": {
      const chunkSize = Math.ceil(p.items.length / p.rows);
      return (
        <div style={{ background: p.bg, padding: "24px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${chunkSize}, 1fr)`, gap: `${p.rowGap}px 8px` }}>
            {p.items.map((item) => (
              <div key={item.id} style={{ display: "flex", flexDirection: "column", alignItems: p.align === "left" ? "flex-start" : p.align === "right" ? "flex-end" : "center" }}>
                <img src={resolveIconColor(item.icon, p.iconColor)} alt="" onError={handleImgError} draggable={false} style={{ width: p.iconSize, height: p.iconSize, marginBottom: 10, objectFit: "contain" }} />
                <div style={{ fontFamily: p.fontFamily, fontSize: p.fontSize, color: p.textColor, textAlign: p.align }}
                  dangerouslySetInnerHTML={{ __html: item.label }} />
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "article": {
      const photoEl = (
        <div style={{ flex: "0 0 42%" }}>
          <img src={p.photo} alt={p.photoAlt} onError={handleImgError} draggable={false} style={{ width: "100%", display: "block", borderRadius: 4 }} />
        </div>
      );
      const textEl = (
        <div style={{ flex: "0 0 58%", paddingLeft: p.imagePosition === "left" ? 24 : 0, paddingRight: p.imagePosition === "right" ? 24 : 0 }}>
          <div style={{ fontFamily: p.titleFontFamily, fontSize: p.titleFontSize, fontWeight: 700, color: p.titleColor, lineHeight: 1.3, marginBottom: 10 }}
            dangerouslySetInnerHTML={{ __html: p.title }} />
          <div style={{ fontFamily: p.summaryFontFamily, fontSize: p.summaryFontSize, color: p.summaryColor, lineHeight: 1.5, marginBottom: 14 }}
            dangerouslySetInnerHTML={{ __html: p.summary }} />
          <span style={{ background: p.buttonBg, color: p.buttonColor, padding: "10px 22px", borderRadius: 4, fontFamily: p.titleFontFamily, fontSize: 13, fontWeight: 600, display: "inline-block" }}
            dangerouslySetInnerHTML={{ __html: p.buttonLabel }} />
        </div>
      );
      return (
        <div style={{ background: p.bg, padding: "24px 32px", display: "flex", gap: 0 }}>
          {p.imagePosition === "left" ? <>{photoEl}{textEl}</> : <>{textEl}{photoEl}</>}
        </div>
      );
    }
    case "listings": {
      const sizeChips = (l) => (
        <div style={{ fontFamily: p.fontFamily, fontSize: p.fontSize, color: p.textColor, opacity: 0.75, marginBottom: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {tileStats(l).map((s) => (
            <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <img src={resolveIconColor(s.icon, p.iconColor)} alt="" style={{ width: 14, height: 14 }} />{s.label}
            </span>
          ))}
        </div>
      );
      const cardInner = (l) => (
        <>
          <div style={{ fontFamily: p.fontFamily, fontSize: p.fontSize + 3, fontWeight: 700, color: p.textColor, marginBottom: 8 }}>{shortAddress(l.address)}</div>
          {p.showSizes && tileStats(l).length > 0 && sizeChips(l)}
        </>
      );
      const photoImgStyle = p.photoHeight > 0
        ? { width: "100%", height: p.photoHeight, display: "block", objectFit: "cover" }
        : { width: "100%", display: "block" };
      const sideBySide = p.columns === 1 && p.tileLayout === "side-by-side";
      return (
        <div>
          {p.heading && (
            <div style={{ background: p.headingBg, padding: "14px 32px", textAlign: p.headingAlign }}>
              <div style={{ fontFamily: p.headingFontFamily, fontSize: p.headingFontSize, fontWeight: 700, color: p.headingColor }}
                dangerouslySetInnerHTML={{ __html: p.heading }} />
            </div>
          )}
          <div style={{ background: p.bg, padding: "20px 24px" }}>
            {sideBySide ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {p.listings.map((l) => (
                  <div key={l.id} style={{ background: p.cardBg, borderRadius: 6, overflow: "hidden", display: "flex" }}>
                    <div style={{ flex: "0 0 38%" }}>
                      <img src={l.photo} alt={l.photoAlt} onError={handleImgError} draggable={false} style={{ ...photoImgStyle, height: p.photoHeight > 0 ? p.photoHeight : "100%" }} />
                    </div>
                    <div style={{ flex: "0 0 62%", padding: 16 }}>{cardInner(l)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${p.columns}, 1fr)`, gap: 16 }}>
                {p.listings.map((l) => (
                  <div key={l.id} style={{ background: p.cardBg, borderRadius: 6, overflow: "hidden" }}>
                    <img src={l.photo} alt={l.photoAlt} onError={handleImgError} draggable={false} style={photoImgStyle} />
                    <div style={{ padding: 14 }}>{cardInner(l)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    case "button":
      return (
        <div style={{ background: p.sectionBg, padding: "24px 32px", textAlign: p.align }}>
          <span style={{ background: p.bg, color: p.color, padding: "12px 28px", borderRadius: 4, fontFamily: p.fontFamily, fontSize: p.fontSize, fontWeight: 600, display: "inline-block" }}
            dangerouslySetInnerHTML={{ __html: p.label || "Button" }} />
        </div>
      );
    case "agents":
      return (
        <div style={{ background: p.bg, padding: "24px 32px" }}>
          <div style={{ fontFamily: p.headingFontFamily, fontSize: p.headingFontSize, fontWeight: 600, color: p.headingColor, textAlign: p.headingAlign, marginBottom: 16 }}
            dangerouslySetInnerHTML={{ __html: p.heading }} />
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${p.columns}, 1fr)`, gap: 20 }}>
            {p.agents.map((a) => (
              <div key={a.id} style={{ display: "flex", flexDirection: "column", alignItems: p.align === "left" ? "flex-start" : p.align === "right" ? "flex-end" : "center" }}>
                <img src={a.photoSrc} alt={a.name} onError={handleImgError} draggable={false}
                  style={{ width: 108, height: 108, borderRadius: "50%", objectFit: "cover", objectPosition: `center ${a.photoPosY ?? 50}%`, marginBottom: 12 }} />
                <div style={{ fontFamily: p.fontFamily, fontSize: p.fontSize, color: p.textColor, textAlign: p.align, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700 }} dangerouslySetInnerHTML={{ __html: a.name }} />
                  <div style={{ opacity: 0.75 }} dangerouslySetInnerHTML={{ __html: a.role }} />
                  <div>{a.phone}</div>
                  <div>{a.email}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case "divider":
      return (
        <div style={{ background: p.bg, padding: "12px 0" }}>
          <div style={{ borderTop: `${p.thickness}px solid ${p.color}` }} />
        </div>
      );
    case "spacer":
      return <div style={{ background: p.bg, height: p.height }} />;
    case "footer":
      return (
        <div style={{ background: p.bg, padding: "32px 24px", textAlign: p.align }}>
          {p.logo && (
            <img src={p.logo} alt={p.logoAlt} onError={handleImgError} draggable={false}
              style={{ maxWidth: p.logoWidth, width: "100%", display: "block", margin: "0 auto 18px" }} />
          )}
          <div style={{ fontFamily: p.fontFamily, fontSize: p.fontSize, fontWeight: 700, lineHeight: 1.6 }}>
            {p.contactLinks.map((c, i) => (
              <span key={c.id}>
                {i > 0 && <span style={{ color: p.contactColor }}>&nbsp;|&nbsp;</span>}
                <span style={{ color: p.contactColor, textDecoration: "underline" }}>{c.label}</span>
              </span>
            ))}
          </div>
          <div style={{ fontFamily: p.fontFamily, fontSize: p.fontSize, color: p.contactColor, marginBottom: 16 }}
            dangerouslySetInnerHTML={{ __html: p.addressText }} />
          <div style={{ marginBottom: 18, display: "flex", justifyContent: p.align === "left" ? "flex-start" : p.align === "right" ? "flex-end" : "center", gap: 8 }}>
            {p.socialLinks.map((s) => {
              const platform = SOCIAL_PLATFORMS.find((sp) => sp.key === s.platform);
              const Icon = platform?.Icon;
              return (
                <span key={s.id} style={{ width: 28, height: 28, borderRadius: "50%", background: "#4A5568", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {Icon && <Icon size={14} />}
                </span>
              );
            })}
          </div>
          <div style={{ fontFamily: p.fontFamily, fontSize: 11, color: p.disclaimerColor, lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
            <span dangerouslySetInnerHTML={{ __html: p.disclaimerText }} />
            <br />
            <span style={{ textDecoration: "underline" }}>{p.manageSubscriptionLabel}</span>
          </div>
        </div>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------
export default function NewsletterBuilder() {
  const [blocks, setBlocks] = useState(STARTER_BLOCKS);
  const [selectedId, setSelectedId] = useState(STARTER_BLOCKS[0].id);
  const [templateName, setTemplateName] = useState("New Listing Alert");
  const [dragState, setDragState] = useState(null); // { source: 'palette'|'canvas', type?, index? }
  const [dropIndex, setDropIndex] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy code");
  const fileInputRef = useRef(null);

  // --- Shared image library (LOCAL PREVIEW ONLY — in-memory, not persisted.
  // The deployed builder at /builder in the real server uses actual file
  // uploads via the backend instead; this is purely for iterating on the UX.) ---
  // --- Admin token (same pattern as the plain admin dashboard) ---
  const [adminToken, setAdminToken] = useState(() => (typeof window !== "undefined" && localStorage.getItem("adminToken")) || "");
  const saveAdminToken = (value) => {
    setAdminToken(value);
    localStorage.setItem("adminToken", value);
  };

  // --- Shared image library (real files, stored on the server) ---
  const [imageLibrary, setImageLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryUploading, setLibraryUploading] = useState(false);
  const [libraryError, setLibraryError] = useState(null);
  const [libraryOnSelect, setLibraryOnSelect] = useState(null); // holds the callback for whichever field opened the picker
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const libraryFileInputRef = useRef(null);
  const [assetsSeeding, setAssetsSeeding] = useState(false);

  const loadImageLibrary = useCallback(async () => {
    if (!adminToken) { setLibraryLoading(false); return; }
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const rows = await apiFetch("/api/images", adminToken);
      setImageLibrary(rows);
    } catch (e) {
      setLibraryError(`Couldn't load the image library: ${e.message}`);
    } finally {
      setLibraryLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { loadImageLibrary(); }, [loadImageLibrary]);

  const seedBrandAssets = async () => {
    setAssetsSeeding(true);
    try {
      await apiFetch("/api/dev/seed-brand-assets", adminToken, { method: "POST" });
      await loadImageLibrary();
    } catch (e) {
      setLibraryError(`Couldn't seed brand assets: ${e.message}`);
    } finally {
      setAssetsSeeding(false);
    }
  };

  const openLibrary = (onSelect) => {
    setLibraryOnSelect(() => onSelect);
    setLibraryModalOpen(true);
  };

  const handleLibraryUpload = async (fileList) => {
    if (!adminToken) { setLibraryError("Enter your admin token first (top right)."); return; }
    setLibraryUploading(true);
    setLibraryError(null);
    try {
      const form = new FormData();
      for (const file of Array.from(fileList)) {
        if (!file.type.startsWith("image/")) continue;
        form.append("files", file);
      }
      const saved = await apiFetch("/api/images", adminToken, { method: "POST", body: form });
      setImageLibrary((prev) => [...saved, ...prev]);
    } catch (e) {
      setLibraryError(`Upload failed: ${e.message}`);
    } finally {
      setLibraryUploading(false);
    }
  };

  const handleLibraryDelete = async (id) => {
    try {
      await apiFetch(`/api/images/${id}`, adminToken, { method: "DELETE" });
      setImageLibrary((prev) => prev.filter((img) => img.id !== id));
    } catch (e) {
      setLibraryError(`Couldn't delete that image: ${e.message}`);
    }
  };

  const handleLibraryPick = (entry) => {
    if (libraryOnSelect) libraryOnSelect(entry.url);
    setLibraryModalOpen(false);
  };

  // --- Listings (real data, pulled in via Zapier -> /api/webhooks/listing,
  // or bulk-imported from a Rex CSV export for historical backfill) ---
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState(null);
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [populatedNote, setPopulatedNote] = useState(null);
  const [seedingListings, setSeedingListings] = useState(false);
  const [listingsImporting, setListingsImporting] = useState(false);
  const [listingsImportNote, setListingsImportNote] = useState(null);
  const listingsCsvInputRef = useRef(null);

  // --- Listings Grid checkbox picker: bulk-add real system listings into a
  // specific Listings Grid block's tile array in one go ---
  const [listingsPickerOpen, setListingsPickerOpen] = useState(false);
  const [listingsPickerBlockId, setListingsPickerBlockId] = useState(null);
  const [listingsPickerChecked, setListingsPickerChecked] = useState(() => new Set());

  const openListingsPicker = (blockId) => {
    setListingsPickerBlockId(blockId);
    setListingsPickerChecked(new Set());
    setListingsPickerOpen(true);
  };

  const toggleListingsPickerChecked = (id) => {
    setListingsPickerChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applyListingsPickerSelection = () => {
    const targetBlock = blocks.find((b) => b.id === listingsPickerBlockId);
    if (!targetBlock) { setListingsPickerOpen(false); return; }
    const existingSourceIds = new Set((targetBlock.props.listings || []).map((l) => l.sourceListingId).filter(Boolean));
    const newTiles = listings
      .filter((l) => listingsPickerChecked.has(l.id) && !existingSourceIds.has(l.id))
      .map((l) => ({
        id: nextId(),
        sourceListingId: l.id, // tracks which system listing this came from, so it shows pre-checked next time
        photo: l.photos?.[0] || "https://placehold.co/500x400/EEF0F3/171B21?text=No+Photo",
        photoAlt: l.address,
        address: l.address,
        url: l.url || "",
        stats: [
          ...(l.buildingSize ? [{ id: nextId(), icon: ICON_BUILDING_AREA_SRC, label: l.buildingSize }] : []),
          ...(l.landSize ? [{ id: nextId(), icon: ICON_LAND_AREA_SRC, label: l.landSize }] : []),
        ],
      }));
    updateProps(listingsPickerBlockId, { listings: [...(targetBlock.props.listings || []), ...newTiles] });
    setListingsPickerOpen(false);
  };

  const loadListings = useCallback(async () => {
    if (!adminToken) { setListingsLoading(false); return; }
    setListingsLoading(true);
    setListingsError(null);
    try {
      // Rows come back as { id, external_id, data, created_at } — data is
      // whatever JSON Zapier posted to /api/webhooks/listing. We spread it
      // flat and keep the row id as the listing's id.
      const rows = await apiFetch("/api/listings", adminToken);
      setListings(rows.map((row) => ({ id: row.id, ...row.data })));
    } catch (e) {
      setListingsError(`Couldn't load listings: ${e.message}`);
    } finally {
      setListingsLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const seedSampleListings = async () => {
    setSeedingListings(true);
    try {
      await apiFetch("/api/dev/seed-listings", adminToken, { method: "POST" });
      await loadListings();
    } catch (e) {
      setListingsError(`Couldn't seed sample listings: ${e.message}`);
    } finally {
      setSeedingListings(false);
    }
  };

  const deleteListing = async (id) => {
    try {
      await apiFetch(`/api/listings/${id}`, adminToken, { method: "DELETE" });
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      setListingsError(`Couldn't delete that listing: ${e.message}`);
    }
  };

  const importListingsCsv = async (file) => {
    if (!adminToken) { setListingsError("Enter your admin token first (top right)."); return; }
    setListingsImporting(true);
    setListingsError(null);
    setListingsImportNote(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiFetch("/api/listings/import-csv", adminToken, { method: "POST", body: form });
      await loadListings();
      const skippedNote = result.skipped.length > 0 ? `, skipped ${result.skipped.length} row(s) missing an address` : "";
      setListingsImportNote(`Added ${result.imported} new, updated ${result.updated} existing${skippedNote}.`);
    } catch (e) {
      setListingsError(`Import failed: ${e.message}`);
    } finally {
      setListingsImporting(false);
    }
  };

  const [dedupingListings, setDedupingListings] = useState(false);
  const dedupeListings = async () => {
    if (!adminToken) { setListingsError("Enter your admin token first (top right)."); return; }
    setDedupingListings(true);
    setListingsError(null);
    setListingsImportNote(null);
    try {
      const result = await apiFetch("/api/listings/dedupe", adminToken, { method: "POST" });
      await loadListings();
      setListingsImportNote(
        result.removed > 0
          ? `Removed ${result.removed} duplicate listing(s) — ${result.remaining} remain.`
          : "No duplicates found."
      );
    } catch (e) {
      setListingsError(`Cleanup failed: ${e.message}`);
    } finally {
      setDedupingListings(false);
    }
  };

  // Registers external listing/agent photo URLs into the shared image library
  // (server dedupes against what's already there by URL) so they show up as
  // normal library picks everywhere, not just on the block they were applied to.
  // Always returns an array the SAME LENGTH as the input, in the SAME order —
  // with null at any position that had no URL to begin with — so callers that
  // need to match results back to a specific agent/photo by index (not just
  // filter for "any registered photo") get the right one at the right position.
  const registerExternalPhotosToLibrary = async (urls, label) => {
    const urlList = Array.isArray(urls) ? urls : [];
    const cleanUrls = urlList.filter(Boolean);
    if (cleanUrls.length === 0) return urlList.map(() => null);
    const form = new FormData();
    form.append("urls", JSON.stringify(cleanUrls.map((url) => ({ url, name: label }))));
    let byUrl;
    try {
      const saved = await apiFetch("/api/images", adminToken, { method: "POST", body: form });
      setImageLibrary((prev) => {
        const existingUrls = new Set(prev.map((img) => img.url));
        const fresh = saved.filter((img) => !existingUrls.has(img.url));
        return [...fresh, ...prev];
      });
      // Server skips URLs it already had; map each requested url back to
      // either the freshly-saved row or one already in the library.
      byUrl = new Map([...saved, ...imageLibrary].map((img) => [img.url, img]));
    } catch {
      // Non-fatal — still usable for this session via the raw URL even if registration failed
      byUrl = new Map();
    }
    return urlList.map((url) => (url ? byUrl.get(url) || { url, name: label } : null));
  };

  const applyListing = async (listing) => {
    try {
      // Header: image-mode headers swap to the matching branded banner;
      // text-mode headers get "For Sale"/"For Lease" + the address as before.
      const headerBlock = blocks.find((b) => b.type === "header");
      if (headerBlock) {
        const variant = listing.saleOrRental === "Rental" ? "lease" : "sale";
        if (headerBlock.props.mode === "image") {
          updateProps(headerBlock.id, { activeVariant: variant });
        } else {
          updateProps(headerBlock.id, { title: `For ${variant === "lease" ? "Lease" : "Sale"}`, subtitle: listing.address });
        }
      }

      // Photos: register into the shared library, then apply to the first Image block
      const registeredPhotosRaw = await registerExternalPhotosToLibrary(listing.photos, listing.address);
      const registeredPhotos = registeredPhotosRaw.filter(Boolean); // Image block just wants a compact list, not positional alignment
      const imageBlock = blocks.find((b) => b.type === "image");
      if (imageBlock && registeredPhotos.length > 0) {
        if (registeredPhotos.length >= 3) {
          updateProps(imageBlock.id, {
            layout: "hero2",
            photos: [
              { id: nextId(), src: registeredPhotos[0].url, alt: listing.address },
              { id: nextId(), src: registeredPhotos[1].url, alt: listing.address },
              { id: nextId(), src: registeredPhotos[2].url, alt: listing.address },
            ],
          });
        } else {
          updateProps(imageBlock.id, {
            layout: "single",
            photos: [{ id: nextId(), src: registeredPhotos[0].url, alt: listing.address }],
          });
        }
      }

      // Agents: pulled straight from the listing's agent data
      const agentsBlock = blocks.find((b) => b.type === "agents");
      if (agentsBlock && listing.agents?.length) {
        const registeredAgentPhotos = await registerExternalPhotosToLibrary(
          listing.agents.map((a) => a.photoSrc),
          `${listing.address} — agent`
        );
        const newAgents = listing.agents.map((a, i) => ({
          id: nextId(),
          photoSrc: registeredAgentPhotos[i]?.url || a.photoSrc,
          photoPosY: 50,
          name: a.name,
          role: a.role,
          phone: a.phone,
          email: a.email,
        }));
        updateProps(agentsBlock.id, { agents: newAgents, columns: Math.min(Math.max(newAgents.length, 1), 3) });
      }

      // Button: points to the listing's real prorealty.com.au page, when known
      const buttonBlock = blocks.find((b) => b.type === "button");
      if (buttonBlock && listing.url) {
        updateProps(buttonBlock.id, { url: listing.url });
      }

      setEmailSubject(`For ${listing.saleOrRental === "Rental" ? "Lease" : "Sale"} — ${listing.address}`);
      setListingModalOpen(false);
      setPopulatedNote(`Populated from ${listing.address}`);
      setTimeout(() => setPopulatedNote(null), 4000);
    } catch (e) {
      setListingsError(`Couldn't populate from that listing: ${e.message}`);
    }
  };

  // --- Saved templates (real persistence via the backend) ---
  const [emailSubject, setEmailSubject] = useState("");
  const [currentTemplateId, setCurrentTemplateId] = useState(null);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templatesError, setTemplatesError] = useState(null);

  const loadSavedTemplates = useCallback(async () => {
    if (!adminToken) return;
    setTemplatesLoading(true);
    try {
      const rows = await apiFetch("/api/templates", adminToken);
      setSavedTemplates(rows);
    } catch (e) {
      setTemplatesError(`Couldn't load templates: ${e.message}`);
    } finally {
      setTemplatesLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    if (templatesModalOpen) loadSavedTemplates();
  }, [templatesModalOpen, loadSavedTemplates]);

  const saveTemplate = async (mode) => {
    if (!emailSubject.trim()) {
      setTemplatesError("Add a subject line before saving — it's what recipients see in their inbox.");
      return;
    }
    setTemplateSaving(true);
    setTemplatesError(null);
    try {
      const payload = { name: templateName, subject: emailSubject, html: buildFullHtml(blocks, templateName), blocks };
      if (mode === "update" && currentTemplateId) {
        await apiFetch(`/api/templates/${currentTemplateId}`, adminToken, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const result = await apiFetch("/api/templates", adminToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setCurrentTemplateId(result.template_id);
      }
      await loadSavedTemplates();
    } catch (e) {
      setTemplatesError(`Couldn't save: ${e.message}`);
    } finally {
      setTemplateSaving(false);
    }
  };

  const loadTemplate = async (id) => {
    setTemplatesError(null);
    try {
      const row = await apiFetch(`/api/templates/${id}`, adminToken);
      if (!row.blocks || !Array.isArray(row.blocks)) {
        setTemplatesError("This template has no visual design saved (it wasn't created in the builder), so it can't be loaded here.");
        return;
      }
      setBlocks(row.blocks);
      setSelectedId(row.blocks[0]?.id || null);
      setTemplateName(row.name);
      setEmailSubject(row.subject);
      setCurrentTemplateId(row.id);
      setTemplatesModalOpen(false);
    } catch (e) {
      setTemplatesError(`Couldn't load template: ${e.message}`);
    }
  };

  const deleteTemplate = async (id) => {
    try {
      await apiFetch(`/api/templates/${id}`, adminToken, { method: "DELETE" });
      setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
      if (currentTemplateId === id) setCurrentTemplateId(null);
    } catch (e) {
      setTemplatesError(`Couldn't delete: ${e.message}`);
    }
  };

  const selected = blocks.find((b) => b.id === selectedId) || null;

  const updateProps = useCallback((id, patch) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...patch } } : b)));
  }, []);

  const [activeThemeId, setActiveThemeId] = useState(null);
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  const applyTheme = (theme) => {
    setBlocks((prev) => prev.map((b) => {
      const p = b.props;
      switch (b.type) {
        case "navbar":
          return { ...b, props: { ...p, bg: theme.surface, linkColor: theme.ink, fontFamily: theme.bodyFont } };
        case "header":
          return {
            ...b,
            props: {
              ...p,
              bg: theme.ink,
              titleColor: theme.surface,
              titleFontFamily: theme.headingFont,
              titleFontSize: theme.headingSize,
              subtitleColor: theme.surface,
              subtitleFontFamily: theme.bodyFont,
            },
          };
        case "text":
          return { ...b, props: { ...p, color: theme.ink, fontFamily: theme.bodyFont, bg: theme.surface } };
        case "image":
          return { ...b, props: { ...p, bg: theme.surface } };
        case "button":
          return { ...b, props: { ...p, bg: theme.accent, color: theme.onAccent, fontFamily: theme.bodyFont, sectionBg: theme.surface } };
        case "agents":
          return {
            ...b,
            props: {
              ...p,
              bg: theme.surface,
              textColor: theme.ink,
              fontFamily: theme.bodyFont,
              headingColor: theme.ink,
              headingFontFamily: theme.headingFont,
            },
          };
        case "divider":
          return { ...b, props: { ...p, color: theme.dividerColor, thickness: theme.dividerThickness, bg: theme.surface } };
        case "spacer":
          return { ...b, props: { ...p, bg: theme.surface } };
        case "footer":
          return { ...b, props: { ...p, bg: theme.surface, contactColor: theme.ink, disclaimerColor: theme.muted, fontFamily: theme.bodyFont } };
        default:
          return b;
      }
    }));
    setActiveThemeId(theme.id);
    setThemeModalOpen(false);
  };

  const addBlock = (type, atIndex = blocks.length) => {
    const b = makeBlock(type);
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(atIndex, 0, b);
      return next;
    });
    setSelectedId(b.id);
  };

  const removeBlock = (id) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateBlock = (id) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const copy = { ...prev[idx], id: nextId(), props: { ...prev[idx].props } };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const handleRowDragOver = (e, index) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const before = e.clientY - rect.top < rect.height / 2;
    setDropIndex(before ? index : index + 1);
  };

  const finalizeDrop = () => {
    if (dropIndex === null || !dragState) return;
    if (dragState.source === "palette") {
      addBlock(dragState.type, dropIndex);
    } else if (dragState.source === "canvas") {
      setBlocks((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragState.index, 1);
        let insertAt = dropIndex;
        if (dragState.index < dropIndex) insertAt -= 1;
        next.splice(insertAt, 0, moved);
        return next;
      });
    }
    setDragState(null);
    setDropIndex(null);
  };

  const exportHtml = buildFullHtml(blocks, templateName);

  const downloadFile = (filename, content, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportJson = () => JSON.stringify({ templateName, blocks }, null, 2);

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed.blocks)) {
          setBlocks(parsed.blocks);
          setTemplateName(parsed.templateName || "Imported template");
          setSelectedId(parsed.blocks[0]?.id || null);
        }
      } catch {
        // eslint-disable-next-line no-alert
        alert("That file doesn't look like a valid template export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div style={{ fontFamily: uiSans, background: workspaceBg, minHeight: "100vh", color: ink }}>
      {/* Top bar */}
      <div style={{ height: 56, background: panelBg, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: accent }}>
          <LayoutTemplate size={18} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>Newsletter Builder</span>
        </div>
        <div style={{ width: 1, height: 24, background: border }} />
        <input value={templateName} onChange={(e) => setTemplateName(e.target.value)}
          style={{ border: "none", outline: "none", fontSize: 14, fontWeight: 600, color: ink, background: "transparent", flex: 1, maxWidth: 320 }} />
        {populatedNote && (
          <span style={{ fontSize: 12, color: "#2F7A4F", background: "#EAF6EE", padding: "5px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{populatedNote}</span>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={() => setThemeModalOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 6, border: "none", background: ink, color: "#fff", cursor: "pointer" }}>
          <Palette size={14} /> Theme
        </button>
        <button onClick={() => setListingModalOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 6, border: `1px solid ${accent}`, background: accentSoft, color: "#7A5A20", cursor: "pointer" }}>
          <Wand2 size={14} /> Populate from listing
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImport} style={{ display: "none" }} />
        <button onClick={() => openLibrary(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color: inkSoft, cursor: "pointer" }}>
          <Images size={14} /> Image library {imageLibrary.length > 0 && `(${imageLibrary.length})`}
        </button>
        <button onClick={() => setTemplatesModalOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color: inkSoft, cursor: "pointer" }}>
          <FolderOpen size={14} /> Templates
        </button>
        <button onClick={() => fileInputRef.current?.click()}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color: inkSoft, cursor: "pointer" }}>
          <Upload size={14} /> Import
        </button>
        <button onClick={() => downloadFile(`${templateName.replace(/\s+/g, "-").toLowerCase()}.json`, exportJson(), "application/json")}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color: inkSoft, cursor: "pointer" }}>
          <Download size={14} /> Export JSON
        </button>
        <button onClick={() => setShowExport(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 6, border: "none", background: ink, color: "#fff", cursor: "pointer" }}>
          <Code2 size={14} /> Export HTML
        </button>
        <div style={{ width: 1, height: 24, background: border }} />
        <input value={adminToken} onChange={(e) => saveAdminToken(e.target.value)} placeholder="Admin token" type="password"
          style={{ ...inputStyle, width: 150, padding: "6px 8px" }} />
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>
        {/* Left palette */}
        <div style={{ width: 200, background: panelBg, borderRight: `1px solid ${border}`, padding: 16, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: inkSoft, marginBottom: 10 }}>Blocks — drag onto the newsletter</div>
          {BLOCK_TYPES.map((bt) => {
            const Icon = bt.icon;
            return (
              <div key={bt.type}
                draggable
                onDragStart={() => setDragState({ source: "palette", type: bt.type })}
                onDragEnd={() => { setDragState(null); setDropIndex(null); }}
                onClick={() => addBlock(bt.type)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 7,
                  border: `1px solid ${border}`, marginBottom: 8, cursor: "grab", background: "#fff", fontSize: 13,
                }}>
                <Icon size={15} color={accent} />
                {bt.label}
                <Plus size={13} color="#B7BEC7" style={{ marginLeft: "auto" }} />
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: "#9AA2AC", marginTop: 12, lineHeight: 1.5 }}>
            Drag a block into the newsletter, or click to add it to the end.
          </div>
        </div>

        {/* Center canvas */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px", display: "flex", justifyContent: "center" }}>
          <div
            onDragOver={(e) => { e.preventDefault(); if (blocks.length === 0) setDropIndex(0); }}
            onDrop={(e) => { e.preventDefault(); finalizeDrop(); }}
            style={{ width: 600, maxWidth: "100%" }}>
            <div style={{ background: BRAND_NAVY, boxShadow: "0 1px 3px rgba(23,27,33,0.08), 0 8px 24px rgba(23,27,33,0.06)", borderRadius: 8, overflow: "hidden" }}>
              {blocks.length === 0 && (
                <div style={{ padding: 60, textAlign: "center", color: "#9AA2AC", fontSize: 13 }}>
                  Drag a block here to start building.
                </div>
              )}
              {blocks.map((block, index) => (
                <React.Fragment key={block.id}>
                  {dropIndex === index && dragState && (
                    <div style={{ height: 3, background: accent, margin: "0 12px" }} />
                  )}
                  <div
                    draggable
                    onDragStart={() => setDragState({ source: "canvas", index })}
                    onDragEnd={() => { setDragState(null); setDropIndex(null); }}
                    onDragOver={(e) => handleRowDragOver(e, index)}
                    onDrop={(e) => { e.preventDefault(); finalizeDrop(); }}
                    onClick={() => setSelectedId(block.id)}
                    style={{
                      position: "relative",
                      outline: selectedId === block.id ? `2px solid ${accent}` : "2px solid transparent",
                      outlineOffset: -2,
                      cursor: "pointer",
                      userSelect: "none",
                      WebkitUserSelect: "none",
                    }}>
                    <div style={{ pointerEvents: "none" }}>
                      <BlockPreview block={block} />
                    </div>
                    {selectedId === block.id && (
                      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4, background: "#fff", border: `1px solid ${border}`, borderRadius: 6, padding: 3 }}>
                        <span style={{ padding: 4, cursor: "grab", color: inkSoft }}><GripVertical size={14} /></span>
                        <button onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }}
                          style={{ border: "none", background: "none", cursor: "pointer", padding: 4, color: inkSoft }}>
                          <Copy size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                          style={{ border: "none", background: "none", cursor: "pointer", padding: 4, color: "#C0503D" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              ))}
              {dropIndex === blocks.length && dragState && (
                <div style={{ height: 3, background: accent, margin: "0 12px" }} />
              )}
            </div>
          </div>
        </div>

        {/* Right property panel */}
        <div style={{ width: 280, background: panelBg, borderLeft: `1px solid ${border}`, padding: 20, overflowY: "auto" }}>
          {selected ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 14 }}>
                {selected.type} block
              </div>
              <PropertyPanel block={selected} updateProps={updateProps} openLibrary={openLibrary} openListingsPicker={openListingsPicker} />
            </>
          ) : (
            <div style={{ fontSize: 13, color: "#9AA2AC", marginTop: 8 }}>Select a block to edit its properties.</div>
          )}
        </div>
      </div>

      {/* Export modal */}
      {showExport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(23,27,33,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setShowExport(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, width: 720, maxWidth: "92vw", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Export HTML</div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowExport(false)} style={{ border: "none", background: "none", cursor: "pointer", color: inkSoft }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 18, overflowY: "auto" }}>
              <div style={{ fontSize: 12, color: inkSoft, marginBottom: 10, lineHeight: 1.5 }}>
                This includes <code>{"{{first_name}}"}</code>-style variable tokens and an unsubscribe link placeholder — plug it straight into your sending system's template step.
              </div>
              <textarea readOnly value={exportHtml}
                style={{ width: "100%", height: 320, fontFamily: "ui-monospace, monospace", fontSize: 11.5, padding: 12, border: `1px solid ${border}`, borderRadius: 6, resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10, padding: 16, borderTop: `1px solid ${border}` }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportHtml);
                  setCopyLabel("Copied!");
                  setTimeout(() => setCopyLabel("Copy code"), 1500);
                }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: `1px solid ${border}`, background: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                {copyLabel}
              </button>
              <button
                onClick={() => downloadFile(`${templateName.replace(/\s+/g, "-").toLowerCase()}.html`, exportHtml, "text/html")}
                style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: "none", background: ink, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                Download .html
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates modal (save/load against the real backend) */}
      {templatesModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(23,27,33,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setTemplatesModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, width: 620, maxWidth: "92vw", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Templates</div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setTemplatesModalOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: inkSoft }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${border}` }}>
              {!adminToken && (
                <div style={{ fontSize: 12, color: "#8A5A20", background: accentSoft, borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
                  Enter your admin token (top right) to save or load templates.
                </div>
              )}
              {templatesError && (
                <div style={{ fontSize: 12, color: "#C0503D", marginBottom: 10 }}>{templatesError}</div>
              )}
              <Field label="Subject line (what recipients see in their inbox)">
                <TextInput value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="e.g. For Sale — 24 Seaview Terrace" />
              </Field>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => saveTemplate("new")} disabled={templateSaving || !adminToken}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color: inkSoft, fontWeight: 600, fontSize: 12, cursor: adminToken ? "pointer" : "default", opacity: templateSaving ? 0.6 : 1 }}>
                  <Save size={14} /> Save as new
                </button>
                {currentTemplateId && (
                  <button onClick={() => saveTemplate("update")} disabled={templateSaving || !adminToken}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 6, border: "none", background: ink, color: "#fff", fontWeight: 600, fontSize: 12, cursor: adminToken ? "pointer" : "default", opacity: templateSaving ? 0.6 : 1 }}>
                    <Save size={14} /> {templateSaving ? "Saving…" : `Update "${templateName}"`}
                  </button>
                )}
              </div>
            </div>

            <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: inkSoft, marginBottom: 10 }}>Saved templates</div>
              {templatesLoading ? (
                <div style={{ fontSize: 13, color: "#9AA2AC", textAlign: "center", padding: "20px 0" }}>Loading…</div>
              ) : savedTemplates.length === 0 ? (
                <div style={{ fontSize: 13, color: "#9AA2AC", textAlign: "center", padding: "20px 0" }}>Nothing saved yet.</div>
              ) : (
                savedTemplates.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}{t.id === currentTemplateId && <span style={{ color: accent }}> · current</span>}</div>
                      <div style={{ fontSize: 11, color: "#9AA2AC", marginTop: 2 }}>{t.subject}</div>
                    </div>
                    <button onClick={() => loadTemplate(t.id)}
                      style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color: inkSoft, cursor: "pointer" }}>
                      Load
                    </button>
                    <button onClick={() => deleteTemplate(t.id)} title="Delete"
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#C0503D", padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Theme picker modal */}
      {themeModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(23,27,33,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setThemeModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, width: 680, maxWidth: "92vw", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Choose a theme</div>
                <div style={{ fontSize: 11, color: inkSoft, marginTop: 2 }}>Restyles colors and fonts across every block on the canvas</div>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setThemeModalOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: inkSoft }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 18, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
              {THEMES.map((theme) => (
                <div key={theme.id}
                  style={{
                    border: activeThemeId === theme.id ? `2px solid ${theme.accent}` : `1px solid ${border}`,
                    borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column",
                  }}>
                  <div style={{ display: "flex", height: 64 }}>
                    {theme.swatches.map((c, i) => (
                      <div key={i} style={{ flex: 1, background: c }} />
                    ))}
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontFamily: theme.headingFont, fontSize: 15, fontWeight: 700, color: theme.ink, marginBottom: 4 }}>
                      {theme.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: inkSoft, lineHeight: 1.4, marginBottom: 12 }}>
                      {theme.description}
                    </div>
                    <button onClick={() => applyTheme(theme)}
                      style={{
                        width: "100%", padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer",
                        background: theme.accent, color: theme.onAccent, fontWeight: 700, fontSize: 12,
                      }}>
                      {activeThemeId === theme.id ? "Re-apply" : "Apply theme"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Listings Grid checkbox picker modal */}
      {listingsPickerOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(23,27,33,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setListingsPickerOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, width: 620, maxWidth: "92vw", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Select listings to add</div>
                <div style={{ fontSize: 11, color: inkSoft, marginTop: 2 }}>Tick as many as you like, then add them all at once</div>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setListingsPickerOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: inkSoft }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
              {!adminToken ? (
                <div style={{ fontSize: 13, color: "#9AA2AC", textAlign: "center", padding: "30px 0" }}>
                  Enter your admin token (top right) to load listings.
                </div>
              ) : listingsLoading ? (
                <div style={{ fontSize: 13, color: "#9AA2AC", textAlign: "center", padding: "30px 0" }}>Loading listings…</div>
              ) : listings.length === 0 ? (
                <div style={{ fontSize: 13, color: "#9AA2AC", textAlign: "center", padding: "30px 0" }}>
                  No listings in the system yet — pull some in via Zapier, or use "Populate from listing" to seed sample ones.
                </div>
              ) : (
                listings.map((listing) => {
                  const checked = listingsPickerChecked.has(listing.id);
                  return (
                    <label key={listing.id}
                      style={{ display: "flex", gap: 12, alignItems: "center", border: `1px solid ${checked ? accent : border}`, background: checked ? accentSoft : "#fff", borderRadius: 8, padding: 10, marginBottom: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleListingsPickerChecked(listing.id)} style={{ flexShrink: 0, width: 16, height: 16 }} />
                      <img src={listing.photos?.[0]} alt={listing.address} onError={handleImgError}
                        style={{ width: 56, height: 44, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{listing.address}</div>
                        <div style={{ fontSize: 11, color: "#9AA2AC", marginTop: 2 }}>
                          {listing.propertyType} · For {listing.saleOrRental === "Rental" ? "Lease" : "Sale"} · {listing.price}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div style={{ display: "flex", gap: 10, padding: 16, borderTop: `1px solid ${border}` }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", fontSize: 12, color: inkSoft }}>
                {listingsPickerChecked.size} selected
              </div>
              <button onClick={() => setListingsPickerOpen(false)}
                style={{ padding: "9px 16px", borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color: inkSoft, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={applyListingsPickerSelection} disabled={listingsPickerChecked.size === 0}
                style={{ padding: "9px 16px", borderRadius: 6, border: "none", background: ink, color: "#fff", fontWeight: 600, fontSize: 13, cursor: listingsPickerChecked.size === 0 ? "default" : "pointer", opacity: listingsPickerChecked.size === 0 ? 0.5 : 1 }}>
                Add {listingsPickerChecked.size || ""} listing{listingsPickerChecked.size === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Populate from listing modal */}
      {listingModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(23,27,33,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setListingModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, width: 640, maxWidth: "92vw", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Populate from listing</div>
                <div style={{ fontSize: 11, color: inkSoft, marginTop: 2 }}>Listings pulled in via Zapier, or bulk-imported from a Rex CSV export</div>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setListingModalOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: inkSoft }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
              <input ref={listingsCsvInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
                onChange={(e) => { if (e.target.files?.[0]) importListingsCsv(e.target.files[0]); e.target.value = ""; }} />
              <button onClick={() => listingsCsvInputRef.current?.click()} disabled={listingsImporting || !adminToken}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0",
                  borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color: inkSoft, fontSize: 12, fontWeight: 600,
                  cursor: adminToken ? "pointer" : "default", opacity: listingsImporting ? 0.6 : 1,
                }}>
                <UploadCloud size={14} /> {listingsImporting ? "Importing…" : "Import listings from Rex CSV export"}
              </button>
              <div style={{ fontSize: 10.5, color: "#9AA2AC", marginTop: 6, marginBottom: 8, lineHeight: 1.5 }}>
                One-time backfill for listings that existed before Zapier was connected — Zapier only catches new
                listings going forward. Just export your listings from Rex and upload the file as-is — address,
                price, property type, sale/rental, size, photos, and up to two agents are all read automatically
                from Rex's own export format. Re-uploading the same export later updates existing listings in
                place rather than duplicating them.
              </div>
              <button onClick={dedupeListings} disabled={dedupingListings || !adminToken}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 0",
                  borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color: inkSoft, fontSize: 12, fontWeight: 600,
                  cursor: adminToken ? "pointer" : "default", opacity: dedupingListings ? 0.6 : 1,
                }}>
                <Trash2 size={13} /> {dedupingListings ? "Checking…" : "Clean up duplicate listings"}
              </button>
              <div style={{ fontSize: 10.5, color: "#9AA2AC", marginTop: 6, lineHeight: 1.5 }}>
                One-time cleanup for listings that got duplicated before re-uploads started updating in place —
                safe to click any time, does nothing if there's nothing to merge.
              </div>
              {listingsImportNote && (
                <div style={{ fontSize: 12, color: "#2F7A4F", background: "#EAF6EE", borderRadius: 6, padding: "6px 10px", marginTop: 8 }}>{listingsImportNote}</div>
              )}
            </div>

            <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
              {listingsError && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#8A5A20", background: accentSoft, borderRadius: 6, padding: "8px 10px", marginBottom: 12 }}>
                  <span style={{ flex: 1 }}>{listingsError}</span>
                  <button onClick={loadListings} style={{ border: "none", background: "none", textDecoration: "underline", cursor: "pointer", color: "#8A5A20", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}>
                    Retry
                  </button>
                </div>
              )}
              {!adminToken ? (
                <div style={{ fontSize: 13, color: "#9AA2AC", textAlign: "center", padding: "30px 0" }}>
                  Enter your admin token (top right) to load listings.
                </div>
              ) : listingsLoading ? (
                <div style={{ fontSize: 13, color: "#9AA2AC", textAlign: "center", padding: "30px 0" }}>Loading listings…</div>
              ) : listings.length === 0 ? (
                <div style={{ fontSize: 13, color: "#9AA2AC", textAlign: "center", padding: "30px 0" }}>
                  No listings yet — nothing's come in from Zapier so far.
                  <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "center" }}>
                    <button onClick={loadListings} style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color: inkSoft, cursor: "pointer" }}>
                      Retry
                    </button>
                    <button onClick={seedSampleListings} disabled={seedingListings}
                      style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 6, border: "none", background: ink, color: "#fff", cursor: seedingListings ? "default" : "pointer", opacity: seedingListings ? 0.6 : 1 }}>
                      {seedingListings ? "Adding…" : "Add 3 sample listings"}
                    </button>
                  </div>
                </div>
              ) : (
                listings.map((listing) => (
                  <div key={listing.id}
                    style={{ display: "flex", gap: 14, alignItems: "center", border: `1px solid ${border}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <img src={listing.photos?.[0]} alt={listing.address} onError={handleImgError}
                      style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: listing.saleOrRental === "Rental" ? "#EAF3F6" : accentSoft,
                          color: listing.saleOrRental === "Rental" ? "#2C6B7F" : "#7A5A20",
                        }}>
                          {listing.propertyType} · For {listing.saleOrRental === "Rental" ? "Lease" : "Sale"}
                        </span>
                        <span style={{ fontSize: 12, color: inkSoft }}>{listing.price}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{listing.address}</div>
                      <div style={{ fontSize: 11, color: "#9AA2AC", marginTop: 2 }}>
                        {listing.photos?.length || 0} photos · {listing.agents?.map((a) => a.name).join(", ") || "no agent"}
                      </div>
                    </div>
                    <button onClick={() => applyListing(listing)}
                      style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 6, border: "none", background: ink, color: "#fff", cursor: "pointer" }}>
                      Use this listing
                    </button>
                    <button onClick={() => deleteListing(listing.id)} title="Delete this listing"
                      style={{ flexShrink: 0, border: "none", background: "none", cursor: "pointer", color: "#C0503D", padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image library modal */}
      {libraryModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(23,27,33,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setLibraryModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, width: 640, maxWidth: "92vw", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Image library</div>
              <div style={{ fontSize: 11, color: inkSoft, marginLeft: 8 }}>Shared with everyone using this builder</div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setLibraryModalOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: inkSoft }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 18px 0" }}>
              <input ref={libraryFileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={(e) => { if (e.target.files?.length) handleLibraryUpload(e.target.files); e.target.value = ""; }} />
              <button onClick={() => libraryFileInputRef.current?.click()} disabled={libraryUploading}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0",
                  borderRadius: 8, border: `1.5px dashed ${border}`, background: accentSoft, color: "#7A5A20", fontSize: 13, fontWeight: 600,
                  cursor: libraryUploading ? "default" : "pointer", opacity: libraryUploading ? 0.6 : 1,
                }}>
                <UploadCloud size={16} />
                {libraryUploading ? "Uploading…" : "Upload photos"}
              </button>
              <button onClick={seedBrandAssets} disabled={assetsSeeding || !adminToken}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", marginTop: 8,
                  borderRadius: 6, border: `1px solid ${border}`, background: "#fff", color: inkSoft, fontSize: 12, fontWeight: 600,
                  cursor: adminToken ? "pointer" : "default", opacity: assetsSeeding ? 0.6 : 1,
                }}>
                {assetsSeeding ? "Loading…" : "Load brand assets (header banners + stat icons)"}
              </button>
              {libraryError && <div style={{ fontSize: 12, color: "#C0503D", marginTop: 8 }}>{libraryError}</div>}
            </div>

            <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
              {libraryLoading ? (
                <div style={{ fontSize: 13, color: "#9AA2AC", textAlign: "center", padding: "30px 0" }}>Loading library…</div>
              ) : imageLibrary.length === 0 ? (
                <div style={{ fontSize: 13, color: "#9AA2AC", textAlign: "center", padding: "30px 0" }}>No images uploaded yet — upload some above to get started.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
                  {imageLibrary.map((img) => (
                    <div key={img.id}
                      style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1px solid ${border}`, cursor: libraryOnSelect ? "pointer" : "default", aspectRatio: "1 / 1" }}
                      onClick={() => libraryOnSelect && handleLibraryPick(img)}>
                      <img src={img.url} alt={img.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleLibraryDelete(img.id); }}
                        title="Delete from library"
                        style={{
                          position: "absolute", top: 4, right: 4, background: "rgba(23,27,33,0.7)", border: "none", borderRadius: 5,
                          padding: 4, cursor: "pointer", color: "#fff", display: "flex",
                        }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
