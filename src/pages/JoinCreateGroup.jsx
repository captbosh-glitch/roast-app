import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

function randomInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous 0/O/1/I
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `ROAST-${code}`
}

export default function JoinCreateGroup() {
  const { user, updateProfile } = useAuth()
  const navigate = useNavigate()

  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  const [groupName, setGroupName] = useState('')
  const [nameStatus, setNameStatus] = useState(null) // null | 'checking' | 'available' | 'taken'
  const [creating, setCreating] = useState(false)

  // Debounced live-availability check as the user types a group name.
  useEffect(() => {
    if (!groupName.trim()) {
      setNameStatus(null)
      return
    }
    setNameStatus('checking')
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('groups')
        .select('id')
        .eq('name', groupName.trim())
        .maybeSingle()
      setNameStatus(data ? 'taken' : 'available')
    }, 400)
    return () => clearTimeout(timeout)
  }, [groupName])

  async function handleJoin(e) {
    e.preventDefault()
    setJoinError('')
    setJoining(true)
    try {
      const { data: targetGroup, error } = await supabase
        .from('groups')
        .select('id, name')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .single()

      if (error || !targetGroup) {
        setJoinError("Couldn't find a group with that invite code.")
        return
      }

      const { error: updateError } = await updateProfile({ group_id: targetGroup.id })
      if (updateError) throw updateError

      navigate('/group')
    } catch (err) {
      setJoinError(err.message ?? String(err))
    } finally {
      setJoining(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (nameStatus !== 'available') return

    setCreating(true)
    try {
      // Small retry loop in case of an extremely unlikely invite-code
      // collision (the unique constraint on invite_code would reject it).
      let newGroup = null
      let lastError = null
      for (let attempt = 0; attempt < 3 && !newGroup; attempt++) {
        const { data, error } = await supabase
          .from('groups')
          .insert({ name: groupName.trim(), invite_code: randomInviteCode() })
          .select()
          .single()
        if (!error) {
          newGroup = data
        } else {
          lastError = error
        }
      }
      if (!newGroup) throw lastError

      const { error: updateError } = await updateProfile({ group_id: newGroup.id })
      if (updateError) throw updateError

      navigate('/group')
    } catch (err) {
      alert(`Couldn't create group: ${err.message ?? err}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Layout>
      <p className="text-blue-400 text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        JOIN THE FUN
      </p>
      <h1 className="font-display text-4xl mb-8">Groups</h1>

      <form onSubmit={handleJoin} className="mb-10">
        <p className="text-muted text-sm tracking-widest font-body font-semibold mb-3">
          JOIN ANOTHER GROUP
        </p>
        <div className="flex gap-3">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter invite code"
            className="flex-1 bg-panel border border-panel-border rounded-2xl px-5 py-4 text-white font-body outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            disabled={joining || !joinCode.trim()}
            className="bg-blue-400 text-black font-display text-lg px-6 rounded-2xl disabled:opacity-60"
          >
            {joining ? '...' : 'JOIN'}
          </button>
        </div>
        {joinError && <p className="text-red-400 font-body text-sm mt-2">{joinError}</p>}
      </form>

      <div className="flex items-center gap-4 mb-10">
        <div className="flex-1 h-px bg-panel-border" />
        <span className="text-muted font-body text-sm">OR</span>
        <div className="flex-1 h-px bg-panel-border" />
      </div>

      <form onSubmit={handleCreate}>
        <p className="text-muted text-sm tracking-widest font-body font-semibold mb-3">
          CREATE A NEW GROUP
        </p>
        <div className="flex gap-3 mb-2">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Your group's name"
            className="flex-1 bg-panel border border-panel-border rounded-2xl px-5 py-4 text-white font-body outline-none focus:border-orange"
          />
          <button
            type="submit"
            disabled={creating || nameStatus !== 'available'}
            className="bg-orange text-white font-display text-lg px-6 rounded-2xl disabled:opacity-60"
          >
            {creating ? '...' : 'CREATE'}
          </button>
        </div>
        {nameStatus === 'checking' && (
          <p className="text-muted font-body text-sm">Checking...</p>
        )}
        {nameStatus === 'available' && (
          <p className="text-green-400 font-body text-sm">Name available ✓</p>
        )}
        {nameStatus === 'taken' && (
          <p className="text-red-400 font-body text-sm">That name&rsquo;s already taken</p>
        )}
      </form>
    </Layout>
  )
}
