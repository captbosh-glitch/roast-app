import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('Failed to load profile:', error)
      alert(`Couldn't load your profile: ${error.message}`)
      return
    }
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    // Phase 1: every new user auto-joins the one shared test group,
    // seeded in schema.sql, so the feed has real shared content before
    // the full Groups UI (join/create) exists.
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('invite_code', 'ROAST-BETA1')
      .single()

    if (groupError) {
      // Surface this clearly rather than silently inserting a NULL
      // group_id -- that previously caused a user's own profile to
      // become permanently invisible to themselves (NULL never equals
      // NULL in a group_id-matching RLS policy).
      return { error: { message: `Couldn't find the test group: ${groupError.message}` } }
    }

    const defaultScreenName = email.split('@')[0]

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      screen_name: defaultScreenName,
      group_id: group.id,
    })

    if (profileError) return { error: profileError }
    return { data }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updateProfile(updates) {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
    if (!error) await loadProfile(user.id)
    return { error }
  }

  const value = { user, profile, loading, signUp, signIn, signOut, updateProfile }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
