import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.config.js';
import User from '../models/user.model.js';
import Warehouse from '../models/warehouse.model.js';
import Location from '../models/location.model.js';
import ProductCategory from '../models/productCategory.model.js';
import Product from '../models/product.model.js';
import StockQuant from '../models/stockQuant.model.js';
import StockOperation from '../models/stockOperation.model.js';
import StockMove from '../models/stockMove.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const seedDatabase = async () => {
  try {
    console.log('--- Connecting to Database for Seeding ---');
    await connectDB();

    console.log('--- Cleaning previous demo data ---');
    await Promise.all([
      User.deleteMany({ email: { $in: ['admin@stocksense.com', 'manager@stocksense.com', 'staff@stocksense.com'] } }),
      Warehouse.deleteMany({ code: { $in: ['WH1', 'WH2'] } }),
      Location.deleteMany({ code: { $regex: /^(WH1|WH2|PARTNER|VIRTUAL)/ } }),
      ProductCategory.deleteMany({ name: { $in: ['Raw Materials', 'Metals & Alloys', 'Hardware', 'Finished Goods', 'Furniture'] } }),
      Product.deleteMany({ sku: { $regex: /^(STEEL|ALUM|BOLT|CHAIR|FRAME|PASTE|HELM)/ } }),
      StockOperation.deleteMany({ reference: { $regex: /^(REC|DEL|INT|ADJ)\/2026\/000/ } }),
      StockMove.deleteMany({ reference: { $regex: /^(REC|DEL|INT|ADJ)\/2026\/000/ } }),
    ]);

    console.log('--- 1. Seeding Demo Users ---');
    const adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@stocksense.com',
      password_hash: 'Password123!',
      role: 'admin',
      is_email_verified: true,
      email_verified_at: new Date(),
      status: 'active',
    });

    const managerUser = await User.create({
      name: 'Sarah Connor (Inventory Manager)',
      email: 'manager@stocksense.com',
      password_hash: 'Password123!',
      role: 'inventory_manager',
      is_email_verified: true,
      email_verified_at: new Date(),
      status: 'active',
    });

    const staffUser = await User.create({
      name: 'John Doe (Warehouse Staff)',
      email: 'staff@stocksense.com',
      password_hash: 'Password123!',
      role: 'warehouse_staff',
      is_email_verified: true,
      email_verified_at: new Date(),
      status: 'active',
    });

    console.log('--- 2. Seeding Virtual Locations ---');
    const [vendorLoc, customerLoc, lossLoc, transitLoc] = await Promise.all([
      Location.findOneAndUpdate(
        { code: 'PARTNER/VENDORS' },
        { name: 'Vendors / Suppliers', code: 'PARTNER/VENDORS', location_type: 'vendor' },
        { upsert: true, new: true }
      ),
      Location.findOneAndUpdate(
        { code: 'PARTNER/CUSTOMERS' },
        { name: 'Customers / Delivery Clients', code: 'PARTNER/CUSTOMERS', location_type: 'customer' },
        { upsert: true, new: true }
      ),
      Location.findOneAndUpdate(
        { code: 'VIRTUAL/LOSS' },
        { name: 'Inventory Scrap & Loss', code: 'VIRTUAL/LOSS', location_type: 'inventory_loss' },
        { upsert: true, new: true }
      ),
      Location.findOneAndUpdate(
        { code: 'VIRTUAL/TRANSIT' },
        { name: 'Inter-warehouse Transit', code: 'VIRTUAL/TRANSIT', location_type: 'transit' },
        { upsert: true, new: true }
      ),
    ]);

    console.log('--- 3. Seeding Warehouses & Internal Locations ---');
    const wh1 = await Warehouse.create({
      name: 'Main Logistics Hub',
      code: 'WH1',
      address: 'Sector 4, Central Logistics Park, New Delhi',
    });

    const wh2 = await Warehouse.create({
      name: 'Secondary Coastal Warehouse',
      code: 'WH2',
      address: 'Dock 8, Harbor Terminal, Mumbai',
    });

    const [wh1Stock, wh1RackA, wh1RackB, wh1Prod, wh2Stock] = await Promise.all([
      Location.create({
        warehouse: wh1._id,
        name: 'Stock',
        code: 'WH1/STOCK',
        location_type: 'internal',
      }),
      Location.create({
        warehouse: wh1._id,
        name: 'Rack A (Metals)',
        code: 'WH1/RACK-A',
        location_type: 'internal',
      }),
      Location.create({
        warehouse: wh1._id,
        name: 'Rack B (Small Parts)',
        code: 'WH1/RACK-B',
        location_type: 'internal',
      }),
      Location.create({
        warehouse: wh1._id,
        name: 'Production Floor',
        code: 'WH1/PRODUCTION',
        location_type: 'internal',
      }),
      Location.create({
        warehouse: wh2._id,
        name: 'Stock',
        code: 'WH2/STOCK',
        location_type: 'internal',
      }),
    ]);

    console.log('--- 4. Seeding Product Categories ---');
    const catRaw = await ProductCategory.create({
      name: 'Raw Materials',
      description: 'Unprocessed manufacturing materials',
    });

    const catMetals = await ProductCategory.create({
      name: 'Metals & Alloys',
      parent: catRaw._id,
      description: 'Structural and sheet metals',
    });

    const catHardware = await ProductCategory.create({
      name: 'Hardware',
      description: 'Fasteners, consumables, and PPE',
    });

    const catFinished = await ProductCategory.create({
      name: 'Finished Goods',
      description: 'Ready-to-ship products',
    });

    const catFurniture = await ProductCategory.create({
      name: 'Furniture',
      parent: catFinished._id,
      description: 'Office and warehouse furniture',
    });

    console.log('--- 5. Seeding Products & Reordering Rules ---');
    const [pSteel, pAlum, pBolts, pChair, pFrame, pPaste, pHelmets] = await Promise.all([
      Product.create({
        name: 'High Tensile Steel Rods 12mm',
        sku: 'STEEL-12MM-ROD',
        category: catMetals._id,
        uom: 'kg',
        description: 'Grade 60 structural reinforced steel rods',
        reordering_rules: [
          { warehouse: wh1._id, min_quantity: 50, max_quantity: 250 },
        ],
      }),
      Product.create({
        name: 'Aluminum Extrusion Bar 25x25',
        sku: 'ALUM-25X25-BAR',
        category: catMetals._id,
        uom: 'm',
        description: 'Anodized aluminum profile',
        reordering_rules: [
          { warehouse: wh1._id, min_quantity: 20, max_quantity: 100 },
        ],
      }),
      Product.create({
        name: 'M8 Stainless Hex Bolts (Pack of 50)',
        sku: 'BOLT-HEX-M8-P50',
        category: catHardware._id,
        uom: 'packs',
        description: 'Corrosion resistant industrial bolts',
        reordering_rules: [
          { warehouse: wh1._id, min_quantity: 20, max_quantity: 100 },
        ],
      }),
      Product.create({
        name: 'Ergonomic Warehouse Mesh Chair',
        sku: 'CHAIR-ERGO-MESH',
        category: catFurniture._id,
        uom: 'units',
        description: 'Adjustable heavy duty work chair',
        reordering_rules: [
          { warehouse: wh1._id, min_quantity: 10, max_quantity: 40 },
        ],
      }),
      Product.create({
        name: 'Heavy Steel Workbench Frame',
        sku: 'FRAME-STEEL-WORK',
        category: catFurniture._id,
        uom: 'units',
        description: 'Modular packaging table frame',
        reordering_rules: [
          { warehouse: wh1._id, min_quantity: 5, max_quantity: 25 },
        ],
      }),
      Product.create({
        name: 'Industrial Thermal Heat Paste 10g',
        sku: 'PASTE-THERM-10G',
        category: catHardware._id,
        uom: 'tubes',
        description: 'High conductivity heat sink compound',
        reordering_rules: [
          { warehouse: wh1._id, min_quantity: 20, max_quantity: 80 }, // Alert triggered: on-hand is only 8!
        ],
      }),
      Product.create({
        name: 'High-Vis Industrial Hard Hat',
        sku: 'HELM-SAFE-YEL',
        category: catHardware._id,
        uom: 'units',
        description: 'OSHA certified yellow safety helmet',
        reordering_rules: [
          { warehouse: wh1._id, min_quantity: 15, max_quantity: 50 }, // Out of stock: on-hand 0!
        ],
      }),
    ]);

    console.log('--- 6. Seeding Real-Time Stock Quants ---');
    await Promise.all([
      StockQuant.create({ product: pSteel._id, location: wh1Stock._id, quantity: 180, reserved_quantity: 0 }),
      StockQuant.create({ product: pAlum._id, location: wh1RackA._id, quantity: 65, reserved_quantity: 5 }),
      StockQuant.create({ product: pBolts._id, location: wh1RackB._id, quantity: 85, reserved_quantity: 0 }),
      StockQuant.create({ product: pChair._id, location: wh1Stock._id, quantity: 24, reserved_quantity: 4 }),
      StockQuant.create({ product: pFrame._id, location: wh1Stock._id, quantity: 14, reserved_quantity: 0 }),
      // Low stock: 8 <= 20 threshold
      StockQuant.create({ product: pPaste._id, location: wh1RackB._id, quantity: 8, reserved_quantity: 0 }),
      // WH2 secondary stock
      StockQuant.create({ product: pSteel._id, location: wh2Stock._id, quantity: 50, reserved_quantity: 0 }),
    ]);

    console.log('--- 7. Seeding Historical & Pending Operations ---');
    // 1. Completed Receipt (REC/2026/0001)
    const recDone = await StockOperation.create({
      reference: 'REC/2026/0001',
      operation_type: 'receipt',
      status: 'done',
      partner_name: 'Tata Steel Mills Ltd.',
      source_location: vendorLoc._id,
      destination_location: wh1Stock._id,
      created_by: managerUser._id,
      validated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      notes: 'Initial monthly raw steel delivery arrived in full',
      lines: [{ product: pSteel._id, quantity_demanded: 180, quantity_done: 180 }],
    });

    // 2. Pending Receipt (REC/2026/0002 - Ready)
    await StockOperation.create({
      reference: 'REC/2026/0002',
      operation_type: 'receipt',
      status: 'ready',
      partner_name: 'Global Fasteners Inc.',
      source_location: vendorLoc._id,
      destination_location: wh1RackB._id,
      created_by: staffUser._id,
      scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      notes: 'Truck scheduled for 10:00 AM dock bay 2',
      lines: [{ product: pBolts._id, quantity_demanded: 50, quantity_done: 0 }],
    });

    // 3. Completed Internal Transfer (INT/2026/0001)
    const intDone = await StockOperation.create({
      reference: 'INT/2026/0001',
      operation_type: 'internal_transfer',
      status: 'done',
      source_location: wh1Stock._id,
      destination_location: wh1Prod._id,
      created_by: staffUser._id,
      validated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      notes: 'Transfer steel rods to fabrication assembly line',
      lines: [{ product: pSteel._id, quantity_demanded: 20, quantity_done: 20 }],
    });

    // 4. Completed Delivery Order (DEL/2026/0001)
    const delDone = await StockOperation.create({
      reference: 'DEL/2026/0001',
      operation_type: 'delivery',
      status: 'done',
      partner_name: 'Metro Workspaces Ltd.',
      source_location: wh1Stock._id,
      destination_location: customerLoc._id,
      created_by: managerUser._id,
      validated_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      notes: 'Customer pick-up at loading dock complete',
      lines: [{ product: pChair._id, quantity_demanded: 6, quantity_done: 6 }],
    });

    // 5. Pending Delivery Order (DEL/2026/0002 - Waiting / Packing)
    await StockOperation.create({
      reference: 'DEL/2026/0002',
      operation_type: 'delivery',
      status: 'waiting',
      partner_name: 'Apex Manufacturing Co.',
      source_location: wh1Stock._id,
      destination_location: customerLoc._id,
      created_by: staffUser._id,
      scheduled_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      notes: 'Awaiting customer freight carrier dispatch',
      lines: [{ product: pFrame._id, quantity_demanded: 4, quantity_done: 0 }],
    });

    // 6. Completed Stock Adjustment (ADJ/2026/0001)
    const adjDone = await StockOperation.create({
      reference: 'ADJ/2026/0001',
      operation_type: 'adjustment',
      status: 'done',
      source_location: wh1RackA._id,
      destination_location: lossLoc._id,
      created_by: managerUser._id,
      validated_at: new Date(Date.now() - 12 * 60 * 60 * 1000),
      notes: 'Physical count variance: 2m scratched aluminum bar written off as damaged scrap',
      lines: [{ product: pAlum._id, quantity_demanded: 2, quantity_done: 2 }],
    });

    console.log('--- 8. Seeding Move History Ledger Records ---');
    await StockMove.insertMany([
      {
        reference: 'REC/2026/0001',
        operation: recDone._id,
        product: pSteel._id,
        source_location: vendorLoc._id,
        destination_location: wh1Stock._id,
        quantity: 180,
        status: 'done',
        move_date: recDone.validated_at,
        user: managerUser._id,
      },
      {
        reference: 'INT/2026/0001',
        operation: intDone._id,
        product: pSteel._id,
        source_location: wh1Stock._id,
        destination_location: wh1Prod._id,
        quantity: 20,
        status: 'done',
        move_date: intDone.validated_at,
        user: staffUser._id,
      },
      {
        reference: 'DEL/2026/0001',
        operation: delDone._id,
        product: pChair._id,
        source_location: wh1Stock._id,
        destination_location: customerLoc._id,
        quantity: 6,
        status: 'done',
        move_date: delDone.validated_at,
        user: managerUser._id,
      },
      {
        reference: 'ADJ/2026/0001',
        operation: adjDone._id,
        product: pAlum._id,
        source_location: wh1RackA._id,
        destination_location: lossLoc._id,
        quantity: 2,
        status: 'done',
        move_date: adjDone.validated_at,
        user: managerUser._id,
      },
    ]);

    console.log('\n======================================================');
    console.log(' DATABASE SEEDED SUCCESSFULLY WITH DEMO DATA!');
    console.log('======================================================');
    console.log('DEMO ACCOUNTS:');
    console.log('  Admin:   admin@stocksense.com   / Password123!');
    console.log('  Manager: manager@stocksense.com / Password123!');
    console.log('  Staff:   staff@stocksense.com   / Password123!');
    console.log('------------------------------------------------------');
    console.log('SUMMARY:');
    console.log('  Warehouses: 2 (WH1 Main Hub, WH2 Coastal WH)');
    console.log('  Locations:  5 Internal Racks/Zones + 4 Virtual Endpoints');
    console.log('  Products:   7 Items (including Low Stock & Out of Stock)');
    console.log('  Operations: 6 (Receipts, Deliveries, Transfers, Adjustments)');
    console.log('  Ledger:     4 Historical Moves recorded');
    console.log('======================================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seeding Failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedDatabase();
