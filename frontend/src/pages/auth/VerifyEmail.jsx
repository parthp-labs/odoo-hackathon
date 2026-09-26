import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Button from '../../components/ui/Button'
import { verifyEmail, resendOtp } from '../../api/auth.api'
import { OTP_PURPOSE, OTP_MAX_ATTEMPTS } from '../../utils/constants'

const OTP_LENGTH = 6
const RESEND_SECONDS = 60

export default function VerifyEmail() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = location.state?.email || ''

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [attemptsLeft, setAttemptsLeft] = useState(OTP_MAX_ATTEMPTS)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_SECONDS)
  const inputRefs = useRef([])

  useEffect(() => {
    if (countdown <= 0) return undefined
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  function handleChange(index, value) {
    const clean = value.replace(/\D/g, '')
    if (!clean) {
      const next = [...digits]
      next[index] = ''
      setDigits(next)
      return
    }
    const next = [...digits]
    next[index] = clean[clean.length - 1]
    setDigits(next)
    if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
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

  async function handleSubmit(e) {
    e.preventDefault()
    const otp = digits.join('')
    if (otp.length !== OTP_LENGTH) {
      setError('Enter the full 6-digit code')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await verifyEmail({ email, otp })
      toast.success('Email verified! You can now sign in.')
      navigate('/login')
    } catch (err) {
      const left = err.response?.data?.attempts_left
      if (typeof left === 'number') setAttemptsLeft(left)
      setError(err.response?.data?.message || 'Invalid or expired code')
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setResending(true)
    try {
      await resendOtp({ email, purpose: OTP_PURPOSE.EMAIL_VERIFICATION })
      toast.success('A new code has been sent')
      setAttemptsLeft(OTP_MAX_ATTEMPTS)
      setCountdown(RESEND_SECONDS)
      setDigits(Array(OTP_LENGTH).fill(''))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend code')
    } finally {
      setResending(false)
    }
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-gray-800">Verify your email</h2>
      <p className="mb-6 text-sm text-gray-500">
        Enter the 6-digit code sent to <span className="font-medium text-gray-700">{email || 'your email'}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        {error && (
          <p className="text-sm text-red-600">
            {error} {attemptsLeft > 0 && `(${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left)`}
          </p>
        )}

        <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
          Verify email
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        {countdown > 0 ? (
          <span>Resend code in {countdown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="font-medium text-primary hover:underline disabled:opacity-50"
          >
            {resending ? 'Resending...' : 'Resend code'}
          </button>
        )}
      </div>
    </div>
  )
}
