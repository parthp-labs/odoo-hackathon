import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import { signupSchema } from '../../utils/validators'
import { USER_ROLE_OPTIONS } from '../../utils/constants'
import { signup } from '../../api/auth.api'

export default function Signup() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(signupSchema) })

  async function onSubmit(values) {
    setServerError('')
    try {
      await signup(values)
      toast.success('Account created! Verify your email to continue.')
      navigate('/verify-email', { state: { email: values.email } })
    } catch (err) {
      setServerError(err.response?.data?.message || 'Unable to sign up. Please try again.')
    }
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-gray-800">Create your account</h2>
      <p className="mb-6 text-sm text-gray-500">Start managing inventory with StockSense</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Full name" placeholder="Jane Doe" error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" placeholder="you@company.com" error={errors.email?.message} {...register('email')} />
        <Select label="Role" options={USER_ROLE_OPTIONS} error={errors.role?.message} {...register('role')} />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirm password"
          type="password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <Button type="submit" className="w-full" loading={isSubmitting} disabled={isSubmitting}>
          Sign up
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
