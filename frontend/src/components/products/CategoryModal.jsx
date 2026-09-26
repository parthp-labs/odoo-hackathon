import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Textarea from '../ui/Textarea'
import Button from '../ui/Button'
import { categorySchema } from '../../utils/validators'
import { createCategory, updateCategory } from '../../api/categories.api'

export default function CategoryModal({ open, onClose, onSaved, categories = [], category = null }) {
  const isEdit = !!category

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(categorySchema) })

  useEffect(() => {
    if (open) {
      reset({
        name: category?.name || '',
        parent: category?.parent || '',
        description: category?.description || '',
      })
    }
  }, [open, category, reset])

  async function onSubmit(values) {
    try {
      const payload = { ...values, parent: values.parent || null }
      if (isEdit) {
        await updateCategory(category._id, payload)
        toast.success('Category updated')
        onSaved?.()
      } else {
        const { data } = await createCategory(payload)
        toast.success('Category created')
        onSaved?.(data._id)
      }
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save category')
    }
  }

  const parentOptions = categories
    .filter((c) => c._id !== category?._id)
    .map((c) => ({ value: c._id, label: c.name }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit category' : 'New category'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isSubmitting}>
            Save
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <Input label="Name" error={errors.name?.message} {...register('name')} />
        <Select
          label="Parent category"
          placeholder="None"
          options={parentOptions}
          error={errors.parent?.message}
          {...register('parent')}
        />
        <Textarea label="Description" error={errors.description?.message} {...register('description')} />
      </form>
    </Modal>
  )
}
