import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

export default function Messages({ user, darkMode }) {
  const dm = darkMode
  const [msgs, setMsgs] = useState([])
  const [listingTitles, setListingTitles] = useState({})
  const [selected, setSelected] = useState(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)
  const channelRef = useRef(null)
  const selectedRef = useRef(null)

  // Keep ref in sync so the realtime callback can read it
  useEffect(() => { selectedRef.current = selected }, [selected])

  useEffect(() => {
    loadMessages()

    channelRef.current = supabase
      .channel(`msgs-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new
        if (m.sender_id !== user.id && m.recipient_id !== user.id) return
        setMsgs(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m])
        // Auto-mark read if viewing this thread
        const sel = selectedRef.current
        if (sel && m.recipient_id === user.id && m.listing_id === sel.listing_id &&
            (m.sender_id === sel.other_id)) {
          supabase.from('messages').update({ read: true }).eq('id', m.id)
          setMsgs(prev => prev.map(x => x.id === m.id ? { ...x, read: true } : x))
        }
      })
      .subscribe()

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [user.id])

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [selected?.key, msgs.length])

  const loadMessages = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setMsgs(data)
      const ids = [...new Set(data.map(m => m.listing_id).filter(Boolean))]
      if (ids.length > 0) {
        const { data: ld } = await supabase.from('listings').select('id, title').in('id', ids)
        if (ld) {
          const map = {}
          ld.forEach(l => { map[l.id] = l.title })
          setListingTitles(map)
        }
      }
    }
    setLoading(false)
  }

  // Group into conversations: key = listing_id + other_person_id
  const conversations = (() => {
    const groups = {}
    for (const msg of msgs) {
      const isMe = msg.sender_id === user.id
      const otherId = isMe ? msg.recipient_id : msg.sender_id
      const otherEmail = isMe ? msg.recipient_email : msg.sender_email
      const key = `${msg.listing_id}__${otherId}`
      if (!groups[key]) groups[key] = { key, listing_id: msg.listing_id, other_id: otherId, other_email: otherEmail, messages: [], unread: 0 }
      groups[key].messages.push(msg)
      if (!msg.read && msg.recipient_id === user.id) groups[key].unread++
    }
    return Object.values(groups).sort((a, b) => {
      const al = a.messages.at(-1)?.created_at || ''
      const bl = b.messages.at(-1)?.created_at || ''
      return bl.localeCompare(al)
    })
  })()

  const threadMsgs = selected
    ? msgs.filter(m => m.listing_id === selected.listing_id &&
        (m.sender_id === selected.other_id || m.recipient_id === selected.other_id))
    : []

  const openConversation = async (conv) => {
    setSelected(conv)
    setReply('')
    const unreadIds = conv.messages.filter(m => !m.read && m.recipient_id === user.id).map(m => m.id)
    if (unreadIds.length > 0) {
      await supabase.from('messages').update({ read: true }).in('id', unreadIds)
      setMsgs(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, read: true } : m))
    }
  }

  const sendReply = async () => {
    if (!reply.trim() || !selected || sending) return
    setSending(true)
    const { data, error } = await supabase.from('messages').insert([{
      listing_id: selected.listing_id,
      sender_id: user.id,
      recipient_id: selected.other_id,
      sender_email: user.email,
      recipient_email: selected.other_email,
      content: reply.trim(),
      read: false,
    }]).select().single()
    if (!error && data) { setMsgs(prev => [...prev, data]); setReply('') }
    setSending(false)
  }

  const fmt = (ts) => {
    if (!ts) return ''
    const d = new Date(ts), now = new Date(), diff = now - d
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const panelBg = dm ? '#1c1c1e' : '#fff'
  const mainBg = dm ? '#0f0f11' : '#f5f5f7'
  const tp = dm ? '#f5f5f7' : '#1d1d1f'
  const ts = dm ? '#8e8e93' : '#6e6e73'
  const border = dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'

  if (loading) return (
    <div style={{ display: 'flex', height: 'calc(100vh - 0px)', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${border}`, background: panelBg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 14px', borderBottom: `1px solid ${border}` }}>
          <div style={{ height: 20, width: 120, borderRadius: 6, background: dm ? '#2c2c2e' : '#f0f0f0', marginBottom: 8 }} />
          <div style={{ height: 14, width: 80, borderRadius: 6, background: dm ? '#2c2c2e' : '#f0f0f0' }} />
        </div>
        {[1,2,3].map(n => (
          <div key={n} style={{ padding: '13px 16px', borderBottom: `1px solid ${border}` }}>
            <div style={{ height: 14, width: '70%', borderRadius: 6, background: dm ? '#2c2c2e' : '#f0f0f0', marginBottom: 8 }} />
            <div style={{ height: 12, width: '50%', borderRadius: 6, background: dm ? '#2c2c2e' : '#f0f0f0', marginBottom: 6 }} />
            <div style={{ height: 12, width: '80%', borderRadius: 6, background: dm ? '#2c2c2e' : '#f0f0f0' }} />
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: mainBg }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${dm ? '#FFCB05' : '#00274C'}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 0px)', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>

      {/* ── CONVERSATION LIST ── */}
      <div style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${border}`, overflowY: 'auto', background: panelBg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 14px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: tp, letterSpacing: '-0.02em' }}>Messages</div>
          <div style={{ fontSize: 12, color: ts, marginTop: 2 }}>{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</div>
        </div>

        {conversations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: ts, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,39,76,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 28 }}>✉️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: tp, marginBottom: 8, letterSpacing: '-0.01em' }}>No messages yet</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: ts }}>Browse listings and reach out to find your perfect sublease.</div>
          </div>
        ) : (
          conversations.map(conv => {
            const last = conv.messages.at(-1)
            const isSel = selected?.key === conv.key
            return (
              <div key={conv.key} onClick={() => openConversation(conv)} style={{ padding: '13px 16px', cursor: 'pointer', background: isSel ? (dm ? 'rgba(255,203,5,0.07)' : 'rgba(0,39,76,0.04)') : 'transparent', borderBottom: `1px solid ${border}`, borderLeft: `3px solid ${isSel ? '#FFCB05' : 'transparent'}`, transition: 'all 0.12s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tp, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 6 }}>
                    {listingTitles[conv.listing_id] || 'Listing'}
                  </div>
                  <div style={{ fontSize: 10, color: ts, flexShrink: 0 }}>{fmt(last?.created_at)}</div>
                </div>
                <div style={{ fontSize: 11, color: ts, marginBottom: 4 }}>{conv.other_email}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 12, color: conv.unread > 0 ? tp : ts, fontWeight: conv.unread > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {last?.sender_id === user.id ? 'You: ' : ''}{last?.content}
                  </div>
                  {conv.unread > 0 && (
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#00274C', color: '#FFCB05', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {conv.unread}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── THREAD VIEW ── */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: mainBg }}>
          {/* Header */}
          <div style={{ padding: '14px 24px', borderBottom: `1px solid ${border}`, background: panelBg, flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: tp }}>{listingTitles[selected.listing_id] || 'Listing'}</div>
            <div style={{ fontSize: 12, color: ts }}>Conversation with {selected.other_email}</div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {threadMsgs.map(msg => {
              const isMe = msg.sender_id === user.id
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ maxWidth: '68%' }}>
                    <div style={{ background: isMe ? '#00274C' : (dm ? '#2c2c2e' : '#fff'), color: isMe ? '#FFCB05' : tp, padding: '10px 14px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: 14, lineHeight: 1.55, border: isMe ? 'none' : `1px solid ${border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                      {msg.content}
                    </div>
                    <div style={{ fontSize: 10, color: ts, marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>{fmt(msg.created_at)}</div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply input */}
          <div style={{ padding: '14px 24px 20px', borderTop: `1px solid ${border}`, background: panelBg, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                placeholder="Type a message… (Enter to send)"
                rows={2}
                style={{ flex: 1, background: dm ? '#2c2c2e' : '#f5f5f7', border: `1.5px solid ${dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, fontFamily: 'Inter, sans-serif', color: tp, resize: 'none', outline: 'none', lineHeight: 1.5, transition: 'border-color 0.2s' }}
              />
              <button onClick={sendReply} disabled={!reply.trim() || sending} style={{ background: '#00274C', color: '#FFCB05', border: 'none', borderRadius: 980, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: !reply.trim() || sending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: !reply.trim() ? 0.5 : 1, transition: 'all 0.2s', height: 44 }}>
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: mainBg }}>
          <div style={{ textAlign: 'center', color: ts }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: dm ? 'rgba(255,255,255,0.05)' : 'rgba(0,39,76,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32 }}>💬</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: tp, marginBottom: 6, letterSpacing: '-0.01em' }}>Select a conversation</div>
            <div style={{ fontSize: 13, color: ts }}>Choose from the list to read messages</div>
          </div>
        </div>
      )}
    </div>
  )
}
