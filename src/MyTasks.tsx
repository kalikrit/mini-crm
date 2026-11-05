import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

const statusLabels: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке'
};

export function MyTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyTasks = async () => {
      // RLS автоматически вернет только те задачи, где мы assignee
      const { data } = await supabase
        .from('tasks')
        .select('*, objects(title)') // Подтягиваем название объекта
        .order('created_at', { ascending: false });
      
      if (data) setTasks(data);
      setLoading(false);
    };
    
    fetchMyTasks();
  }, []);

  if (loading) return <p>Загрузка...</p>;

  return (
    <div>
      <h2>Мои задачи</h2>
      {tasks.length === 0 ? (
        <p>У вас пока нет задач.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '10px' }}>
          {tasks.map(task => (
            <li key={task.id} style={{ background: '#fff', padding: '15px', borderRadius: '5px', border: '1px solid #ddd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Link to={`/tasks/${task.id}`} style={{ fontWeight: 'bold', color: '#0066cc', textDecoration: 'none', fontSize: '16px' }}>
                    {task.title}
                  </Link>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    Объект: {task.objects?.title || 'Неизвестно'}
                  </div>
                </div>
                <span style={{ fontSize: '12px', background: '#eee', padding: '3px 8px', borderRadius: '10px' }}>
                  {statusLabels[task.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}