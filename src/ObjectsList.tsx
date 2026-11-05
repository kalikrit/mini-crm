import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

export function ObjectsList() {
  const { role } = useAuth();
  const [objects, setObjects] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchObjects = async () => {
    setLoading(true);
    // RLS автоматически вернет только те объекты, которые разрешены роли
    const { data } = await supabase.from('objects').select('*').is('deleted_at', null).order('created_at', { ascending: false });
    if (data) setObjects(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchObjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('objects').insert({ title, address, created_by: user.id });
    setTitle('');
    setAddress('');
    fetchObjects();
  };

  if (loading) return <p>Загрузка объектов...</p>;

  return (
    <div>
      <h2>Объекты</h2>
      
      {role === 'setter' && (
        <form onSubmit={handleCreate} style={{ marginBottom: '20px', padding: '15px', background: '#fff', borderRadius: '5px' }}>
          <h3 style={{ marginTop: 0 }}>Добавить объект</h3>
          <input placeholder="Название" value={title} onChange={e => setTitle(e.target.value)} required style={{ marginRight: 10, padding: 5 }} />
          <input placeholder="Адрес" value={address} onChange={e => setAddress(e.target.value)} required style={{ marginRight: 10, padding: 5 }} />
          <button type="submit" style={{ padding: '6px 12px' }}>Создать</button>
        </form>
      )}

      {objects.length === 0 ? (
        <p>Нет доступных объектов.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {objects.map(obj => (
            <li key={obj.id} style={{ background: '#fff', margin: '10px 0', padding: '15px', borderRadius: '5px', border: '1px solid #ddd' }}>
              <Link to={`/objects/${obj.id}`} style={{ fontSize: '18px', fontWeight: 'bold', color: '#0066cc', textDecoration: 'none' }}>
                {obj.title}
              </Link>
              <p style={{ margin: '5px 0 0', color: '#666' }}>{obj.address}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}