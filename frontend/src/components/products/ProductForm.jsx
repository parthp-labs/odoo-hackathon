import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Textarea from '../ui/Textarea'
import Button from '../ui/Button'
import CategoryModal from './CategoryModal'
import ReorderRulesTable from './ReorderRulesTable'
import { productSchema } from '../../utils/validators'
import { UOM_OPTIONS } from '../../utils/constants'
import { getCategories } from '../../api/categories.api'
import { getWarehouses } from '../../api/warehouses.api'
import { getLocations } from '../../api/locations.api'

export default function ProductForm({ mode = 'create', initialData = null, onSubmit, submitting = false }) {
  const [categories, setCategories] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [locations, setLocations] = useState([])
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [pendingCategoryId, setPendingCategoryId] = useState(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: initialData || {
      name: '',
      sku: '',
      category: '',
      uom: 'units',
      description: '',
      initial_quantity: '',
      initial_location: '',
      reordering_rules: [],
    },
  })

  async function loadCategories() {
    const { data } = await getCategories()
    setCategories(data)
  }

  useEffect(() => {
    loadCategories()
    getWarehouses().then(({ data }) => setWarehouses(data))
    getLocations().then(({ data }) => setLocations(data))
  }, [])

  const categoryOptions = categories.map((c) => ({ value: c._id, label: c.name }))
  const warehouseOptions = warehouses.map((w) => ({ value: w._id, label: w.name }))
  const locationOptions = locations
    .filter((l) => l.location_type === 'internal')
    .map((l) => ({ value: l._id, label: l.name }))

  useEffect(() => {
    if (pendingCategoryId && categories.some((c) => c._id === pendingCategoryId)) {
      setValue('category', pendingCategoryId)
      setPendingCategoryId(null)
    }
  }, [categories, pendingCategoryId, setValue])

  function handleCategoryCreated(newCategoryId) {
    if (newCategoryId) setPendingCategoryId(newCategoryId)
    loadCategories()
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Product name" error={errors.name?.message} {...register('name')} />
        <Input label="SKU" error={errors.sku?.message} {...register('sku')} />

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> New category
            </button>
          </div>
          <Select options={categoryOptions} error={errors.category?.message} {...register('category')} />
        </div>

        <Select label="Unit of measure" options={UOM_OPTIONS} error={errors.uom?.message} {...register('uom')} />
      </div>

      <Textarea label="Description" error={errors.description?.message} {...register('description')} />

      {mode === 'create' && (
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">Initial stock (optional)</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Quantity"
              type="number"
              error={errors.initial_quantity?.message}
              {...register('initial_quantity')}
            />
            <Select
              label="Location"
              options={locationOptions}
              error={errors.initial_location?.message}
              {...register('initial_location')}
            />
          </div>
        </div>
      )}

      <ReorderRulesTable
        control={control}
        register={register}
        errors={errors}
        warehouseOptions={warehouseOptions}
      />

      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
        <Button type="submit" loading={submitting} disabled={submitting}>
          {mode === 'create' ? 'Create product' : 'Save changes'}
        </Button>
      </div>
      </form>

      <CategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        categories={categories}
        onSaved={handleCategoryCreated}
      />
    </>
  )
}
