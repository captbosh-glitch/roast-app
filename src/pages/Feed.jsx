import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const BADGE_STYLES = {
  GYM_FAIL: { label: 'GYM · FAIL', className: 'text-gym border-gym' },
  GYM_PR: { label: 'GYM · PR', className: 'text-green-400 border-green-500' },
  DRINK_LOG: { label: 'DRINK · LOG', className: 'text-drink border-drink' },
  DRINK_REGRET: { label: 'DRINK · REGRET', className: 'text-drink border-drink' },
  BOWL_STRIKE: { label: 'BOWL · STRIKE', className: 'text-bowling border-bowling' },
  BOWL_SPARE: { label: 'BOWL · SPARE', className: 'text-bowling border-bowling' },
  BOWL_GUTTER: { label: 'BOWL · GUTTER', className: 'text-gym border-gym' },
  BOWL_GAME: { label: 'BOWL · GAME', className: 'text-bowling border-bowling' },
  GOLF_GREAT: { label: 'GOLF · GREAT', className: 'text-golf border-golf' },
  GOLF_FAIL: { label: 'GOLF · FAIL', className: 'text-golf border-golf' },
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
  const { user, profile } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [newSinceVisit, setNewSinceVisit] = useState(0)
  // postId -> { count, likedByMe }
  const [likes, setLikes] = useState({})
  // postId -> count
  const [commentCounts, setCommentCounts] = useState({})

  // "New" means "posted since your last visit to this page" -- persisted
  // per-device via localStorage, so it stays meaningful even if those
  // posts loaded normally (not via a live real-time event) because you
  // simply hadn't looked at the feed yet. Captured once per mount so it
  // doesn't keep shifting forward as the session goes on. This must be
  // React state, not a ref -- a ref update wouldn't reliably trigger the
  // recompute effect below if posts happened to load first.
  const [lastVisitThreshold, setLastVisitThreshold] = useState(null)

  useEffect(() => {
    if (!user) return
    const storageKey = `roastapp_last_feed_view_${user.id}`
    const previousVisit = localStorage.getItem(storageKey)
    setLastVisitThreshold(previousVisit ? new Date(previousVisit) : new Date())
    localStorage.setItem(storageKey, new Date().toISOString())
  }, [user])

  useEffect(() => {
    if (!lastVisitThreshold) return
    const count = posts.filter((p) => new Date(p.created_at) > lastVisitThreshold).length
    setNewSinceVisit(count)
  }, [posts, lastVisitThreshold])

  async function loadEngagement(postIds) {
    if (postIds.length === 0) return

    const { data: likeRows } = await supabase
      .from('feed_likes')
      .select('post_id, user_id')
      .in('post_id', postIds)

    const likeMap = {}
    for (const row of likeRows ?? []) {
      if (!likeMap[row.post_id]) likeMap[row.post_id] = { count: 0, likedByMe: false }
      likeMap[row.post_id].count += 1
      if (row.user_id === user.id) likeMap[row.post_id].likedByMe = true
    }
    setLikes(likeMap)

    const { data: commentRows } = await supabase
      .from('feed_comments')
      .select('post_id')
      .in('post_id', postIds)

    const commentMap = {}
    for (const row of commentRows ?? []) {
      commentMap[row.post_id] = (commentMap[row.post_id] ?? 0) + 1
    }
    setCommentCounts(commentMap)
  }

  async function loadPosts() {
    const { data } = await supabase
      .from('feed_posts')
      .select('*, profiles(screen_name, avatar_url)')
      .eq('group_id', profile.group_id)
      .order('created_at', { ascending: false })
      .limit(30)
    const loaded = data ?? []
    setPosts(loaded)
    setLoading(false)
    loadEngagement(loaded.map((p) => p.id))
  }

  async function toggleRoast(postId, e) {
    e.preventDefault() // don't navigate to the thread when tapping the roast button
    const current = likes[postId] ?? { count: 0, likedByMe: false }

    if (current.likedByMe) {
      await supabase.from('feed_likes').delete().eq('post_id', postId).eq('user_id', user.id)
      setLikes((prev) => ({
        ...prev,
        [postId]: { count: Math.max(0, current.count - 1), likedByMe: false },
      }))
    } else {
      await supabase.from('feed_likes').insert({ post_id: postId, user_id: user.id })
      setLikes((prev) => ({
        ...prev,
        [postId]: { count: current.count + 1, likedByMe: true },
      }))
    }
  }

  useEffect(() => {
    if (!profile?.group_id) return
    loadPosts()

    // Real-time: new posts from anyone in the group appear instantly,
    // without needing to refresh -- this is what makes the "LIVE" badge
    // on very-recent posts actually true, not just decorative. It also
    // naturally counts toward "New" above, since these posts' created_at
    // will be after the visit threshold too.
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
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.group_id])

  const totalRoasts = Object.values(likes).reduce((sum, l) => sum + l.count, 0)

  return (
    <Layout>
      <p className="text-orange text-sm tracking-widest font-body font-semibold mt-4 mb-2">
        YOUR CREW&rsquo;S FINEST MOMENTS
      </p>
      <h1 className="font-display text-4xl text-orange mb-8">Live Feed</h1>

      <p className="font-display text-2xl text-orange mb-4">Feed Activity</p>
      <div className="flex gap-4 mb-6">
        <div className="border border-orange/50 rounded-2xl px-6 py-4 text-center flex-1">
          <p className="font-display text-3xl text-bowling">{posts.length}</p>
          <p className="text-muted font-body text-sm">Posts</p>
        </div>
        <div className="border border-orange/50 rounded-2xl px-6 py-4 text-center flex-1">
          <p className="font-display text-3xl text-drink">{newSinceVisit}</p>
          <p className="text-muted font-body text-sm">New</p>
        </div>
        <div className="border border-orange/50 rounded-2xl px-6 py-4 text-center flex-1">
          <p className="font-display text-3xl text-orange">{totalRoasts}</p>
          <p className="text-muted font-body text-sm">Roasts</p>
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
            const postLikes = likes[post.id] ?? { count: 0, likedByMe: false }
            const postComments = commentCounts[post.id] ?? 0

            return (
              <div key={post.id} className="border-b border-panel-border py-5">
                <Link to={`/feed/${post.id}`} className="block">
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
                  <p className="font-body mb-3">{post.body}</p>
                </Link>

                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => toggleRoast(post.id, e)}
                    className={`flex items-center gap-1.5 text-sm font-body font-semibold ${
                      postLikes.likedByMe ? 'text-orange' : 'text-muted'
                    }`}
                    aria-label={postLikes.likedByMe ? 'Remove roast' : 'Roast this'}
                  >
                    🔥 {postLikes.count} Roast{postLikes.count === 1 ? '' : 's'}
                  </button>
                  <Link
                    to={`/feed/${post.id}`}
                    className="flex items-center gap-1.5 text-sm font-body font-semibold text-muted"
                  >
                    💬 {postComments}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
