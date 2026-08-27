import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const DEFAULT_INVITE_CODE = 'ROAST-BETA1'
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export default function GroupView() {
  const { user, profile, switchGroup } = useAuth()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [activityCount, setActivityCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)

  async function loadGroupData() {
    setLoading(true)
    const since = new Date(Date.now() - ONE_WEEK_MS).toISOString()

    const { data: groupRow } = await supabase
      .from('groups')
      .select('*')
      .eq('id', profile.group_id)
      .single()
    setGroup(groupRow)

    const { data: memberRows } = await supabase
      .from('profiles')
      .select('id, screen_name, avatar_url')
      .eq('group_id', profile.group_id)

    // Roasts received THIS WEEK per member -- likes on their posts,
    // counted by when the like happened, not when the post was made.
    const { data: groupPosts } = await supabase
      .from('feed_posts')
      .select('id, user_id, activity_type, created_at')
      .eq('group_id', profile.group_id)

    const postIds = (groupPosts ?? []).map((p) => p.id)
    let roastsByUser = {}

    if (postIds.length > 0) {
      const { data: likeRows } = await supabase
        .from('feed_likes')
        .select('post_id, created_at')
        .in('post_id', postIds)
        .gte('created_at', since)

      const postAuthor = {}
      for (const p of groupPosts) postAuthor[p.id] = p.user_id

      for (const like of likeRows ?? []) {
        const authorId = postAuthor[like.post_id]
        if (!authorId) continue
        roastsByUser[authorId] = (roastsByUser[authorId] ?? 0) + 1
      }
    }

    const ranked = (memberRows ?? [])
      .map((m) => ({ ...m, roasts: roastsByUser[m.id] ?? 0 }))
      .sort((a, b) => b.roasts - a.roasts)
    setMembers(ranked)

    // Distinct activity "modes" (stripping the _FAIL/_PR/etc suffix)
    // posted by the group in the last week.
    const recentPosts = (groupPosts ?? []).filter((p) => new Date(p.created_at) > new Date(since))
    const modes = new Set(recentPosts.map((p) => p.activity_type.split('_')[0]))
    setActivityCount(modes.size)

    setLoading(false)
  }

  useEffect(() => {
    if (profile?.group_id) loadGroupData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.group_id])

  function copyInviteCode() {
    if (!group) return
    navigator.clipboard.writeText(group.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleLeaveGroup() {
    if (group?.invite_code === DEFAULT_INVITE_CODE) {
      alert("You're already in the default group -- nowhere else to go yet. Create or join a group first!")
      return
    }
    if (!confirm(`Leave "${group?.name}"? You'll be moved back to the default group.`)) return

    setLeaving(true)
    try {
      const { data: defaultGroup, error: lookupError } = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', DEFAULT_INVITE_CODE)
        .single()
      if (lookupError) throw lookupError

      const { error } = await switchGroup(defaultGroup.id)
      if (error) throw error
    } catch (err) {
      alert(`Couldn't leave group: ${err.message ?? err}`)
    } finally {
      setLeaving(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <p className="text-muted font-body py-8">Loading your group...</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <p className="text-blue-400 text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        YOUR GROUP
      </p>
      <h1 className="font-display text-4xl text-blue-400 mb-6">{group?.name ?? 'Unknown Group'}</h1>

      <p className="font-display text-2xl text-blue-400 mb-4">Group Stats</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="border border-blue-400/50 rounded-2xl px-3 py-4 text-center">
          <p className="font-display text-2xl">{members.length}</p>
          <p className="text-muted font-body text-xs">Members</p>
        </div>
        <div className="border border-blue-400/50 rounded-2xl px-3 py-4 text-center">
          <p className="font-display text-2xl text-orange">
            {members.reduce((sum, m) => sum + m.roasts, 0)}
          </p>
          <p className="text-muted font-body text-xs">Roasts</p>
        </div>
        <div className="border border-blue-400/50 rounded-2xl px-3 py-4 text-center">
          <p className="font-display text-2xl text-bowling">{activityCount}</p>
          <p className="text-muted font-body text-xs">Activities</p>
        </div>
      </div>

      <p className="text-muted text-sm tracking-widest font-body font-semibold mb-2">
        INVITE CODE
      </p>
      <div className="flex items-center justify-between bg-panel border border-panel-border rounded-2xl px-5 py-4 mb-6">
        <p className="font-display text-xl text-orange tracking-wider">{group?.invite_code}</p>
        <button
          onClick={copyInviteCode}
          className="bg-black/30 text-white font-body text-sm px-4 py-2 rounded-xl"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <p className="text-muted text-sm tracking-widest font-body font-semibold mb-3">
        MEMBERS · THIS WEEK
      </p>
      <div className="space-y-2 mb-6">
        {members.map((m, i) => (
          <div
            key={m.id}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
              i === 0 && m.roasts > 0 ? 'border-orange bg-orange/5' : 'border-panel-border'
            }`}
          >
            {i === 0 && m.roasts > 0 && <span>👑</span>}
            <span className="text-muted font-body text-sm w-6">#{i + 1}</span>
            <div className="w-8 h-8 rounded-full bg-orange flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (m.screen_name ?? '?').slice(0, 2).toUpperCase()
              )}
            </div>
            <p className="font-body font-semibold flex-1">
              {m.screen_name}
              {m.id === user.id && <span className="text-muted font-normal"> (you)</span>}
            </p>
            {i === 0 && m.roasts > 0 && (
              <span className="text-orange font-body text-xs">Weekly Leader</span>
            )}
            <span className="font-display text-lg text-orange">{m.roasts}</span>
          </div>
        ))}
      </div>

      <Link
        to="/group/join"
        className="block text-center w-full border-2 border-blue-400 text-blue-400 font-display text-lg py-4 rounded-2xl mb-4"
      >
        JOIN OR CREATE ANOTHER GROUP
      </Link>

      <button
        onClick={handleLeaveGroup}
        disabled={leaving}
        className="w-full text-red-400 font-body text-sm underline disabled:opacity-60"
      >
        {leaving ? 'Leaving...' : 'Leave this group'}
      </button>
    </Layout>
  )
}
