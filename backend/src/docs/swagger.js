export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'StockSense IMS API',
    version: '1.0.0',
    description:
      'Production-grade RESTful API for StockSense Modular Inventory Management System. Supports multi-warehouse logistics, double-entry stock ledger, spatial rack/shelf layouts, product catalog, operations (Receipts, Deliveries, Transfers, Adjustments), and real-time KPI analytics.',
    contact: {
      name: 'StockSense Team',
    },
  },
  servers: [
    {
      url: 'https://odoo-hackathon-backend-teal.vercel.app',
      description: 'Production Vercel Server',
    },
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token obtained from /api/auth/login or /api/auth/verify-email',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'inventory_manager', 'warehouse_staff'] },
          is_email_verified: { type: 'boolean' },
          status: { type: 'string', enum: ['active', 'pending_verification', 'disabled'] },
        },
      },
      Warehouse: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          code: { type: 'string' },
          address: { type: 'string' },
        },
      },
      Location: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          warehouse: { type: 'string' },
          name: { type: 'string' },
          code: { type: 'string' },
          location_type: { type: 'string', enum: ['internal', 'vendor', 'customer', 'inventory_loss', 'transit'] },
          zone: { type: 'string' },
          aisle: { type: 'string' },
          rack: { type: 'string' },
          shelf: { type: 'string' },
          max_capacity: { type: 'number' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          sku: { type: 'string' },
          category: { type: 'string' },
          uom: { type: 'string' },
          description: { type: 'string' },
          reordering_rules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                warehouse: { type: 'string' },
                min_quantity: { type: 'number' },
                max_quantity: { type: 'number' },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'System Health Check',
        tags: ['Health'],
        responses: {
          200: {
            description: 'System and database health status',
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'inventory_manager', 'warehouse_staff'] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Registration successful, verification OTP sent' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Login user & retrieve JWT token',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'JWT token and user profile returned' },
          401: { description: 'Invalid credentials' },
          403: { description: 'Email unverified' },
        },
      },
    },
    '/api/auth/verify-email': {
      post: {
        summary: 'Verify email with 6-digit OTP',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'otp_code'],
                properties: {
                  email: { type: 'string' },
                  otp_code: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Email successfully verified' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Get current user profile',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'User profile details' },
        },
      },
    },
    '/api/stock': {
      get: {
        summary: 'Get real-time stock balances across locations',
        tags: ['Inventory & Stock'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'product', in: 'query', schema: { type: 'string' } },
          { name: 'location', in: 'query', schema: { type: 'string' } },
          { name: 'warehouse', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Stock availability list with reserved and free-to-use counts' },
        },
      },
    },
    '/api/stock/rack-layout': {
      get: {
        summary: 'Get real-world visual warehouse rack and shelf layout with stored products',
        tags: ['Inventory & Stock'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'warehouse', in: 'query', schema: { type: 'string' }, description: 'Warehouse ID (optional)' },
        ],
        responses: {
          200: {
            description: 'Hierarchical tree of Zones -> Racks -> Shelves with item arrays and capacity',
          },
        },
      },
    },
    '/api/products': {
      get: {
        summary: 'List products with search and category filtering',
        tags: ['Products'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Product list' },
        },
      },
      post: {
        summary: 'Create a new product',
        tags: ['Products'],
        security: [{ BearerAuth: [] }],
        responses: {
          201: { description: 'Product created' },
        },
      },
    },
    '/api/operations': {
      get: {
        summary: 'List operations (Receipts, Deliveries, Transfers, Adjustments)',
        tags: ['Stock Operations'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Operations list' },
        },
      },
      post: {
        summary: 'Create a new stock operation document',
        tags: ['Stock Operations'],
        security: [{ BearerAuth: [] }],
        responses: {
          201: { description: 'Operation created in draft status' },
        },
      },
    },
    '/api/operations/{id}/validate': {
      post: {
        summary: 'Validate operation (executes atomic stock move and ledger logging)',
        tags: ['Stock Operations'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Operation validated successfully' },
        },
      },
    },
    '/api/moves': {
      get: {
        summary: 'Get immutable stock move history / audit ledger',
        tags: ['Move History Ledger'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Chronological list of stock moves' },
        },
      },
    },
    '/api/dashboard/kpis': {
      get: {
        summary: 'Get real-time dashboard KPIs',
        tags: ['Dashboard Analytics'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'KPI counts (in stock, low stock, out of stock, pending receipts/deliveries)' },
        },
      },
    },
    '/api/dashboard/low-stock': {
      get: {
        summary: 'Get low stock alerts based on reordering rules',
        tags: ['Dashboard Analytics'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'List of products requiring reorder' },
        },
      },
    },
  },
};
