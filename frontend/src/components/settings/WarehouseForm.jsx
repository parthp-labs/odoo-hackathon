import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Input from '../ui/Input'
import Textarea from '../ui/Textarea'
import { warehouseSchema } from '../../utils/validators'

export default function WarehouseForm({ formId, warehouse = null, onSubmit }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(warehouseSchema) })

  useEffect(() => {
    reset({
      name: warehouse?.name || '',
      code: warehouse?.code || '',
      address: warehouse?.address || '',
    })
  }, [warehouse, reset])

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Name" error={errors.name?.message} {...register('name')} />
      <Input label="Code" error={errors.code?.message} {...register('code')} />
      <Textarea label="Address" error={errors.address?.message} {...register('address')} />
    </form>
  )
}
