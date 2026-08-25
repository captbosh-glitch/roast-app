import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const BADGE_STYLES = {
  GYM_FAIL: { label: 'GYM · FAIL', className: 'text-gym border-gym' },
  GYM_PR: { label: 'GYM · PR', className: 'text-green-400 border-green-500' },
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function initials(name) {
  return (name ?? '?').slice(0, 2).toUpperCase()
}

export default function Feed() {
  const { profile } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [newSinceLoad, setNewSinceLoad] = useState(0)

  async function loadPosts() {
    const { data } = await supabase
      .from('feed_posts')
      .select('*, profiles(screen_name, avatar_url)')
      .eq('group_id', profile.group_id)
      .order('created_at', { ascending: false })
      .limit(30)
    setPosts(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!profile?.group_id) return
    loadPosts()

    // Real-time: new posts from anyone in the group appear instantly,
    // without needing to refresh -- this is what makes the "LIVE" badge
    // on very-recent posts actually true, not just decorative.
    const channel = supabase
      .channel('feed_posts_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_posts', filter: `group_id=eq.${profile.group_id}` },
        async (payload) => {
          const { data: authorProfile } = await supabase
            .from('profiles')
            .select('screen_name, avatar_url')
            .eq('id', payload.new.user_id)
            .single()
          setPosts((prev) => [{ ...payload.new, profiles: authorProfile }, ...prev])
          setNewSinceLoad((n) => n + 1)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.group_id])

  return (
    <Layout>
      <p className="text-orange text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        YOUR CREW&rsquo;S FINEST MOMENTS
      </p>
      <h1 className="font-display text-4xl text-orange mb-8">Live Feed</h1>

      <p className="font-display text-2xl text-orange mb-4">Feed Activity</p>
      <div className="flex gap-4 mb-6">
        <div className="border border-orange/50 rounded-2xl px-6 py-4 text-center">
          <p className="font-display text-3xl text-bowling">{posts.length}</p>
          <p className="text-muted font-body text-sm">Posts</p>
        </div>
        <div className="border border-orange/50 rounded-2xl px-6 py-4 text-center">
          <p className="font-display text-3xl text-drink">{newSinceLoad}</p>
          <p className="text-muted font-body text-sm">New</p>
        </div>
      </div>

      <div className="border-t border-orange/40 mb-2" />

      {loading ? (
        <p className="text-muted font-body text-sm py-8">Loading feed...</p>
      ) : posts.length === 0 ? (
        <p className="text-muted font-body text-sm py-8">
          Nothing here yet -- log a set in Gym Mode to get the roasting started.
        </p>
      ) : (
        <div>
          {posts.map((post) => {
            const badge = BADGE_STYLES[post.activity_type] ?? {
              label: post.activity_type,
              className: 'text-muted border-panel-border',
            }
            const isLive = Date.now() - new Date(post.created_at).getTime() < 60000

            return (
              <Link
                key={post.id}
                to={`/feed/${post.id}`}
                className="block border-b border-panel-border py-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-orange flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                    {post.profiles?.avatar_url ? (
                      <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initials(post.profiles?.screen_name)
                    )}
                  </div>
                  <p className="font-body font-bold">{post.profiles?.screen_name ?? 'Unknown'}</p>
                  <span className={`text-xs font-bold font-body border rounded px-2 py-0.5 ${badge.className}`}>
                    {badge.label}
                  </span>
                  {isLive && (
                    <span className="text-xs font-bold font-body border border-orange text-orange rounded px-2 py-0.5">
                      LIVE
                    </span>
                  )}
                </div>
                <p className="text-muted font-body text-xs mb-2">{timeAgo(post.created_at)}</p>
                <p className="font-body">{post.body}</p>
              </Link>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
