import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import ProductForm from '../../components/products/ProductForm'
import { createProduct } from '../../api/products.api'

export default function ProductCreate() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(values) {
    setSubmitting(true)
    try {
      const { data } = await createProduct(values)
      toast.success('Product created')
      navigate(`/products/${data._id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create product')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-800">New Product</h1>
      <Card>
        <ProductForm mode="create" onSubmit={handleSubmit} submitting={submitting} />
      </Card>
    </div>
  )
}
