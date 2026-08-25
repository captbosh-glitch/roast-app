import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

export default function Profile() {
  const { user, profile, updateProfile } = useAuth()
  const [screenName, setScreenName] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [gender, setGender] = useState('Male')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile) return
    setScreenName(profile.screen_name ?? '')
    setHeight(profile.height ?? '')
    setWeight(profile.weight ?? '')
    setGender(profile.gender ?? 'Male')
    setAvatarUrl(profile.avatar_url ?? null)
  }, [profile])

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const filePath = `${user.id}/${Date.now()}-${file.name}`

    // Requires a public "avatars" storage bucket to exist in your
    // Supabase project (Dashboard -> Storage -> New bucket -> "avatars",
    // toggle Public). One-time setup, not something code can create.
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file)

    if (uploadError) {
      setUploading(false)
      alert(`Upload failed: ${uploadError.message}`)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
    setAvatarUrl(data.publicUrl)
    setUploading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const { error } = await updateProfile({
      screen_name: screenName,
      height,
      weight,
      gender,
      avatar_url: avatarUrl,
    })
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <Layout>
      <p className="text-muted text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        TELL US ABOUT YOURSELF{screenName ? `, ${screenName.toUpperCase()}` : ''}!
      </p>
      <h1 className="font-display text-4xl mb-8">Profile</h1>

      <div className="flex justify-center mb-8">
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-panel border border-panel-border overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-muted font-body text-sm">No photo</span>
            )}
          </div>
          <label className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#2A2A2A] flex items-center justify-center cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              disabled={uploading}
            />
            <span className="text-white text-sm">{uploading ? '...' : '✎'}</span>
          </label>
        </div>
      </div>

      <form onSubmit={handleSave} className="max-w-sm">
        <label className="block text-muted text-sm tracking-widest font-body font-semibold mb-2">
          SCREEN NAME
        </label>
        <input
          value={screenName}
          onChange={(e) => setScreenName(e.target.value)}
          className="w-full bg-panel border border-panel-border rounded-2xl px-5 py-4 text-white font-body mb-6 outline-none focus:border-orange"
        />

        <label className="block text-muted text-sm tracking-widest font-body font-semibold mb-2">
          EMAIL
        </label>
        <input
          value={user?.email ?? ''}
          disabled
          className="w-full bg-panel border border-panel-border rounded-2xl px-5 py-4 text-muted font-body mb-6"
        />

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div>
            <label className="block text-muted text-sm tracking-widest font-body font-semibold mb-2">
              HEIGHT
            </label>
            <input
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder={`6'2"`}
              className="w-full bg-panel border border-panel-border rounded-2xl px-3 py-4 text-white font-body outline-none focus:border-orange"
            />
          </div>
          <div>
            <label className="block text-muted text-sm tracking-widest font-body font-semibold mb-2">
              WEIGHT
            </label>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="200lbs"
              className="w-full bg-panel border border-panel-border rounded-2xl px-3 py-4 text-white font-body outline-none focus:border-orange"
            />
          </div>
          <div>
            <label className="block text-muted text-sm tracking-widest font-body font-semibold mb-2">
              GENDER
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full bg-panel border border-panel-border rounded-2xl px-3 py-4 text-white font-body outline-none focus:border-orange"
            >
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-orange text-white font-display text-lg py-4 rounded-2xl disabled:opacity-60"
        >
          {saving ? 'SAVING...' : saved ? 'SAVED ✓' : 'SAVE CHANGES'}
        </button>
      </form>
    </Layout>
  )
}
