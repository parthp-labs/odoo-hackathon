import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Tags } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Table, { Td, Tr } from '../../components/ui/Table'
import { TableSkeleton } from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import CategoryModal from '../../components/products/CategoryModal'
import toast from 'react-hot-toast'
import { getCategories, deleteCategory } from '../../api/categories.api'
import { usePagination } from '../../hooks/usePagination'

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'parent', label: 'Parent' },
  { key: 'description', label: 'Description' },
  { key: 'actions', label: '', className: 'text-right' },
]

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('loading')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [deletingCategory, setDeletingCategory] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { page, limit, setPage } = usePagination(1, 10)

  async function loadCategories() {
    setStatus('loading')
    try {
      const { data } = await getCategories()
      setCategories(data)
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const categoryMap = Object.fromEntries(categories.map((c) => [c._id, c.name]))
  const paginatedCategories = categories.slice((page - 1) * limit, page * limit)

  function openCreate() {
    setEditingCategory(null)
    setModalOpen(true)
  }

  function openEdit(category) {
    setEditingCategory(category)
    setModalOpen(true)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteCategory(deletingCategory._id)
      toast.success('Category deleted')
      setDeletingCategory(null)
      loadCategories()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete category')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Categories</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Category
        </Button>
      </div>

      <Card>
        {status === 'loading' && <TableSkeleton rows={5} cols={4} />}
        {status === 'error' && <ErrorState message="Could not load categories" onRetry={loadCategories} />}

        {status === 'loaded' && categories.length === 0 && (
          <EmptyState
            icon={Tags}
            title="No categories yet"
            message="Create a category to start organizing your products."
            actionLabel="New Category"
            onAction={openCreate}
          />
        )}

        {status === 'loaded' && categories.length > 0 && (
          <>
          <Table columns={COLUMNS}>
            {paginatedCategories.map((category) => (
              <Tr key={category._id}>
                <Td className="font-medium text-gray-800">{category.name}</Td>
                <Td>{category.parent ? categoryMap[category.parent] || '-' : '-'}</Td>
                <Td className="max-w-xs truncate">{category.description || '-'}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(category)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingCategory(category)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
          <Pagination page={page} limit={limit} total={categories.length} onPageChange={setPage} />
          </>
        )}
      </Card>

      <CategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categories}
        category={editingCategory}
        onSaved={loadCategories}
      />

      <ConfirmDialog
        open={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete category"
        message={`Are you sure you want to delete "${deletingCategory?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  )
}
