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
import generateToken from '../src/utils/generateToken.js';

describe('Warehouse Rack & Shelf Layout Feature Tests', () => {
  let server;
  let baseUrl;
  let userToken;
  let testWarehouse;
  let testLocationRackA;
  let testLocationRackB;
  let testProduct;

  before(async () => {
    await connectDB();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api/stock`;

    const user = await User.create({
      name: 'Rack Inspector',
      email: `rack_inspector_${Date.now()}@example.com`,
      password_hash: 'secret123',
      role: 'inventory_manager',
      is_email_verified: true,
      status: 'active',
    });
    userToken = generateToken(user);

    const whCode = `WH_RACK_${Date.now().toString().slice(-4)}`;
    testWarehouse = await Warehouse.create({
      name: 'Automated Rack Distribution Center',
      code: whCode,
      address: 'Industrial Sector 9',
    });

    testLocationRackA = await Location.create({
      warehouse: testWarehouse._id,
      name: 'Bay A Shelf 1',
      code: `${whCode}/BAY-A/S1`,
      location_type: 'internal',
      zone: 'Zone 1 (High Density)',
      aisle: 'A1',
      rack: 'Rack A',
      shelf: 'Level 1',
      position_index: 1,
      max_capacity: 500,
    });

    testLocationRackB = await Location.create({
      warehouse: testWarehouse._id,
      name: 'Bay A Shelf 2',
      code: `${whCode}/BAY-A/S2`,
      location_type: 'internal',
      zone: 'Zone 1 (High Density)',
      aisle: 'A1',
      rack: 'Rack A',
      shelf: 'Level 2',
      position_index: 2,
      max_capacity: 200,
    });

    testProduct = await Product.create({
      name: 'Precision Ball Bearings 608ZZ',
      sku: `BRG-${Date.now().toString().slice(-6)}`,
      uom: 'boxes',
      reordering_rules: [{ warehouse: testWarehouse._id, min_quantity: 10, max_quantity: 100 }],
    });

    await StockQuant.create({
      product: testProduct._id,
      location: testLocationRackA._id,
      quantity: 120,
      reserved_quantity: 10,
    });
  });

  after(async () => {
    server.close();
  });

  it('GET /api/stock/rack-layout should return structured warehouse rack layout with product details', async () => {
    const res = await fetch(`${baseUrl}/rack-layout?warehouse=${testWarehouse._id}`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.warehouse.id, testWarehouse._id.toString());
    assert.equal(body.summary.totalZones, 1);
    assert.equal(body.summary.totalShelves, 2);
    assert.equal(body.summary.occupiedShelves, 1);
    assert.equal(body.summary.emptyShelves, 1);
    assert.equal(body.summary.totalStoredUnits, 120);

    const zone = body.data[0];
    assert.equal(zone.zoneName, 'Zone 1 (High Density)');
    const rack = zone.racks[0];
    assert.equal(rack.rackId, 'Rack A');
    assert.equal(rack.shelves.length, 2);

    // Shelf 1 should contain our precision ball bearings
    const shelf1 = rack.shelves.find((s) => s.shelfLevel === 'Level 1');
    assert.ok(shelf1);
    assert.equal(shelf1.status, 'occupied');
    assert.equal(shelf1.totalStoredUnits, 120);
    assert.equal(shelf1.occupancyPercentage, 24); // 120 / 500 = 24%
    assert.equal(shelf1.products.length, 1);
    assert.equal(shelf1.products[0].name, 'Precision Ball Bearings 608ZZ');
    assert.equal(shelf1.products[0].onHand, 120);
    assert.equal(shelf1.products[0].reserved, 10);
    assert.equal(shelf1.products[0].freeToUse, 110);

    // Shelf 2 should be empty
    const shelf2 = rack.shelves.find((s) => s.shelfLevel === 'Level 2');
    assert.ok(shelf2);
    assert.equal(shelf2.status, 'empty');
    assert.equal(shelf2.products.length, 0);
  });
});
