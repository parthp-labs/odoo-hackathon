// ---------------------------------------------------------------------------
// StockSense demo catalog — a PURE, deterministic generator for the master data
// that seed.js writes to Mongo. No DB, no network: every field is drawn from
// mulberry32 seeded with CATALOG_SEED, so two calls with the same seed produce
// deep-equal output and reruns are byte-identical.
//
// Why a separate module: seed.js used to be one 437-line imperative function.
// That made it impossible to unit-test the interesting part (the data itself)
// without a live database. Everything here is pure; seed.js just persists it.
//
// Determinism contract: if you change the ORDER of any array in this file, the
// PRNG draw order changes and every subsequent vendor/product identity shifts.
// That is safe for the catalog (nothing trains on it) but the 7 ORIGINAL seeded
// SKUs are load-bearing elsewhere — see generateHistory.js, which pins their
// series independently of catalog order.
// ---------------------------------------------------------------------------
import { mulberry32, hashStringToSeed } from './generateHistory.js';

export const CATALOG_SEED = 20260928; // fixed seed constant — do not change
export const DATASET_VERSION = 'demo-v3';

// Master-data demo accounts. Passwords are the documented demo credentials and
// are intentionally identical across roles.
export const DEMO_PASSWORD = 'Password123!';

// Seeders that must run, in order, to produce a complete demo dataset:
//
//   1. node src/scripts/seed.js            master data + 90-day operations
//   2. node src/scripts/seedVendors.js     120 vendors + price quotes
//   3. node src/scripts/generateHistory.js 60-week demand series (SYN/ moves)
//   4. POST /api/replenishment/run         persist the forecast snapshot
//
// Step 2 MUST follow step 1. seed.js deletes and recreates every seeded
// Product, minting new ObjectIds, so any VendorPrice written before a reseed
// keeps pointing at the old ids and silently stops resolving — the products
// still look "priced" in the collection but have no vendors attached.
export const SEED_PIPELINE = ['seed.js', 'seedVendors.js', 'generateHistory.js'];

export const DEMO_USERS = [
  { name: 'System Admin', email: 'admin@stocksense.com', role: 'admin' },
  { name: 'Sarah Connor (Inventory Manager)', email: 'manager@stocksense.com', role: 'inventory_manager' },
  { name: 'John Doe (Warehouse Staff)', email: 'staff@stocksense.com', role: 'warehouse_staff' },
  { name: 'Anita Desai (Procurement Lead)', email: 'procurement@stocksense.com', role: 'inventory_manager' },
  { name: 'Rohit Sharma (Shift Supervisor)', email: 'supervisor@stocksense.com', role: 'warehouse_staff' },
];

// 8 categories. `parentKey` nests under another category in the same list.
export const CATEGORIES = [
  { key: 'raw', name: 'Raw Materials', description: 'Unprocessed manufacturing materials' },
  { key: 'metals', name: 'Metals & Alloys', parentKey: 'raw', description: 'Structural and sheet metals' },
  { key: 'hardware', name: 'Hardware', description: 'Fasteners, consumables, and PPE' },
  { key: 'finished', name: 'Finished Goods', description: 'Ready-to-ship products' },
  { key: 'furniture', name: 'Furniture', parentKey: 'finished', description: 'Office and warehouse furniture' },
  { key: 'packaging', name: 'Packaging', description: 'Cartons, stretch wrap, pallets, labels' },
  { key: 'electrical', name: 'Electrical', description: 'Wiring, switchgear, and lighting' },
  { key: 'safety', name: 'Safety & PPE', description: 'Protective equipment and site safety' },
];

// 4 warehouses.
export const WAREHOUSES = [
  { key: 'wh1', code: 'WH1', name: 'Main Logistics Hub', address: 'Sector 4, Central Logistics Park, New Delhi' },
  { key: 'wh2', code: 'WH2', name: 'Secondary Coastal Warehouse', address: 'Dock 8, Harbor Terminal, Mumbai' },
  { key: 'wh3', code: 'WH3', name: 'South India Distribution Centre', address: 'Plot 27, SIPC Industrial Area, Chennai' },
  { key: 'wh4', code: 'WH4', name: 'West Region Transit Hub', address: 'Survey 88, MIDC Industrial Area, Pune' },
];

// 12 internal locations. `capacity` is the location's max_capacity.
export const LOCATIONS = [
  { key: 'wh1_stock', code: 'WH1/STOCK', warehouse: 'wh1', name: 'Bulk Pallet Floor', zone: 'Zone A (Bulk Storage)', aisle: 'Aisle 01', rack: 'Bay 01 (Floor)', shelf: 'Level 1 (Ground)', position_index: 1, capacity: 1000 },
  { key: 'wh1_rackA', code: 'WH1/RACK-A', warehouse: 'wh1', name: 'Rack A (Metals & Heavy Rods)', zone: 'Zone B (Metals & Raw Materials)', aisle: 'Aisle 02', rack: 'Rack 01', shelf: 'Shelf 2 (Mid)', position_index: 2, capacity: 500 },
  { key: 'wh1_rackB', code: 'WH1/RACK-B', warehouse: 'wh1', name: 'Rack B (Small Parts & Fasteners)', zone: 'Zone C (Hardware & Fasteners)', aisle: 'Aisle 03', rack: 'Rack 02', shelf: 'Shelf 1 (Bottom Bin)', position_index: 1, capacity: 400 },
  { key: 'wh1_prod', code: 'WH1/PRODUCTION', warehouse: 'wh1', name: 'Production Assembly Area', zone: 'Zone D (Assembly Floor)', aisle: 'Aisle 04', rack: 'Station 01', shelf: 'Worktable', position_index: 1, capacity: 200 },
  { key: 'wh2_stock', code: 'WH2/STOCK', warehouse: 'wh2', name: 'Coastal Main Storage', zone: 'Zone A (General Storage)', aisle: 'Aisle 01', rack: 'Rack 01', shelf: 'Shelf 1', position_index: 1, capacity: 1000 },
  { key: 'wh2_rackC', code: 'WH2/RACK-C', warehouse: 'wh2', name: 'Rack C (Packaging Supplies)', zone: 'Zone B (Packaging)', aisle: 'Aisle 02', rack: 'Rack 03', shelf: 'Shelf 1', position_index: 1, capacity: 350 },
  { key: 'wh3_stock', code: 'WH3/STOCK', warehouse: 'wh3', name: 'South Main Storage', zone: 'Zone A (General Storage)', aisle: 'Aisle 01', rack: 'Rack 01', shelf: 'Shelf 1', position_index: 1, capacity: 1000 },
  { key: 'wh3_rackD', code: 'WH3/RACK-D', warehouse: 'wh3', name: 'Rack D (Electrical & Fittings)', zone: 'Zone C (Electrical)', aisle: 'Aisle 02', rack: 'Rack 04', shelf: 'Shelf 2 (Mid)', position_index: 2, capacity: 300 },
  { key: 'wh3_rackE', code: 'WH3/RACK-E', warehouse: 'wh3', name: 'Rack E (Safety Gear)', zone: 'Zone D (PPE Store)', aisle: 'Aisle 03', rack: 'Rack 05', shelf: 'Shelf 1', position_index: 1, capacity: 280 },
  { key: 'wh4_stock', code: 'WH4/STOCK', warehouse: 'wh4', name: 'West Transit Storage', zone: 'Zone A (General Storage)', aisle: 'Aisle 01', rack: 'Rack 01', shelf: 'Shelf 1', position_index: 1, capacity: 800 },
  { key: 'wh4_rackF', code: 'WH4/RACK-F', warehouse: 'wh4', name: 'Rack F (Oversized & Frames)', zone: 'Zone B (Oversized Goods)', aisle: 'Aisle 02', rack: 'Rack 06', shelf: 'Floor Bay', position_index: 1, capacity: 260 },
  { key: 'wh4_staging', code: 'WH4/STAGING', warehouse: 'wh4', name: 'Outbound Staging Bay', zone: 'Zone C (Dispatch)', aisle: 'Aisle 03', rack: 'Bay 02', shelf: 'Ground', position_index: 1, capacity: 450 },
];

// 4 virtual/partner endpoints.
export const VIRTUAL_LOCATIONS = [
  { key: 'vendor', code: 'PARTNER/VENDORS', name: 'Vendors / Suppliers', location_type: 'vendor' },
  { key: 'customer', code: 'PARTNER/CUSTOMERS', name: 'Customers / Delivery Clients', location_type: 'customer' },
  { key: 'loss', code: 'VIRTUAL/LOSS', name: 'Inventory Scrap & Loss', location_type: 'inventory_loss' },
  { key: 'transit', code: 'VIRTUAL/TRANSIT', name: 'Inter-warehouse Transit', location_type: 'transit' },
];

// The product catalog. Each entry pins its own category, uom, and reordering
// band, so reordering_rules are meaningful rather than arbitrary. `anchor` marks
// the 7 ORIGINAL seeded SKUs — these are the ones the frozen SVR model covers,
// and generateHistory.js keys its series off them. Do not remove or reorder
// them; extra products are appended after them.
export const PRODUCTS = [
  // --- The 7 anchor SKUs (frozen-SVR covered) ---------------------------
  { key: 'steel', sku: 'STEEL-12MM-ROD', name: 'High Tensile Steel Rods 12mm', category: 'metals', uom: 'kg', description: 'Grade 60 structural reinforced steel rods', min: 50, max: 250, anchor: true },
  { key: 'alum', sku: 'ALUM-25X25-BAR', name: 'Aluminum Extrusion Bar 25x25', category: 'metals', uom: 'm', description: 'Anodized aluminum profile', min: 20, max: 100, anchor: true },
  { key: 'bolts', sku: 'BOLT-HEX-M8-P50', name: 'M8 Stainless Hex Bolts (Pack of 50)', category: 'hardware', uom: 'packs', description: 'Corrosion resistant industrial bolts', min: 20, max: 100, anchor: true },
  { key: 'chair', sku: 'CHAIR-ERGO-MESH', name: 'Ergonomic Warehouse Mesh Chair', category: 'furniture', uom: 'units', description: 'Adjustable heavy duty work chair', min: 10, max: 40, anchor: true },
  { key: 'frame', sku: 'FRAME-STEEL-WORK', name: 'Heavy Steel Workbench Frame', category: 'furniture', uom: 'units', description: 'Modular packaging table frame', min: 5, max: 25, anchor: true },
  { key: 'paste', sku: 'PASTE-THERM-10G', name: 'Industrial Thermal Heat Paste 10g', category: 'hardware', uom: 'tubes', description: 'High conductivity heat sink compound', min: 20, max: 80, anchor: true },
  { key: 'helm', sku: 'HELM-SAFE-YEL', name: 'High-Vis Industrial Hard Hat', category: 'hardware', uom: 'units', description: 'OSHA certified yellow safety helmet', min: 15, max: 50, anchor: true },

  // --- Extended catalog (baseline forecasts, not SVR-covered) -----------
  { key: 'steelplate', sku: 'STEEL-PLATE-6MM', name: 'Mild Steel Plate 6mm', category: 'metals', uom: 'kg', description: 'Hot rolled structural plate', min: 120, max: 600, weekly: 220 },
  { key: 'ssheet', sku: 'STEEL-SHEET-2MM', name: 'Cold Rolled Steel Sheet 2mm', category: 'metals', uom: 'kg', description: 'CR sheet for fabrication', min: 80, max: 400, weekly: 160 },
  { key: 'tube', sku: 'TUBE-SS-304-25MM', name: 'Stainless Steel Tube 304 25mm', category: 'metals', uom: 'm', description: 'Polished SS304 round tube', min: 40, max: 200, weekly: 90 },
  { key: 'angle', sku: 'ANGLE-MILD-40X40', name: 'Mild Steel Angle 40x40x5mm', category: 'metals', uom: 'kg', description: 'Equal leg angle for structural work', min: 60, max: 300, weekly: 130 },
  { key: 'copperwire', sku: 'WIRE-CU-2.5SQ', name: 'Copper Wire 2.5 sq mm', category: 'electrical', uom: 'm', description: 'FR grade insulated copper conductor', min: 200, max: 1000, weekly: 420 },
  { key: 'cable', sku: 'CABLE-3C-2.5', name: '3 Core Copper Cable 2.5 sq mm', category: 'electrical', uom: 'm', description: 'Armoured 3-core power cable', min: 100, max: 500, weekly: 240 },
  { key: 'switchgear', sku: 'SWITCH-MCCB-100A', name: 'MCCB Circuit Breaker 100A', category: 'electrical', uom: 'units', description: 'Moulded case circuit breaker 3-pole', min: 12, max: 60, weekly: 30 },
  { key: 'ledpanel', sku: 'LIGHT-LED-PANEL-40W', name: 'LED Panel Light 40W', category: 'electrical', uom: 'units', description: 'Recessed LED panel, 4000K', min: 25, max: 120, weekly: 55 },
  { key: 'conduit', sku: 'CONDUIT-PVC-25MM', name: 'PVC Conduit Pipe 25mm', category: 'electrical', uom: 'm', description: 'ISI marked heavy duty conduit', min: 150, max: 800, weekly: 300 },
  { key: 'cartonS', sku: 'CARTON-SMALL-12IN', name: 'Corrugated Carton Small 12in', category: 'packaging', uom: 'pieces', description: '3-ply corrugated shipping carton', min: 300, max: 1500, weekly: 650 },
  { key: 'cartonL', sku: 'CARTON-LARGE-24IN', name: 'Corrugated Carton Large 24in', category: 'packaging', uom: 'pieces', description: '3-ply double wall shipping carton', min: 150, max: 800, weekly: 320 },
  { key: 'stretchwrap', sku: 'WRAP-STRETCH-500MM', name: 'Stretch Wrap Roll 500mm', category: 'packaging', uom: 'rolls', description: '23 micron clear pallet wrap', min: 40, max: 200, weekly: 85 },
  { key: 'tapebrown', sku: 'TAPE-BROWN-48MM', name: 'BOPP Packing Tape 48mm', category: 'packaging', uom: 'rolls', description: '2.8 micron adhesive packing tape', min: 60, max: 300, weekly: 130 },
  { key: 'palletwood', sku: 'PALLET-WOOD-STD', name: 'Wooden Pallet Standard', category: 'packaging', uom: 'pieces', description: '1200x1000 untreated timber pallet', min: 20, max: 100, weekly: 45 },
  { key: 'labelthermal', sku: 'LABEL-THERMAL-100X150', name: 'Thermal Label Roll 100x150mm', category: 'packaging', uom: 'rolls', description: 'Direct thermal shipping label', min: 25, max: 120, weekly: 50 },
  { key: 'gloves', sku: 'PPE-GLOVE-NITRILE-M', name: 'Nitrile Safety Gloves (Size M)', category: 'safety', uom: 'pairs', description: 'Chemical resistant powder-free gloves', min: 100, max: 600, weekly: 210 },
  { key: 'vest', sku: 'PPE-VEST-HIVIS', name: 'Hi-Vis Safety Vest Class 2', category: 'safety', uom: 'units', description: 'Fluorescent reflective safety vest', min: 40, max: 200, weekly: 90 },
  { key: 'goggles', sku: 'PPE-GOGGLE-CLEAR', name: 'Clear Safety Goggles', category: 'safety', uom: 'units', description: 'Anti-fog polycarbonate safety goggles', min: 30, max: 150, weekly: 65 },
  { key: 'respirator', sku: 'PPE-RESPIRATOR-N95', name: 'N95 Respirator Mask', category: 'safety', uom: 'units', description: 'NIOSH approved particulate respirator', min: 50, max: 250, weekly: 110 },
  { key: 'firstaid', sku: 'PPE-FIRSTAID-KIT', name: 'Industrial First Aid Kit', category: 'safety', uom: 'units', description: 'Wall-mountable multi-tier first aid box', min: 8, max: 40, weekly: 18 },
  { key: 'fireext', sku: 'SAFETY-FIREEXT-6KG', name: 'Fire Extinguisher 6kg CO2', category: 'safety', uom: 'units', description: 'CO2 extinguisher for electrical fires', min: 6, max: 30, weekly: 14 },
  { key: 'table', sku: 'TABLE-PACK-BENCH', name: 'Packing Bench 1.8m', category: 'furniture', uom: 'units', description: 'Stainless packing table with lower shelf', min: 6, max: 25, weekly: 14 },
  { key: 'shelfunit', sku: 'SHELF-STEEL-5TIER', name: 'Steel Shelving Unit 5-Tier', category: 'furniture', uom: 'units', description: 'Boltless steel storage shelving', min: 10, max: 45, weekly: 22 },
  { key: 'binstack', sku: 'BIN-PLASTIC-60L', name: 'Stackable Plastic Bin 60L', category: 'furniture', uom: 'units', description: 'Heavy duty stackable storage bin', min: 30, max: 150, weekly: 65 },
  { key: 'dolly', sku: 'DOLLY-PLATFORM-4W', name: 'Platform Trolley 4-Wheel', category: 'furniture', uom: 'units', description: '500kg capacity platform dolly', min: 8, max: 35, weekly: 18 },
  { key: 'mat', sku: 'MAT-ANTI-FATIGUE', name: 'Anti-Fatigue Floor Mat', category: 'furniture', uom: 'units', description: 'Ribbed anti-fatigue standing mat', min: 12, max: 60, weekly: 26 },
  { key: 'bubblewrap', sku: 'PACK-BUBBLE-1M', name: 'Bubble Wrap Roll 1m x 100m', category: 'packaging', uom: 'rolls', description: 'Air cushion bubble wrap roll', min: 20, max: 100, weekly: 44 },
  { key: 'edgeguard', sku: 'PACK-EDGE-GUARD-1M', name: 'Edge Protector 1m', category: 'packaging', uom: 'pieces', description: 'L-shaped carton edge protector', min: 150, max: 700, weekly: 300 },
  { key: 'strapping', sku: 'PACK-STRAP-PP-12MM', name: 'PP Strapping Band 12mm', category: 'packaging', uom: 'rolls', description: 'Polypropylene strapping band', min: 30, max: 150, weekly: 62 },
  { key: 'adhesive', sku: 'ADHESIVE-WORKBENCH', name: 'Workbench Assembly Adhesive', category: 'raw', uom: 'tubes', description: 'High strength assembly adhesive', min: 18, max: 72, weekly: 38 },
  { key: 'resin', sku: 'RESIN-EPOXY-1KG', name: 'Epoxy Resin Compound 1kg', category: 'raw', uom: 'kg', description: 'Two-part structural epoxy resin', min: 10, max: 50, weekly: 22 },
  { key: 'grinding', sku: 'ABRASIVE-GRIND-115', name: 'Grinding Disc 115mm', category: 'raw', uom: 'pieces', description: 'Metal grinding wheel 115x6x22', min: 80, max: 400, weekly: 170 },
  { key: 'cuttingdisc', sku: 'ABRASIVE-CUT-115', name: 'Cutting Disc 115mm', category: 'raw', uom: 'pieces', description: 'Metal cutting disc 115x1.2', min: 90, max: 450, weekly: 195 },
  { key: 'wirebrush', sku: 'ABRASIVE-BRUSH-WIRE', name: 'Wire Brush Cup 115mm', category: 'raw', uom: 'pieces', description: 'Twisted knot wire cup brush', min: 40, max: 200, weekly: 85 },
  { key: 'flux', sku: 'SOLDER-FLUX-100G', name: 'Soldering Flux 100g', category: 'raw', uom: 'tubes', description: 'No-clean electronics soldering flux', min: 15, max: 60, weekly: 32 },
  { key: 'oil', sku: 'LUBE-HD-500ML', name: 'Hydraulic Oil ISO 68 500ml', category: 'raw', uom: 'tubes', description: 'Anti-wear hydraulic fluid', min: 20, max: 100, weekly: 44 },
];

export const PARTNER_NAMES = {
  suppliers: [
    'Tata Steel Mills Ltd.', 'Global Fasteners Inc.', 'Jindal Steel & Power', 'SAIL Limited',
    'Mahindra Auto Steels', 'Godrej Industries', 'Asian Paints Industrial', 'Bharat Forge Ltd.',
    'Amul Frozen Logistics', 'Everest Industries', 'Hindalco Novelis', 'Emcure Industries',
    'Supreme Industries Ltd.', 'Pidilite Industries', 'SRF Limited', 'Aarti Industries',
    'Finolex Cables Ltd.', 'Polycab India Ltd.', 'KEI Industries', 'Havells India Ltd.',
  ],
  customers: [
    'Metro Workspaces Ltd.', 'Apex Manufacturing Co.', 'Techno Park Solutions', 'Skyline Infra Pvt Ltd.',
    'Vertex Retail Chain', 'Orion Logistics Pvt Ltd.', 'Bluewave Electronics', 'Nexus Interiors',
    'Sunrise Modular Systems', 'Crest Hospitality Group', 'Nimbus Software Parks', 'Gallant Motors Ltd.',
    'Indus Constructions', 'Helios Pharmaceuticals', 'Trident Textiles Pvt Ltd.', 'Vantage Steel Fabricators',
    'Zenith Auto Components', 'Aster FMCG Distributors', 'Pinnacle Office Supplies', 'Ridgeway Engineering',
  ],
};

// ---------------------------------------------------------------------------
// Pure generator
// ---------------------------------------------------------------------------

/**
 * Build the full master-data dataset deterministically.
 * @param {number} seed defaults to CATALOG_SEED
 * @returns {{users:Array,warehouses:Array,locations:Array,virtualLocations:Array,
 *            categories:Array,products:Array}} keyed by `key` for cross-refs
 */
export function generateCatalog(seed = CATALOG_SEED) {
  const rng = mulberry32(seed);

  const warehouses = WAREHOUSES.map((w) => ({ ...w }));

  const virtualLocations = VIRTUAL_LOCATIONS.map((v) => ({ ...v }));

  const categories = CATEGORIES.map((c) => ({ ...c }));

  const locations = LOCATIONS.map((l) => ({ ...l }));

  // Products: reordering band is jittered deterministically around the pinned
  // min/max so two products in the same category do not share identical bands.
  const products = PRODUCTS.map((p) => {
    const min = Math.max(1, Math.round(p.min * (0.85 + 0.3 * rng())));
    const max = Math.max(min + 1, Math.round(p.max * (0.85 + 0.3 * rng())));
    return {
      key: p.key,
      sku: p.sku,
      name: p.name,
      category: p.category,
      uom: p.uom,
      description: p.description,
      anchor: Boolean(p.anchor),
      min_quantity: min,
      max_quantity: max,
      weekly_demand_hint: p.weekly ?? null,
    };
  });

  // On-hand quantities: derived from the weekly demand hint so the dashboard
  // shows a believable spread of healthy / low / out-of-stock products. The
  // anchor SKUs are OVERRIDDEN by generateHistory.js (which sets on-hand to its
  // last-8-week demand), so their values here are only a starting point.
  const stock = products.map((p) => {
    let qty;
    if (p.anchor) {
      // Deterministic, hand-picked so the demo always shows a low-stock and an
      // out-of-stock alert before generateHistory.js refines the anchors.
      const anchorQty = {
        steel: 180, alum: 65, bolts: 85, chair: 24, frame: 14, paste: 8, helm: 0,
      };
      qty = anchorQty[p.key] ?? 50;
    } else {
      const base = p.weekly_demand_hint ?? 20;
      // Three bands: ~35% healthy (1.5-3x weekly), ~40% borderline (0.6-1.4x),
      // ~25% low (0-0.5x). Uses two draws so the split is stable.
      const roll = rng();
      const factor = roll < 0.35 ? 1.5 + rng() * 1.5 : roll < 0.75 ? 0.6 + rng() * 0.8 : rng() * 0.5;
      qty = Math.max(0, Math.round(base * factor));
    }
    return { productKey: p.key, locationKey: p.anchor ? ANCHOR_LOCATION[p.key] : categoryLocationKey(p.category, rng), quantity: qty, reserved_quantity: 0 };
  });

  return {
    users: DEMO_USERS.map((u) => ({ ...u, password_hash: DEMO_PASSWORD, is_email_verified: true, status: 'active' })),
    warehouses,
    virtualLocations,
    categories,
    locations,
    products,
    stock,
  };
}

/**
 * Pick the internal location a non-anchor product's on-hand quant lives at.
 * Metals go to the heavy racks, packaging to WH2/RACK-C, electrical to
 * WH3/RACK-D, safety to WH3/RACK-E, oversized furniture to WH4/RACK-F,
 * everything else to the nearest bulk floor.
 */
function categoryLocationKey(categoryKey, rng) {
  const map = {
    metals: ['wh1_rackA', 'wh2_stock', 'wh4_rackF'],
    hardware: ['wh1_rackB', 'wh2_stock', 'wh3_rackD'],
    electrical: ['wh3_rackD', 'wh3_stock'],
    packaging: ['wh2_rackC', 'wh2_stock'],
    safety: ['wh3_rackE', 'wh3_stock'],
    furniture: ['wh4_rackF', 'wh1_stock', 'wh1_prod'],
    raw: ['wh1_rackA', 'wh1_stock', 'wh3_stock'],
    finished: ['wh1_stock', 'wh4_staging'],
  };
  const options = map[categoryKey] ?? ['wh1_stock'];
  return options[Math.floor(rng() * options.length) % options.length];
}

// Anchor SKUs pin their quant location explicitly: the generic category map
// would scatter them across racks, and the original demo had all seven anchored
// inside WH1 (generateHistory.js writes the anchors' on-hand at WH1/STOCK).
export const ANCHOR_LOCATION = {
  steel: 'wh1_rackA', alum: 'wh1_rackA', bolts: 'wh1_rackB',
  chair: 'wh1_stock', frame: 'wh1_stock', paste: 'wh1_rackB', helm: 'wh1_rackB',
};

export { hashStringToSeed };
