import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../src/app.js';
import connectDB from '../src/config/db.config.js';
import User from '../src/models/user.model.js';
import Warehouse from '../src/models/warehouse.model.js';
import Location from '../src/models/location.model.js';
import ProductCategory from '../src/models/productCategory.model.js';
import Product from '../src/models/product.model.js';
import generateToken from '../src/utils/generateToken.js';

describe('Stage 2: Master Data Management Integration Tests', () => {
  let server;
  let baseUrl;
  let managerToken;
  let staffToken;
  let createdWarehouseId;
  let createdLocationId;
  let createdCategoryId;
  let createdProductId;

  before(async () => {
    await connectDB();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api`;

    // Create temporary manager and staff users
    const manager = await User.create({
      name: 'Manager Test',
      email: `mgr_${Date.now()}@example.com`,
      password_hash: 'secret123',
      role: 'inventory_manager',
      is_email_verified: true,
      status: 'active',
    });
    managerToken = generateToken(manager);

    const staff = await User.create({
      name: 'Staff Test',
      email: `staff_${Date.now()}@example.com`,
      password_hash: 'secret123',
      role: 'warehouse_staff',
      is_email_verified: true,
      status: 'active',
    });
    staffToken = generateToken(staff);
  });

  after(async () => {
    // Cleanup created test documents
    if (createdProductId) await Product.findByIdAndDelete(createdProductId);
    if (createdCategoryId) await ProductCategory.findByIdAndDelete(createdCategoryId);
    if (createdLocationId) await Location.findByIdAndDelete(createdLocationId);
    if (createdWarehouseId) {
      await Location.deleteMany({ warehouse: createdWarehouseId });
      await Warehouse.findByIdAndDelete(createdWarehouseId);
    }
    await User.deleteMany({ email: { $regex: /_.*@example\.com$/ } });

    if (server) server.close();
    await mongoose.connection.close();
  });

  describe('1. Warehouses API', () => {
    it('should create a warehouse and auto-generate default stock location', async () => {
      const code = `WH_T_${Date.now().toString().slice(-4)}`;
      const res = await fetch(`${baseUrl}/warehouses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${managerToken}`,
        },
        body: JSON.stringify({
          name: 'Main Logistics Hub',
          code,
          address: '42 Industrial Boulevard',
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.name, 'Main Logistics Hub');
      createdWarehouseId = data.data._id;

      // Verify default Stock location was auto-created
      const defaultLoc = await Location.findOne({
        warehouse: createdWarehouseId,
        name: 'Stock',
      });
      assert.ok(defaultLoc);
      assert.strictEqual(defaultLoc.code, `${code}/STOCK`);
    });

    it('should retrieve list of warehouses', async () => {
      const res = await fetch(`${baseUrl}/warehouses`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data));
      assert.ok(data.count >= 1);
    });

    it('should reject warehouse creation for staff role (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/warehouses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          name: 'Unauthorized Warehouse',
          code: 'UNAUTH',
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.success, false);
    });
  });

  describe('2. Locations API & Virtual Locations', () => {
    it('should initialize default virtual external locations', async () => {
      const res = await fetch(`${baseUrl}/locations/init-virtual`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      const vendorLoc = await Location.findOne({ code: 'PARTNER/VENDORS' });
      assert.ok(vendorLoc);
      assert.strictEqual(vendorLoc.location_type, 'vendor');
    });

    it('should create an internal rack location under the warehouse', async () => {
      const res = await fetch(`${baseUrl}/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${managerToken}`,
        },
        body: JSON.stringify({
          warehouse: createdWarehouseId,
          name: 'Rack A1',
          code: `WH/RACK-A1-${Date.now().toString().slice(-4)}`,
          location_type: 'internal',
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      createdLocationId = data.data._id;
    });

    it('should filter locations by warehouse', async () => {
      const res = await fetch(`${baseUrl}/locations?warehouse=${createdWarehouseId}`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.count >= 2); // Default Stock + Rack A1
    });
  });

  describe('3. Product Categories API', () => {
    it('should create a top-level product category', async () => {
      const res = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${managerToken}`,
        },
        body: JSON.stringify({
          name: `Raw Materials ${Date.now()}`,
          description: 'Industrial raw supplies',
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      createdCategoryId = data.data._id;
    });

    it('should retrieve list of categories', async () => {
      const res = await fetch(`${baseUrl}/categories`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.count >= 1);
    });
  });

  describe('4. Products & Reordering Rules API', () => {
    it('should create a new product with SKU and UoM', async () => {
      const sku = `STEEL-${Date.now().toString().slice(-5)}`;
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${managerToken}`,
        },
        body: JSON.stringify({
          name: 'Heavy Duty Steel Rods',
          sku,
          category: createdCategoryId,
          uom: 'kg',
          description: '10mm reinforced structural steel',
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.uom, 'kg');
      createdProductId = data.data._id;
    });

    it('should search products by SKU substring', async () => {
      const res = await fetch(`${baseUrl}/products?search=STEEL`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.count >= 1);
      assert.ok(data.data.some((p) => p._id === createdProductId));
    });

    it('should configure reordering rules (low stock alert threshold) for a warehouse', async () => {
      const res = await fetch(`${baseUrl}/products/${createdProductId}/reordering-rule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${managerToken}`,
        },
        body: JSON.stringify({
          warehouse_id: createdWarehouseId,
          min_quantity: 20,
          max_quantity: 100,
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data[0].min_quantity, 20);
      assert.strictEqual(data.data[0].max_quantity, 100);
    });

    it('should soft-deactivate product', async () => {
      const res = await fetch(`${baseUrl}/products/${createdProductId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      const dbProduct = await Product.findById(createdProductId);
      assert.strictEqual(dbProduct.is_active, false);
    });
  });
});
