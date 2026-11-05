-- 1. Удаляем таблицы, если они были созданы ранее
drop table if exists public.task_history cascade;
drop table if exists public.tasks cascade;
drop table if exists public.objects cascade;
drop table if exists public.profiles cascade;

-- 2. Создаем таблицу профилей (ролей)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text check (role in ('setter', 'executor')) not null
);

-- 3. Создаем таблицу объектов (с мягким удалением)
create table public.objects (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  address text not null,
  created_by uuid references auth.users not null,
  created_at timestamptz default now(),
  deleted_at timestamptz -- Для мягкого удаления
);

-- 4. Создаем таблицу задач (с мягким удалением)
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  object_id uuid references public.objects not null,
  assignee_id uuid references auth.users not null,
  author_id uuid references auth.users not null,
  status text check (status in ('new', 'in_progress', 'review', 'accepted', 'rework')) default 'new' not null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

-- 5. Создаем таблицу истории
create table public.task_history (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks on delete cascade not null,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users not null,
  comment text,
  created_at timestamptz default now()
);

-- ВКЛЮЧАЕМ RLS НА ВСЕХ ТАБЛИЦАХ
alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

-- Вспомогательная функция для проверки роли
create or replace function public.is_setter()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'setter'
  );
$$ language sql security definer;

-- ВЫДАЕМ БАЗОВЫЕ ПРАВА РОЛИ AUTHENTICATED
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_history TO authenticated;

-- ПОЛИТИКИ ДЛЯ ПРОФИЛЕЙ
create policy "Users can view own profile or setters view all"
  on public.profiles for select
  using (auth.uid() = id or public.is_setter());

-- ПОЛИТИКИ ДЛЯ ОБЪЕКТОВ
-- Постановщик видит все (включая мягко удаленные)
create policy "Setters can view all objects"
  on public.objects for select
  using (public.is_setter());

-- Исполнитель видит только активные объекты, где у него есть активные задачи
create policy "Executors can view objects with their tasks"
  on public.objects for select
  using (
    not public.is_setter() and deleted_at is null and exists (
      select 1 from public.tasks
      where tasks.object_id = objects.id
      and tasks.assignee_id = auth.uid()
      and tasks.deleted_at is null
    )
  );

create policy "Setters can insert objects" on public.objects for insert with check (public.is_setter());
create policy "Setters can update objects" on public.objects for update using (public.is_setter()) with check (public.is_setter());

-- ПОЛИТИКИ ДЛЯ ЗАДАЧ
-- Постановщик видит все задачи (включая мягко удаленные)
create policy "Setters can view all tasks"
  on public.tasks for select
  using (public.is_setter());

-- Исполнитель видит только свои активные задачи
create policy "Executors can view own tasks"
  on public.tasks for select
  using (not public.is_setter() and assignee_id = auth.uid() and deleted_at is null);

create policy "Setters can insert tasks" on public.tasks for insert with check (public.is_setter());
create policy "Setters can update tasks" on public.tasks for update using (public.is_setter()) with check (public.is_setter());

-- ПОЛИТИКИ ДЛЯ ИСТОРИИ
create policy "Users can view history of visible tasks"
  on public.task_history for select
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = task_history.task_id
      and (
        (public.is_setter()) or -- Сеттер видит историю всех задач (даже если задача удалена)
        (not public.is_setter() and tasks.assignee_id = auth.uid() and tasks.deleted_at is null)
      )
    )
  );
-- Запрещаем любые изменения истории напрямую из API
create policy "No direct insert to history" on public.task_history for insert with check (false);
create policy "No update to history" on public.task_history for update using (false);
create policy "No delete to history" on public.task_history for delete using (false);

-- RPC ФУНКЦИЯ ДЛЯ СМЕНЫ СТАТУСА
create or replace function public.transition_task(
  p_task_id uuid,
  p_new_status text,
  p_comment text default null
) returns public.tasks as $$
declare
  v_task public.tasks;
  v_role text;
  v_allowed boolean := false;
begin
  select role into v_role from public.profiles where id = auth.uid();
  select * into v_task from public.tasks where id = p_task_id and deleted_at is null;
  
  if v_task is null then
    raise exception 'Задача не найдена или удалена';
  end if;

  if v_task.status = 'new' and p_new_status = 'in_progress' and v_role = 'executor' and v_task.assignee_id = auth.uid() then
    v_allowed := true;
  elsif v_task.status = 'in_progress' and p_new_status = 'review' and v_role = 'executor' and v_task.assignee_id = auth.uid() then
    v_allowed := true;
  elsif v_task.status = 'review' and p_new_status = 'accepted' and v_role = 'setter' then
    v_allowed := true;
  elsif v_task.status = 'review' and p_new_status = 'rework' and v_role = 'setter' then
    if p_comment is null or trim(p_comment) = '' then
      raise exception 'Комментарий обязателен при возврате на доработку';
    end if;
    v_allowed := true;
  elsif v_task.status = 'rework' and p_new_status = 'in_progress' and v_role = 'executor' and v_task.assignee_id = auth.uid() then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'Недопустимый переход статуса для вашей роли';
  end if;

  insert into public.task_history (task_id, from_status, to_status, changed_by, comment)
  values (p_task_id, v_task.status, p_new_status, auth.uid(), p_comment);

  update public.tasks
  set status = p_new_status
  where id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$ language plpgsql security definer;

GRANT EXECUTE ON FUNCTION public.transition_task TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_setter TO authenticated;

-- ВСТАВКА ТЕСТОВЫХ ПОЛЬЗОВАТЕЛЕЙ (твои реальные UUID)
insert into public.profiles (id, role) values
  ('2e77d364-2bb4-49bc-aa5b-24f8dfff5614', 'setter'),
  ('340afe54-50b1-43b0-a1e0-d926cb85658c', 'executor'),
  ('1a7b5db5-38fc-4f21-a9c5-d4bafd9335a4', 'executor')
on conflict (id) do update set role = excluded.role;

-- ТЕСТОВЫЕ ДАННЫЕ
do $$
declare
  v_setter uuid := '2e77d364-2bb4-49bc-aa5b-24f8dfff5614';
  v_exec1 uuid := '340afe54-50b1-43b0-a1e0-d926cb85658c';
  v_exec2 uuid := '1a7b5db5-38fc-4f21-a9c5-d4bafd9335a4';
  v_obj1 uuid;
  v_obj2 uuid;
  v_task1 uuid;
  v_task2 uuid;
begin
  insert into public.objects (title, address, created_by) values ('ЖК Солнечный', 'ул. Ленина, 10', v_setter) returning id into v_obj1;
  insert into public.objects (title, address, created_by) values ('ТЦ Галерея', 'пр. Мира, 5', v_setter) returning id into v_obj2;

  insert into public.tasks (title, description, object_id, assignee_id, author_id, status) values 
    ('Залить фундамент', 'Бетон М300', v_obj1, v_exec1, v_setter, 'new') returning id into v_task1;
    
  insert into public.tasks (title, description, object_id, assignee_id, author_id, status) values 
    ('Проверить проводку', 'Щиток на 3 этаже', v_obj1, v_exec2, v_setter, 'in_progress') returning id into v_task2;

  insert into public.task_history (task_id, from_status, to_status, changed_by) values 
    (v_task2, 'new', 'in_progress', v_exec2);
end $$;