import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import Loader from '../../components/ui/Loader'
import ErrorState from '../../components/ui/ErrorState'
import ProductForm from '../../components/products/ProductForm'
import { getProduct, updateProduct } from '../../api/products.api'

export default function ProductEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [status, setStatus] = useState('loading')
  const [submitting, setSubmitting] = useState(false)

  async function loadProduct() {
    setStatus('loading')
    try {
      const { data } = await getProduct(id)
      if (!data) {
        setStatus('error')
        return
      }
      setProduct(data)
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadProduct()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(values) {
    setSubmitting(true)
    try {
      await updateProduct(id, values)
      toast.success('Product updated')
      navigate(`/products/${id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update product')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-800">Edit Product</h1>
      <Card>
        {status === 'loading' && <Loader />}
        {status === 'error' && <ErrorState message="Could not load product" onRetry={loadProduct} />}
        {status === 'loaded' && (
          <ProductForm mode="edit" initialData={product} onSubmit={handleSubmit} submitting={submitting} />
        )}
      </Card>
    </div>
  )
}
