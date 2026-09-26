import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { locationSchema } from '../../utils/validators'
import { LOCATION_TYPE_OPTIONS, VIRTUAL_LOCATION_TYPES } from '../../utils/constants'

export default function LocationForm({ formId, location = null, warehouses = [], locations = [], onSubmit }) {
  const isVirtual = location && VIRTUAL_LOCATION_TYPES.includes(location.location_type)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      warehouse: location?.warehouse || '',
      parent_location: location?.parent_location || '',
      name: location?.name || '',
      code: location?.code || '',
      location_type: location?.location_type || 'internal',
    },
  })

  useEffect(() => {
    reset({
      warehouse: location?.warehouse || '',
      parent_location: location?.parent_location || '',
      name: location?.name || '',
      code: location?.code || '',
      location_type: location?.location_type || 'internal',
    })
  }, [location, reset])

  const selectedWarehouse = watch('warehouse')

  const warehouseOptions = warehouses.map((w) => ({ value: w._id, label: w.name }))
  const parentOptions = useMemo(
    () =>
      locations
        .filter((l) => l._id !== location?._id && (!selectedWarehouse || l.warehouse === selectedWarehouse))
        .map((l) => ({ value: l._id, label: l.name })),
    [locations, selectedWarehouse, location],
  )

  if (isVirtual) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-gray-300 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            System
          </span>
          <p className="text-sm text-gray-500">This is a system-managed virtual location and cannot be edited.</p>
        </div>
        <Input label="Name" value={location.name} disabled readOnly />
        <Input label="Code" value={location.code} disabled readOnly />
      </div>
    )
  }

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        label="Warehouse"
        options={warehouseOptions}
        error={errors.warehouse?.message}
        {...register('warehouse')}
      />
      <Select
        label="Parent location"
        placeholder="None"
        options={parentOptions}
        error={errors.parent_location?.message}
        {...register('parent_location')}
      />
      <Input label="Name" error={errors.name?.message} {...register('name')} />
      <Input label="Code" error={errors.code?.message} {...register('code')} />
      <Select
        label="Type"
        options={LOCATION_TYPE_OPTIONS.filter((o) => o.value === 'internal' || o.value === 'transit')}
        error={errors.location_type?.message}
        {...register('location_type')}
      />
    </form>
  )
}
