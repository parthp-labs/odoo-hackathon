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
import StockMove from '../src/models/stockMove.model.js';
import generateToken from '../src/utils/generateToken.js';

describe('Stage 3: Core Inventory Engine & Operations Integration Tests', () => {
  let server;
  let baseUrl;
  let staffUser;
  let staffToken;
  let testProduct;
  let mainWarehouse;
  let mainStoreLocation;
  let productionRackLocation;
  let vendorLocation;
  let customerLocation;
  let lossLocation;

  before(async () => {
    await connectDB();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api`;

    // 1. Create staff user
    staffUser = await User.create({
      name: 'Warehouse Operator',
      email: `op_${Date.now()}@example.com`,
      password_hash: 'secret123',
      role: 'warehouse_staff',
      is_email_verified: true,
      status: 'active',
    });
    staffToken = generateToken(staffUser);

    // 2. Setup Warehouse & Locations
    const whCode = `WH_OP_${Date.now().toString().slice(-4)}`;
    mainWarehouse = await Warehouse.create({
      name: 'Operations Central WH',
      code: whCode,
      address: '100 Logistics Way',
    });

    mainStoreLocation = await Location.create({
      warehouse: mainWarehouse._id,
      name: 'Main Store',
      code: `${whCode}/MAIN-STORE`,
      location_type: 'internal',
    });

    productionRackLocation = await Location.create({
      warehouse: mainWarehouse._id,
      name: 'Production Rack',
      code: `${whCode}/PROD-RACK`,
      location_type: 'internal',
    });

    // Ensure virtual locations exist
    vendorLocation =
      (await Location.findOne({ code: 'PARTNER/VENDORS' })) ||
      (await Location.create({
        name: 'Vendors',
        code: 'PARTNER/VENDORS',
        location_type: 'vendor',
      }));

    customerLocation =
      (await Location.findOne({ code: 'PARTNER/CUSTOMERS' })) ||
      (await Location.create({
        name: 'Customers',
        code: 'PARTNER/CUSTOMERS',
        location_type: 'customer',
      }));

    lossLocation =
      (await Location.findOne({ code: 'VIRTUAL/LOSS' })) ||
      (await Location.create({
        name: 'Inventory Loss / Scrap',
        code: 'VIRTUAL/LOSS',
        location_type: 'inventory_loss',
      }));

    // 3. Create Test Product
    testProduct = await Product.create({
      name: 'Structural Steel 100mm',
      sku: `STEEL-${Date.now().toString().slice(-5)}`,
      uom: 'kg',
      reordering_rules: [
        {
          warehouse: mainWarehouse._id,
          min_quantity: 40,
          max_quantity: 200,
        },
      ],
    });
  });

  after(async () => {
    // Clean up created test data
    if (testProduct) {
      await StockQuant.deleteMany({ product: testProduct._id });
      await StockMove.deleteMany({ product: testProduct._id });
      await StockOperation.deleteMany({ 'lines.product': testProduct._id });
      await Product.findByIdAndDelete(testProduct._id);
    }
    if (mainWarehouse) {
      await Location.deleteMany({ warehouse: mainWarehouse._id });
      await Warehouse.findByIdAndDelete(mainWarehouse._id);
    }
    if (staffUser) {
      await User.findByIdAndDelete(staffUser._id);
    }

    if (server) server.close();
    await mongoose.connection.close();
  });

  describe('Step 1: Receive Goods from Vendor (Receipt: +100 kg)', () => {
    let receiptId;

    it('should create a receipt operation in draft status', async () => {
      const res = await fetch(`${baseUrl}/operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          operation_type: 'receipt',
          partner_name: 'Tata Steel Mills',
          source_location: vendorLocation._id,
          destination_location: mainStoreLocation._id,
          lines: [
            {
              product: testProduct._id,
              quantity_demanded: 100,
              quantity_done: 100,
            },
          ],
        }),
      });
      const data = await res.json();

      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.operation_type, 'receipt');
      assert.strictEqual(data.data.status, 'draft');
      assert.ok(data.data.reference.startsWith('REC/'));
      receiptId = data.data._id;
    });

    it('should validate receipt and atomically increment stock (+100) and record stock move', async () => {
      const res = await fetch(`${baseUrl}/operations/${receiptId}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'done');

      // Check stock quant at Main Store
      const quant = await StockQuant.findOne({
        product: testProduct._id,
        location: mainStoreLocation._id,
      });
      assert.ok(quant);
      assert.strictEqual(quant.quantity, 100);

      // Check stock move ledger
      const move = await StockMove.findOne({
        operation: receiptId,
        product: testProduct._id,
      });
      assert.ok(move);
      assert.strictEqual(move.quantity, 100);
      assert.strictEqual(move.source_location.toString(), vendorLocation._id.toString());
      assert.strictEqual(move.destination_location.toString(), mainStoreLocation._id.toString());
    });
  });

  describe('Step 2: Internal Transfer (Main Store -> Production Rack: 50 kg)', () => {
    let transferId;

    it('should create and validate internal transfer', async () => {
      // 1. Create transfer
      const createRes = await fetch(`${baseUrl}/operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          operation_type: 'internal_transfer',
          source_location: mainStoreLocation._id,
          destination_location: productionRackLocation._id,
          lines: [
            {
              product: testProduct._id,
              quantity_demanded: 50,
              quantity_done: 50,
            },
          ],
        }),
      });
      const createData = await createRes.json();
      assert.strictEqual(createRes.status, 201);
      transferId = createData.data._id;

      // 2. Validate transfer
      const valRes = await fetch(`${baseUrl}/operations/${transferId}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const valData = await valRes.json();
      assert.strictEqual(valRes.status, 200);
      assert.strictEqual(valData.data.status, 'done');

      // Verify Main Store decremented to 50
      const mainQuant = await StockQuant.findOne({
        product: testProduct._id,
        location: mainStoreLocation._id,
      });
      assert.strictEqual(mainQuant.quantity, 50);

      // Verify Production Rack incremented to 50
      const prodQuant = await StockQuant.findOne({
        product: testProduct._id,
        location: productionRackLocation._id,
      });
      assert.strictEqual(prodQuant.quantity, 50);
    });
  });

  describe('Step 3: Delivery Order to Customer (Production Rack -> Customer: 20 kg)', () => {
    it('should deliver goods to customer and decrement warehouse stock', async () => {
      // Create delivery order
      const createRes = await fetch(`${baseUrl}/operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          operation_type: 'delivery',
          partner_name: 'Acme Constructions',
          source_location: productionRackLocation._id,
          destination_location: customerLocation._id,
          lines: [
            {
              product: testProduct._id,
              quantity_demanded: 20,
              quantity_done: 20,
            },
          ],
        }),
      });
      const createData = await createRes.json();
      assert.strictEqual(createRes.status, 201);
      const deliveryId = createData.data._id;

      // Validate delivery
      const valRes = await fetch(`${baseUrl}/operations/${deliveryId}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      assert.strictEqual(valRes.status, 200);

      // Verify Production Rack decreased from 50 to 30
      const prodQuant = await StockQuant.findOne({
        product: testProduct._id,
        location: productionRackLocation._id,
      });
      assert.strictEqual(prodQuant.quantity, 30);
    });
  });

  describe('Step 4: Stock Adjustment (Scrap / Damaged: 3 kg)', () => {
    it('should adjust 3 kg damaged steel to scrap location', async () => {
      const createRes = await fetch(`${baseUrl}/operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          operation_type: 'adjustment',
          notes: '3 kg bent rods written off as damaged scrap',
          source_location: productionRackLocation._id,
          destination_location: lossLocation._id,
          lines: [
            {
              product: testProduct._id,
              quantity_demanded: 3,
              quantity_done: 3,
            },
          ],
        }),
      });
      const createData = await createRes.json();
      assert.strictEqual(createRes.status, 201);
      const adjId = createData.data._id;

      const valRes = await fetch(`${baseUrl}/operations/${adjId}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      assert.strictEqual(valRes.status, 200);

      // Verify Production Rack decreased from 30 to 27
      const prodQuant = await StockQuant.findOne({
        product: testProduct._id,
        location: productionRackLocation._id,
      });
      assert.strictEqual(prodQuant.quantity, 27);
    });
  });

  describe('Step 5: Insufficient Stock Protection', () => {
    it('should reject validation if attempting to move more than available stock', async () => {
      const createRes = await fetch(`${baseUrl}/operations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          operation_type: 'delivery',
          partner_name: 'Overdraft Buyer',
          source_location: productionRackLocation._id, // currently has only 27
          destination_location: customerLocation._id,
          lines: [
            {
              product: testProduct._id,
              quantity_demanded: 500,
              quantity_done: 500,
            },
          ],
        }),
      });
      const createData = await createRes.json();
      assert.strictEqual(createRes.status, 201);
      const overDeliveryId = createData.data._id;

      const valRes = await fetch(`${baseUrl}/operations/${overDeliveryId}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const valData = await valRes.json();

      assert.strictEqual(valRes.status, 400);
      assert.strictEqual(valData.success, false);
      assert.ok(valData.error.includes('Insufficient stock'));
    });
  });

  describe('Step 6: Real-time Stock Balances & Move History Ledger', () => {
    it('should retrieve real-time stock balances across locations', async () => {
      const res = await fetch(`${baseUrl}/stock?product=${testProduct._id}`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.count, 2); // Main Store (50) and Production Rack (27)

      const storeBalance = data.data.find((item) => item.locationName === 'Main Store');
      const prodBalance = data.data.find((item) => item.locationName === 'Production Rack');

      assert.ok(storeBalance);
      assert.strictEqual(storeBalance.onHand, 50);

      assert.ok(prodBalance);
      assert.strictEqual(prodBalance.onHand, 27);
      // Min threshold was 40, so 27 should be marked as Low Stock!
      assert.strictEqual(prodBalance.isLowStock, true);
    });

    it('should retrieve full immutable Move History ledger in chronological order', async () => {
      const res = await fetch(`${baseUrl}/moves?product=${testProduct._id}`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.count, 4); // Receipt(100), Transfer(50), Delivery(20), Adjustment(3)

      // Verify each move entry has reference, from, to, and quantity
      assert.ok(data.data[0].reference);
      assert.ok(data.data[0].fromLocation);
      assert.ok(data.data[0].toLocation);
      assert.ok(data.data[0].validatedBy);
    });
  });
});
