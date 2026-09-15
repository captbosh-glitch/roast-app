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

    // Record real membership for this initial default-group assignment
    // too -- without this, a brand new user's profile.group_id would
    // correctly point at the default group, but they'd show as a
    // member of zero groups in the group-switcher UI.
    const { error: membershipError } = await supabase
      .from('group_memberships')
      .insert({ user_id: data.user.id, group_id: group.id })
    if (membershipError) return { error: membershipError }

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

  // Joining a group (by invite code or after creating one) adds real
  // membership and makes it your active group in one step.
  async function joinGroup(groupId) {
    const { error } = await supabase.rpc('join_group', { target_group_id: groupId })
    if (!error) await loadProfile(user.id)
    return { error }
  }

  // Switching your active group among ones you're already a member of
  // -- doesn't touch membership, just which group is currently active.
  async function switchActiveGroup(groupId) {
    const { error } = await supabase.rpc('switch_active_group', { target_group_id: groupId })
    if (!error) await loadProfile(user.id)
    return { error }
  }

  // Leaving a group removes membership entirely. If it was your active
  // group, the database automatically switches you to another group
  // you still belong to (or the default group if that was your last one).
  async function leaveGroup(groupId) {
    const { error } = await supabase.rpc('leave_group', { target_group_id: groupId })
    if (!error) await loadProfile(user.id)
    return { error }
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    joinGroup,
    switchActiveGroup,
    leaveGroup,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
