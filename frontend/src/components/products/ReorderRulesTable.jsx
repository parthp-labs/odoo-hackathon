import { useFieldArray } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import Select from '../ui/Select'
import Input from '../ui/Input'
import Button from '../ui/Button'

export default function ReorderRulesTable({ control, register, errors, warehouseOptions }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'reordering_rules' })

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Reordering rules</label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => append({ warehouse: '', min_quantity: '', max_quantity: '' })}
        >
          <Plus className="h-4 w-4" /> Add rule
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
          No reordering rules yet. Add one to enable low-stock alerts per warehouse.
        </p>
      )}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-gray-200 p-3">
            <div className="min-w-[180px] flex-1">
              <Select
                label="Warehouse"
                options={warehouseOptions}
                error={errors?.reordering_rules?.[index]?.warehouse?.message}
                {...register(`reordering_rules.${index}.warehouse`)}
              />
            </div>
            <div className="w-28">
              <Input
                label="Min qty"
                type="number"
                error={errors?.reordering_rules?.[index]?.min_quantity?.message}
                {...register(`reordering_rules.${index}.min_quantity`)}
              />
            </div>
            <div className="w-28">
              <Input
                label="Max qty"
                type="number"
                error={errors?.reordering_rules?.[index]?.max_quantity?.message}
                {...register(`reordering_rules.${index}.max_quantity`)}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(index)}
              className="mt-6 rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
