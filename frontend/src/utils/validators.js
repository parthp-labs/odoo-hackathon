import { z } from 'zod'
import { USER_ROLES } from './constants'

export const emailSchema = z.string().trim().min(1, 'Email is required').email('Enter a valid email')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Include at least one uppercase letter')
  .regex(/[0-9]/, 'Include at least one number')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    role: z.enum([USER_ROLES.ADMIN, USER_ROLES.INVENTORY_MANAGER, USER_ROLES.WAREHOUSE_STAFF], {
      message: 'Select a role',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const resetPasswordSchema = z
  .object({
    otp: z.string().length(6, 'Enter the 6-digit code'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const productSchema = z
  .object({
    name: z.string().trim().min(1, 'Product name is required'),
    sku: z.string().trim().min(1, 'SKU is required'),
    category: z.string().min(1, 'Select a category'),
    uom: z.string().min(1, 'Select a unit of measure'),
    description: z.string().optional(),
    initial_quantity: z.union([z.string(), z.number()]).optional(),
    initial_location: z.string().optional(),
    reordering_rules: z
      .array(
        z.object({
          warehouse: z.string().min(1, 'Select a warehouse'),
          min_quantity: z.union([z.string(), z.number()]),
          max_quantity: z.union([z.string(), z.number()]),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const rules = data.reordering_rules || []
    const seenWarehouses = new Set()

    rules.forEach((rule, index) => {
      if (rule.warehouse) {
        if (seenWarehouses.has(rule.warehouse)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Warehouse already has a reordering rule',
            path: ['reordering_rules', index, 'warehouse'],
          })
        }
        seenWarehouses.add(rule.warehouse)
      }

      const min = Number(rule.min_quantity)
      const max = Number(rule.max_quantity)
      if (!Number.isNaN(min) && !Number.isNaN(max) && min > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Min quantity must be less than or equal to max',
          path: ['reordering_rules', index, 'max_quantity'],
        })
      }
    })
  })

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required'),
  parent: z.string().optional(),
  description: z.string().optional(),
})

export const warehouseSchema = z.object({
  name: z.string().trim().min(1, 'Warehouse name is required'),
  code: z.string().trim().min(1, 'Code is required'),
  address: z.string().trim().min(1, 'Address is required'),
})

export const locationSchema = z.object({
  warehouse: z.string().optional(),
  parent_location: z.string().optional(),
  name: z.string().trim().min(1, 'Location name is required'),
  code: z.string().trim().min(1, 'Code is required'),
  location_type: z.string().min(1, 'Select a type'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
