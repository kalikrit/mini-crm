import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

const statusLabels: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке'
};

export function ObjectDetail() {
  const { id } = useParams();
  const { role } = useAuth();
  
  const [object, setObject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [executors, setExecutors] = useState<any[]>([]);
  
  // Стейты для формы
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    // 1. Получаем объект
    const { data: objData } = await supabase.from('objects').select('*').eq('id', id).single();
    setObject(objData);

    // 2. Получаем задачи (RLS отфильтрует чужие, если мы исполнитель)
    const { data: tasksData } = await supabase.from('tasks').select('*').eq('object_id', id).is('deleted_at', null).order('created_at', { ascending: false });
    setTasks(tasksData || []);

    // 3. Если мы постановщик, нам нужен список исполнителей для назначения
    if (role === 'setter') {
      // ВАЖНО: для теста мы просто берем всех, у кого роль executor из profiles
      const { data: execs } = await supabase.from('profiles').select('id, role').eq('role', 'executor');
      setExecutors(execs || []);
      if (execs && execs.length > 0 && !assigneeId) setAssigneeId(execs[0].id);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id, role]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('tasks').insert({
      title,
      description,
      object_id: id,
      assignee_id: assigneeId,
      author_id: user.id,
      status: 'new'
    });

    setTitle('');
    setDescription('');
    fetchData();
  };

  if (loading) return <p>Загрузка...</p>;
  if (!object) return <p>Объект не найден или у вас нет доступа.</p>;

  return (
    <div>
      <Link to="/objects" style={{ color: '#0066cc' }}>&larr; Назад к объектам</Link>
      <h2 style={{ marginTop: '10px' }}>{object.title}</h2>
      <p style={{ color: '#666' }}>{object.address}</p>

      {role === 'setter' && (
        <form onSubmit={handleCreateTask} style={{ margin: '20px 0', padding: '15px', background: '#fff', borderRadius: '5px', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0 }}>Создать задачу</h3>
          <div style={{ display: 'flex', gap: '10px', flexDirection: 'column', maxWidth: '400px' }}>
            <input placeholder="Название задачи" value={title} onChange={e => setTitle(e.target.value)} required style={{ padding: 5 }} />
            <textarea placeholder="Описание" value={description} onChange={e => setDescription(e.target.value)} style={{ padding: 5, minHeight: '60px' }} />
            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} required style={{ padding: 5 }}>
              <option value="" disabled>Выберите исполнителя</option>
              {executors.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.id.slice(0, 8)}... (Исполнитель)</option>
              ))}
            </select>
            <button type="submit" style={{ padding: '8px', background: '#28a745', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '3px' }}>
              Создать задачу
            </button>
          </div>
        </form>
      )}

      <h3>Задачи ({tasks.length})</h3>
      {tasks.length === 0 ? (
        <p>Задач пока нет.</p>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {tasks.map(task => (
            <div key={task.id} style={{ background: '#fff', padding: '15px', borderRadius: '5px', border: '1px solid #ddd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link to={`/tasks/${task.id}`} style={{ fontWeight: 'bold', color: '#0066cc', textDecoration: 'none', fontSize: '16px' }}>
                  {task.title}
                </Link>
                <span style={{ fontSize: '12px', background: '#eee', padding: '3px 8px', borderRadius: '10px' }}>
                  {statusLabels[task.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}