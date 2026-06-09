import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import s from './Layout.module.css'

const nav = [
  { to: '/',         label: 'Dashboard',        icon: '▲' },
  { to: '/update',   label: 'Update balances',  icon: '✎' },
  { to: '/income',   label: 'Income',           icon: '+' },
  { to: '/accounts', label: 'Accounts',         icon: '◈' },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className={s.shell}>
      <nav className={s.sidebar}>
        <div className={s.logo}>money</div>
        {nav.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `${s.item} ${isActive ? s.active : ''}`}
          >
            <span className={s.icon}>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <div className={s.bottom}>
          <span className={s.email}>{user?.email}</span>
          <button className={s.logout} onClick={logout}>Sign out</button>
        </div>
      </nav>
      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  )
}
