import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'
import AuthLayout from '../layouts/AuthLayout'
import AppLayout from '../layouts/AppLayout'
import { USER_ROLES } from '../utils/constants'

import Login from '../pages/auth/Login'
import Signup from '../pages/auth/Signup'
import VerifyEmail from '../pages/auth/VerifyEmail'
import ForgotPassword from '../pages/auth/ForgotPassword'
import ResetPassword from '../pages/auth/ResetPassword'

import Dashboard from '../pages/dashboard/Dashboard'
import WarehouseMap from '../pages/warehouse-map/WarehouseMap'

import ProductList from '../pages/products/ProductList'
import ProductCreate from '../pages/products/ProductCreate'
import ProductEdit from '../pages/products/ProductEdit'
import ProductDetail from '../pages/products/ProductDetail'
import Categories from '../pages/products/Categories'

import Warehouses from '../pages/settings/Warehouses'
import Locations from '../pages/settings/Locations'

import MyProfile from '../pages/profile/MyProfile'

import Receipts from '../pages/operations/Receipts'
import Deliveries from '../pages/operations/Deliveries'
import Transfers from '../pages/operations/Transfers'
import OperationCreate from '../pages/operations/OperationCreate'
import OperationDetail from '../pages/operations/OperationDetail'
import Adjustments from '../pages/operations/Adjustments'

import MoveHistory from '../pages/moves/MoveHistory'

import NotFound from '../pages/NotFound'

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/warehouse-map" element={<WarehouseMap />} />

          <Route path="/products" element={<ProductList />} />
          <Route path="/products/new" element={<ProductCreate />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/products/:id/edit" element={<ProductEdit />} />
          <Route path="/categories" element={<Categories />} />

          <Route element={<RoleRoute allowedRoles={[USER_ROLES.ADMIN, USER_ROLES.INVENTORY_MANAGER]} />}>
            <Route path="/settings/warehouses" element={<Warehouses />} />
            <Route path="/settings/locations" element={<Locations />} />
          </Route>

          <Route path="/profile" element={<MyProfile />} />

          <Route path="/operations/receipts" element={<Receipts />} />
          <Route path="/operations/deliveries" element={<Deliveries />} />
          <Route path="/operations/transfers" element={<Transfers />} />
          <Route path="/operations/new" element={<OperationCreate />} />
          <Route path="/operations/:id" element={<OperationDetail />} />
          <Route path="/operations/adjustments" element={<Adjustments />} />
          <Route path="/moves" element={<MoveHistory />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
