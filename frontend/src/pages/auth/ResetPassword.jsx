import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { newPasswordSchema } from '../../utils/validators'
import { resetPassword } from '../../api/auth.api'

const OTP_LENGTH = 6

export default function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = location.state?.email || ''

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [otpError, setOtpError] = useState('')
  const [attemptsLeft, setAttemptsLeft] = useState(null)
  const [serverError, setServerError] = useState('')
  const inputRefs = useRef([])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(newPasswordSchema) })

  function handleChange(index, value) {
    const clean = value.replace(/\D/g, '')
    const next = [...digits]
    next[index] = clean ? clean[clean.length - 1] : ''
    setDigits(next)
    if (clean && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((char, i) => {
      next[i] = char
    })
    setDigits(next)
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
  }

  async function onSubmit(values) {
    const otp = digits.join('')
    if (otp.length !== OTP_LENGTH) {
      setOtpError('Enter the full 6-digit code')
      return
    }
    setOtpError('')
    setServerError('')
    try {
      await resetPassword({ email, otp, password: values.password })
      toast.success('Password reset! You can now sign in.')
      navigate('/login')
    } catch (err) {
      const left = err.response?.data?.attempts_left
      if (typeof left === 'number') setAttemptsLeft(left)
      setOtpError(err.response?.data?.message || 'Invalid or expired code')
    }
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-gray-800">Reset password</h2>
      <p className="mb-6 text-sm text-gray-500">
        Enter the code sent to <span className="font-medium text-gray-700">{email || 'your email'}</span> and choose a
        new password
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex justify-between gap-2" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="h-12 w-12 rounded-lg border border-gray-300 text-center text-lg font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          ))}
        </div>
        {otpError && (
          <p className="text-sm text-red-600">
            {otpError} {attemptsLeft > 0 && `(${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left)`}
          </p>
        )}

        <Input
          label="New password"
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirm new password"
          type="password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <Button type="submit" className="w-full" loading={isSubmitting} disabled={isSubmitting}>
          Reset password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
