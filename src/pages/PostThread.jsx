import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function PostThread() {
  const { postId } = useParams()
  const { user, profile } = useAuth()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: postData } = await supabase
      .from('feed_posts')
      .select('*, profiles(screen_name, avatar_url)')
      .eq('id', postId)
      .single()
    setPost(postData)

    const { data: commentData } = await supabase
      .from('feed_comments')
      .select('*, profiles(screen_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    setComments(commentData ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSubmitting(true)
    const { error } = await supabase.from('feed_comments').insert({
      post_id: postId,
      user_id: user.id,
      body: text.trim(),
    })
    setSubmitting(false)
    if (!error) {
      setText('')
      load()
    }
  }

  if (loading) {
    return (
      <Layout>
        <p className="text-muted font-body py-8">Loading...</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <Link to="/feed" className="text-orange font-body text-sm mb-4 inline-block">
        ‹‹ Back to feed
      </Link>

      {post && (
        <div className="border-b border-panel-border pb-5 mb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-orange flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
              {post.profiles?.avatar_url ? (
                <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (post.profiles?.screen_name ?? '?').slice(0, 2).toUpperCase()
              )}
            </div>
            <p className="font-body font-bold">{post.profiles?.screen_name}</p>
          </div>
          <p className="text-muted font-body text-xs mb-2">{timeAgo(post.created_at)}</p>
          <p className="font-body">{post.body}</p>
        </div>
      )}

      {comments.map((c) => (
        <div key={c.id} className="border-b border-panel-border py-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-panel border border-panel-border flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
              {c.profiles?.avatar_url ? (
                <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                (c.profiles?.screen_name ?? '?').slice(0, 2).toUpperCase()
              )}
            </div>
            <p className="font-body font-semibold text-sm">{c.profiles?.screen_name}</p>
            <p className="text-muted font-body text-xs">{timeAgo(c.created_at)}</p>
          </div>
          {c.body && <p className="font-body text-sm ml-11">{c.body}</p>}
        </div>
      ))}

      <form onSubmit={handleSubmit} className="mt-6">
        <p className="text-muted text-sm tracking-widest font-body font-semibold mb-2">
          LEAVE A COMMENT
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text"
          rows={3}
          className="w-full bg-panel border border-panel-border rounded-2xl px-5 py-4 text-white font-body mb-3 outline-none focus:border-orange resize-none"
        />
        {/* Image attachments on comments are a Phase 2 addition (needs a
            second Storage bucket + upload flow, same pattern as the
            Profile avatar upload). */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-orange text-white font-display text-lg py-4 rounded-2xl disabled:opacity-60"
        >
          {submitting ? 'POSTING...' : 'SUBMIT COMMENT'}
        </button>
      </form>
    </Layout>
  )
}
