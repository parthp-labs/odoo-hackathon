import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { KeyRound, ShieldCheck } from 'lucide-react'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Loader from '../../components/ui/Loader'
import ErrorState from '../../components/ui/ErrorState'
import { changePasswordSchema } from '../../utils/validators'
import { formatEnumLabel, initialsFromName } from '../../utils/formatters'
import { USER_STATUS } from '../../utils/constants'
import { getProfile, updateProfile } from '../../api/users.api'
import { changePassword } from '../../api/auth.api'
import { useAuth } from '../../hooks/useAuth'

const STATUS_BADGE = {
  [USER_STATUS.ACTIVE]: 'bg-green-100 text-green-700 border-green-200',
  [USER_STATUS.PENDING_VERIFICATION]: 'bg-amber-100 text-amber-700 border-amber-200',
  [USER_STATUS.DISABLED]: 'bg-red-100 text-red-700 border-red-200',
}

function ProfileDetails({ profile, onUpdated }) {
  const [name, setName] = useState(profile.name)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const { data } = await updateProfile({ name })
      onUpdated(data)
      toast.success('Profile updated')
      setEditing(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Profile">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
          {initialsFromName(profile.name)}
        </div>
        <div className="flex-1 space-y-4">
          {editing ? (
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          ) : (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Name</p>
              <p className="text-sm font-medium text-gray-800">{profile.name}</p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Email</p>
            <p className="text-sm text-gray-800">{profile.email}</p>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Role</p>
              <span className="mt-1 inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                {formatEnumLabel(profile.role)}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Account status</p>
              <span
                className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[profile.status]}`}
              >
                {formatEnumLabel(profile.status)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {editing ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} loading={saving} disabled={saving}>
                  Save
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Edit name
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(changePasswordSchema) })

  async function onSubmit(values) {
    try {
      await changePassword(values)
      toast.success('Password changed successfully')
      reset()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password')
    }
  }

  return (
    <Card title="Change password">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Current password"
          type="password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <Input
          label="New password"
          type="password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label="Confirm new password"
          type="password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
            <KeyRound className="h-4 w-4" /> Update password
          </Button>
        </div>
      </form>
    </Card>
  )
}

export default function MyProfile() {
  const { updateUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState('loading')

  async function loadProfile() {
    setStatus('loading')
    try {
      const { data } = await getProfile()
      setProfile(data)
      setStatus('loaded')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  function handleUpdated(updated) {
    setProfile(updated)
    updateUser({ name: updated.name })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">My Profile</h1>

      {status === 'loading' && <Loader />}
      {status === 'error' && <ErrorState message="Could not load profile" onRetry={loadProfile} />}
      {status === 'loaded' && profile && (
        <div className="max-w-2xl space-y-6">
          <ProfileDetails profile={profile} onUpdated={handleUpdated} />
          <ChangePasswordForm />
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <ShieldCheck className="h-4 w-4" />
        Your credentials are securely stored and never shared.
      </div>
    </div>
  )
}
