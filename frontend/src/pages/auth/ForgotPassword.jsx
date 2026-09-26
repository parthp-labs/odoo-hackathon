import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { forgotPasswordSchema } from '../../utils/validators'
import { forgotPassword } from '../../api/auth.api'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema) })

  async function onSubmit(values) {
    setServerError('')
    try {
      await forgotPassword(values)
      toast.success('Reset code sent to your email')
      navigate('/reset-password', { state: { email: values.email } })
    } catch (err) {
      setServerError(err.response?.data?.message || 'Unable to send reset code')
    }
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-gray-800">Forgot password</h2>
      <p className="mb-6 text-sm text-gray-500">Enter your email and we&apos;ll send you a reset code</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Email" type="email" placeholder="you@company.com" error={errors.email?.message} {...register('email')} />

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <Button type="submit" className="w-full" loading={isSubmitting} disabled={isSubmitting}>
          Send reset code
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Remembered your password?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
