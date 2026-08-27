import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getUsers } from '../lib/api'

export default function LoginGate({ onLogin }) {
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [value, setValue] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)

  useEffect(() => {
    let active = true
    getUsers()
      .then((u) => {
        if (!active) return
        setUsers(u)
        if (u.length === 1) setSelected(u[0].id)
      })
      .catch(() => {
        if (active) setErr('Tidak bisa memuat daftar pengguna')
      })
      .finally(() => {
        if (active) setLoadingUsers(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function submit(e) {
    e.preventDefault()
    const pin = value.trim()
    if (!selected) {
      setErr('Pilih nama Anda')
      return
    }
    if (!pin) {
      setErr('Masukkan kode akses')
      return
    }
    setBusy(true)
    setErr('')
    try {
      await onLogin(selected, pin)
    } catch (errMsg) {
      setErr(errMsg.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="login-gate"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.form
        className="login-card"
        onSubmit={submit}
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <span className="logo logo-lg" aria-hidden="true">KK</span>
        <h1>Kedai Koko</h1>
        <p>Pilih nama Anda, lalu masukkan kode akses.</p>

        {loadingUsers ? (
          <div className="sk-line w80" style={{ height: 56 }} />
        ) : (
          <div className="user-grid">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                className={`user-option ${selected === u.id ? 'active' : ''}`}
                onClick={() => {
                  setSelected(u.id)
                  setErr('')
                }}
              >
                <span className="material-symbols-outlined">
                  {u.role === 'admin' ? 'admin_panel_settings' : 'point_of_sale'}
                </span>
                <span className="user-name">{u.name}</span>
                {u.role === 'admin' && <span className="user-role-badge">Admin</span>}
              </button>
            ))}
          </div>
        )}

        <input
          className="paid-input login-input"
          type="password"
          inputMode="text"
          autoFocus
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setErr('')
            setValue(e.target.value)
          }}
          placeholder="Kode akses"
          aria-label="Kode akses"
        />

        {err && <p className="form-error login-error">{err}</p>}

        <button type="submit" className="btn btn-primary login-btn" disabled={busy}>
          <span className="material-symbols-outlined">login</span>
          {busy ? 'Memeriksa...' : 'Masuk'}
        </button>
      </motion.form>
    </motion.div>
  )
}
