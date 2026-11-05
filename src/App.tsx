import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Login } from './Login';
import { Layout } from './Layout';
import { ObjectsList } from './ObjectsList';
import { ObjectDetail } from './ObjectDetail';
import { TaskDetail } from './TaskDetail';
import { MyTasks } from './MyTasks';

function App() {
  const { session, loading } = useAuth();

  if (loading) return <div>Загрузка приложения...</div>;

  if (!session) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/objects" replace />} />
          <Route path="objects" element={<ObjectsList />} />
          <Route path="objects/:id" element={<ObjectDetail />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="my-tasks" element={<MyTasks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;