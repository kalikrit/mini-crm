import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function Layout() {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#222', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <h3 style={{ margin: 0 }}>СтройКонтроль</h3>
          <Link to="/objects" style={{ color: '#fff', textDecoration: 'none', alignSelf: 'center' }}>Объекты</Link>
          {role === 'executor' && (
            <Link to="/my-tasks" style={{ color: '#fff', textDecoration: 'none', alignSelf: 'center' }}>Мои задачи</Link>
          )}
        </div>
        <div>
          <span style={{ marginRight: '15px', fontSize: '14px', color: '#aaa' }}>Роль: {role === 'setter' ? 'Постановщик' : 'Исполнитель'}</span>
          <button onClick={handleLogout} style={{ padding: '5px 10px', cursor: 'pointer' }}>Выйти</button>
        </div>
      </header>
      <main style={{ padding: '20px', flex: 1, background: '#f5f5f5' }}>
        <Outlet /> {/* Сюда будут рендериться страницы */}
      </main>
    </div>
  );
}