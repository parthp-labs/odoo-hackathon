import { baseApi } from './baseApi'

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query({
      query: (params) => ({
        url: '/dashboard/kpis',
        params,
      }),
      transformResponse: (response) => {
        const d = response?.data || {}
        return {
          total_products_in_stock: d.totalProductsInStock ?? 0,
          low_stock_count: d.lowStockCount ?? 0,
          out_of_stock_count: d.outOfStockCount ?? 0,
          pending_receipts: d.pendingReceipts ?? 0,
          pending_deliveries: d.pendingDeliveries ?? 0,
          transfers_scheduled: d.internalTransfersScheduled ?? 0,
        }
      },
      providesTags: ['Dashboard'],
    }),

    getLowStockItems: builder.query({
      query: (params) => ({
        url: '/dashboard/low-stock',
        params,
      }),
      transformResponse: (response) => {
        const alerts = response?.data || []
        return alerts.map((a) => ({
          _id: a.productId,
          name: a.productName,
          sku: a.sku,
          category: a.category,
          on_hand: a.onHand,
          min_quantity: a.minThreshold,
          status: a.isOutOfStock ? 'out_of_stock' : 'low_stock',
        }))
      },
      providesTags: ['Dashboard', 'Product'],
    }),

    getRecentActivity: builder.query({
      query: (params) => ({
        url: '/moves',
        params,
      }),
      transformResponse: (response) => {
        const moves = response?.data || []
        return moves.slice(0, 10).map((m) => ({
          _id: m.id,
          reference: m.reference,
          product_name: m.productName,
          source_location_name: m.fromLocation,
          destination_location_name: m.toLocation,
          quantity: m.quantity,
          move_date: m.date,
          user: m.validatedBy,
        }))
      },
      providesTags: ['Move', 'Dashboard'],
    }),

    getStockCharts: builder.query({
      query: (params) => ({
        url: '/stock',
        params,
      }),
      transformResponse: (response) => {
        const quants = response?.data || []
        const categoryMap = {}
        const warehouseMap = {}

        for (const q of quants) {
          const cat = q.category || 'Uncategorized'
          categoryMap[cat] = (categoryMap[cat] || 0) + (q.onHand || 0)
          const wh = q.warehouseName || 'Main'
          warehouseMap[wh] = (warehouseMap[wh] || 0) + (q.onHand || 0)
        }

        return {
          byCategory: Object.entries(categoryMap).map(([label, quantity]) => ({ label, quantity })),
          byWarehouse: Object.entries(warehouseMap).map(([label, quantity]) => ({ label, quantity })),
        }
      },
      providesTags: ['Product', 'Dashboard'],
    }),
  }),
})

export const {
  useGetDashboardStatsQuery,
  useGetLowStockItemsQuery,
  useGetRecentActivityQuery,
  useGetStockChartsQuery,
} = dashboardApi
