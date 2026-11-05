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

export function TaskDetail() {
  const { id } = useParams();
  const { role } = useAuth();
  
  const [task, setTask] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');

    // 1. Получаем саму задачу
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (taskError || !taskData) {
      setErrorMsg('Задача не найдена или у вас нет к ней доступа.');
      setLoading(false);
      return;
    }
    setTask(taskData);

    // 2. Получаем историю задачи
    const { data: historyData } = await supabase
      .from('task_history')
      .select('*')
      .eq('task_id', id)
      .order('created_at', { ascending: false });
      
    setHistory(historyData || []);
    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const handleTransition = async (newStatus: string) => {
    setErrorMsg('');
    // Вызываем нашу RPC-функцию в базе данных
    const { error } = await supabase.rpc('transition_task', {
      p_task_id: id,
      p_new_status: newStatus,
      p_comment: comment.trim() || null
    });

    if (error) {
      // Если база не пропустила (например, комментарий пустой), показываем ошибку
      alert('Ошибка перехода: ' + error.message);
    } else {
      setComment(''); // Очищаем поле комментария
      fetchData(); // Обновляем данные и историю
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить задачу? История сохранится в базе.')) return;
    
    // Мягкое удаление: просто ставим дату
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      alert('Ошибка удаления: ' + error.message);
    } else {
      // Возвращаемся на страницу объекта
      window.location.href = `/objects/${task.object_id}`;
    }
  };

  if (loading) return <p>Загрузка...</p>;
  if (errorMsg) return <p style={{ color: 'red' }}>{errorMsg}</p>;
  if (!task) return null;

  // Определяем, какие кнопки показать
  const canTakeToWork = (role === 'executor' && (task.status === 'new' || task.status === 'rework'));
  const canSendToReview = (role === 'executor' && task.status === 'in_progress');
  const canAcceptOrRework = (role === 'setter' && task.status === 'review');

  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', maxWidth: '800px' }}>
      <Link to={`/objects/${task.object_id}`} style={{ color: '#0066cc' }}>&larr; Назад к объекту</Link>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 10px 0' }}>{task.title}</h2>
          <p style={{ margin: 0, color: '#666' }}>{task.description || 'Нет описания'}</p>
        </div>
        <div style={{ background: '#eee', padding: '5px 12px', borderRadius: '15px', fontWeight: 'bold' }}>
          {statusLabels[task.status]}
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '5px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Действия</h4>
        
        {canTakeToWork && (
          <button onClick={() => handleTransition('in_progress')} style={{ padding: '8px 15px', background: '#f0ad4e', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
            Взять в работу
          </button>
        )}

        {canSendToReview && (
          <button onClick={() => handleTransition('review')} style={{ padding: '8px 15px', background: '#5bc0de', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
            Отправить на проверку
          </button>
        )}

        {canAcceptOrRework && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
            <input 
              type="text" 
              placeholder="Комментарий (обязателен для доработки)" 
              value={comment} 
              onChange={e => setComment(e.target.value)}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '3px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => handleTransition('accepted')} style={{ padding: '8px 15px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                Принять
              </button>
              <button onClick={() => handleTransition('rework')} style={{ padding: '8px 15px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                На доработку
              </button>
            </div>
          </div>
        )}

        {!canTakeToWork && !canSendToReview && !canAcceptOrRework && (
          <p style={{ margin: 0, color: '#888' }}>Нет доступных действий для вашей роли в текущем статусе.</p>
        )}
      </div>

      {role === 'setter' && (task.status === 'new' || task.status === 'rework') && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <button onClick={handleDelete} style={{ padding: '6px 12px', background: 'transparent', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '3px', cursor: 'pointer' }}>
            Удалить задачу
          </button>
        </div>
      )}

      <div style={{ marginTop: '30px' }}>
        <h3>История изменений</h3>
        {history.length === 0 ? (
          <p>История пуста.</p>
        ) : (
          <ul style={{ paddingLeft: '20px', color: '#444' }}>
            {history.map(record => (
              <li key={record.id} style={{ marginBottom: '10px' }}>
                <span style={{ fontWeight: 'bold' }}>{new Date(record.created_at).toLocaleString()}</span>: 
                переход из <span style={{ fontStyle: 'italic' }}>{statusLabels[record.from_status] || 'Начало'}</span> в 
                <span style={{ fontStyle: 'italic' }}> {statusLabels[record.to_status]}</span>
                {record.comment && <span style={{ color: '#dc3545' }}> (Комментарий: {record.comment})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}