import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../src/app.js';
import connectDB from '../src/config/db.config.js';
import User from '../src/models/user.model.js';
import Warehouse from '../src/models/warehouse.model.js';
import Location from '../src/models/location.model.js';
import Product from '../src/models/product.model.js';
import StockQuant from '../src/models/stockQuant.model.js';
import StockOperation from '../src/models/stockOperation.model.js';
import generateToken from '../src/utils/generateToken.js';

describe('Stage 4: Dashboard KPIs & Analytics Integration Tests', () => {
  let server;
  let baseUrl;
  let managerUser;
  let managerToken;
  let testWarehouse;
  let testLocation;
  let lowStockProduct;
  let outOfStockProduct;
  let regularProduct;

  before(async () => {
    await connectDB();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/dashboard`;

    // 1. Create Manager User
    managerUser = await User.create({
      name: 'Dashboard Manager',
      email: `dash_mgr_${Date.now()}@example.com`,
      password_hash: 'secret123',
      role: 'inventory_manager',
      is_email_verified: true,
      status: 'active',
    });
    managerToken = generateToken(managerUser);

    // 2. Setup Warehouse & Location
    const whCode = `WH_DB_${Date.now().toString().slice(-4)}`;
    testWarehouse = await Warehouse.create({
      name: 'Dashboard Analytics Warehouse',
      code: whCode,
      address: '77 Dashboard Blvd',
    });

    testLocation = await Location.create({
      warehouse: testWarehouse._id,
      name: 'Main Storage Zone',
      code: `${whCode}/ZONE-1`,
      location_type: 'internal',
    });

    // 3. Create Products with Reordering Rules
    // Product A: Low stock (on hand: 5, min threshold: 20)
    lowStockProduct = await Product.create({
      name: 'Thermal Paste 10g',
      sku: `PASTE-${Date.now().toString().slice(-5)}`,
      uom: 'tubes',
      reordering_rules: [
        {
          warehouse: testWarehouse._id,
          min_quantity: 20,
          max_quantity: 100,
        },
      ],
    });
    await StockQuant.create({
      product: lowStockProduct._id,
      location: testLocation._id,
      quantity: 5,
    });

    // Product B: Out of stock (on hand: 0, min threshold: 10)
    outOfStockProduct = await Product.create({
      name: 'Lithium Battery Pack',
      sku: `BATT-${Date.now().toString().slice(-5)}`,
      uom: 'units',
      reordering_rules: [
        {
          warehouse: testWarehouse._id,
          min_quantity: 10,
          max_quantity: 50,
        },
      ],
    });

    // Product C: Regular stock (on hand: 150, min threshold: 20)
    regularProduct = await Product.create({
      name: 'Standard Cable 2m',
      sku: `CABLE-${Date.now().toString().slice(-5)}`,
      uom: 'units',
      reordering_rules: [
        {
          warehouse: testWarehouse._id,
          min_quantity: 20,
          max_quantity: 200,
        },
      ],
    });
    await StockQuant.create({
      product: regularProduct._id,
      location: testLocation._id,
      quantity: 150,
    });

    // 4. Create sample pending operations
    await StockOperation.create({
      reference: `REC/TEST/${Date.now().toString().slice(-4)}`,
      operation_type: 'receipt',
      status: 'ready',
      source_location: testLocation._id,
      destination_location: testLocation._id,
      lines: [{ product: regularProduct._id, quantity_demanded: 50 }],
    });

    await StockOperation.create({
      reference: `DEL/TEST/${Date.now().toString().slice(-4)}`,
      operation_type: 'delivery',
      status: 'waiting',
      source_location: testLocation._id,
      destination_location: testLocation._id,
      lines: [{ product: regularProduct._id, quantity_demanded: 10 }],
    });

    await StockOperation.create({
      reference: `INT/TEST/${Date.now().toString().slice(-4)}`,
      operation_type: 'internal_transfer',
      status: 'draft',
      source_location: testLocation._id,
      destination_location: testLocation._id,
      lines: [{ product: lowStockProduct._id, quantity_demanded: 5 }],
    });
  });

  after(async () => {
    // Cleanup test data
    const pIds = [lowStockProduct?._id, outOfStockProduct?._id, regularProduct?._id].filter(Boolean);
    await StockQuant.deleteMany({ product: { $in: pIds } });
    await StockOperation.deleteMany({ 'lines.product': { $in: pIds } });
    await Product.deleteMany({ _id: { $in: pIds } });

    if (testWarehouse) {
      await Location.deleteMany({ warehouse: testWarehouse._id });
      await Warehouse.findByIdAndDelete(testWarehouse._id);
    }
    if (managerUser) {
      await User.findByIdAndDelete(managerUser._id);
    }

    if (server) server.close();
    await mongoose.connection.close();
  });

  describe('1. Dashboard KPIs Endpoint (GET /api/dashboard/kpis)', () => {
    it('should compute real-time inventory KPIs', async () => {
      const res = await fetch(`${baseUrl}/kpis?warehouse=${testWarehouse._id}`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      const kpis = data.data;
      assert.ok(kpis.totalProductsInStock >= 2); // Paste + Cable
      assert.ok(kpis.totalUnitsInStock >= 155); // 5 + 150
      assert.ok(kpis.lowStockCount >= 1); // Paste (5 <= 20)
      assert.ok(kpis.outOfStockCount >= 1); // Battery (0)
      assert.ok(kpis.pendingReceipts >= 1);
      assert.ok(kpis.pendingDeliveries >= 1);
      assert.ok(kpis.internalTransfersScheduled >= 1);
    });
  });

  describe('2. Dashboard Operations Feed (GET /api/dashboard/operations)', () => {
    it('should filter operations by type and status', async () => {
      const res = await fetch(`${baseUrl}/operations?type=receipt&status=ready`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.count >= 1);
      assert.ok(data.data.every((op) => op.operation_type === 'receipt' && op.status === 'ready'));
    });

    it('should support pagination metadata', async () => {
      const res = await fetch(`${baseUrl}/operations?limit=2&page=1`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.page, 1);
      assert.ok(data.pages >= 1);
      assert.ok(data.data.length <= 2);
    });
  });

  describe('3. Low Stock Alerts Widget (GET /api/dashboard/low-stock)', () => {
    it('should return low stock and out of stock product alerts with thresholds', async () => {
      const res = await fetch(`${baseUrl}/low-stock?warehouse=${testWarehouse._id}`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.count >= 2);

      const pasteAlert = data.data.find((a) => a.productId === lowStockProduct._id.toString());
      assert.ok(pasteAlert);
      assert.strictEqual(pasteAlert.onHand, 5);
      assert.strictEqual(pasteAlert.minThreshold, 20);
      assert.strictEqual(pasteAlert.isOutOfStock, false);

      const battAlert = data.data.find((a) => a.productId === outOfStockProduct._id.toString());
      assert.ok(battAlert);
      assert.strictEqual(battAlert.onHand, 0);
      assert.strictEqual(battAlert.isOutOfStock, true);
    });
  });
});
