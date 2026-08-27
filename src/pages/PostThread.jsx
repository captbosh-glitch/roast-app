import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const KLIPY_API_KEY = import.meta.env.VITE_KLIPY_API_KEY

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

  // File upload (photo or a downloaded GIF from camera roll)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  // Klipy GIF search picker
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState('')
  const [selectedGifUrl, setSelectedGifUrl] = useState(null)

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

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedGifUrl(null) // file upload and GIF-picker selection are mutually exclusive
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setSelectedGifUrl(null)
  }

  // Debounced Klipy search-as-you-type, same pattern already used for
  // the group-name availability check.
  useEffect(() => {
    if (!showGifPicker || !gifQuery.trim()) {
      setGifResults([])
      return
    }
    if (!KLIPY_API_KEY) {
      setGifError('GIF search is not configured yet (missing VITE_KLIPY_API_KEY).')
      return
    }

    setGifLoading(true)
    setGifError('')
    const timeout = setTimeout(async () => {
      try {
        const url = `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/gifs/search?query=${encodeURIComponent(gifQuery)}&customer_id=${user.id}&per_page=12`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Klipy API returned ${res.status}`)
        const data = await res.json()
        // TEMP DEBUG -- remove once the correct Klipy response shape is
        // confirmed. Check the browser Console tab after searching.
        console.log('KLIPY REQUEST URL:', url)
        console.log('KLIPY RAW RESPONSE:', JSON.stringify(data, null, 2))
        // NOTE: response shape here is a best-effort guess based on
        // available documentation -- if this breaks, check the actual
        // response shape in your browser's Network tab against a live
        // Klipy account and adjust the mapping below.
        const items = data?.data?.data ?? data?.data ?? []
        setGifResults(items)
      } catch (err) {
        setGifError(`Couldn't load GIFs: ${err.message}`)
      } finally {
        setGifLoading(false)
      }
    }, 400)

    return () => clearTimeout(timeout)
  }, [gifQuery, showGifPicker, user.id])

  function selectGif(gifUrl) {
    setImageFile(null)
    setImagePreview(null)
    setSelectedGifUrl(gifUrl)
    setShowGifPicker(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim() && !imageFile && !selectedGifUrl) return

    setSubmitting(true)
    try {
      let finalImageUrl = selectedGifUrl

      if (imageFile) {
        const filePath = `${user.id}/${Date.now()}-${imageFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('comment-images')
          .upload(filePath, imageFile)
        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('comment-images').getPublicUrl(filePath)
        finalImageUrl = data.publicUrl
      }

      const { error } = await supabase.from('feed_comments').insert({
        post_id: postId,
        user_id: user.id,
        body: text.trim() || null,
        image_url: finalImageUrl,
      })
      if (error) throw error

      setText('')
      clearImage()
      load()
    } catch (err) {
      alert(`Couldn't post comment: ${err.message ?? err}`)
    } finally {
      setSubmitting(false)
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
          {c.body && <p className="font-body text-sm ml-11 mb-2">{c.body}</p>}
          {c.image_url && (
            <img
              src={c.image_url}
              alt=""
              className="ml-11 rounded-xl max-w-[240px] max-h-[240px] object-cover"
            />
          )}
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

        {(imagePreview || selectedGifUrl) && (
          <div className="relative inline-block mb-3">
            <img
              src={imagePreview || selectedGifUrl}
              alt="Attached"
              className="rounded-xl max-w-[160px] max-h-[160px] object-cover"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-2 -right-2 bg-black/80 text-white w-6 h-6 rounded-full text-sm"
              aria-label="Remove attachment"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex gap-4 mb-4">
          <label className="text-muted font-body text-sm cursor-pointer">
            📎 Attach Image
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>
          <button
            type="button"
            onClick={() => setShowGifPicker((v) => !v)}
            className="text-muted font-body text-sm"
          >
            🎬 Add GIF
          </button>
        </div>

        {showGifPicker && (
          <div className="bg-panel border border-panel-border rounded-2xl p-4 mb-4">
            <input
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              placeholder="Search GIFs..."
              autoFocus
              className="w-full bg-black/30 border border-panel-border rounded-xl px-4 py-3 text-white font-body mb-3 outline-none focus:border-orange"
            />
            {gifLoading && <p className="text-muted font-body text-sm">Searching...</p>}
            {gifError && <p className="text-red-400 font-body text-sm">{gifError}</p>}
            {!gifLoading && !gifError && gifResults.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {gifResults.map((gif, i) => {
                  // Best-effort field mapping -- adjust to match Klipy's
                  // actual response shape if this doesn't render correctly.
                  const thumbUrl =
                    gif?.file?.sm?.gif?.url ?? gif?.url ?? gif?.images?.preview_gif?.url
                  if (!thumbUrl) return null
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectGif(thumbUrl)}
                      className="rounded-lg overflow-hidden aspect-square"
                    >
                      <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

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
