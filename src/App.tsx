/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserWarning } from './UserWarning';
import {
  USER_ID,
  getTodos,
  createTodo,
  deleteTodo,
  updateTodo,
} from './api/todos';
import { Todo } from './types/Todo';

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState('all');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [loadingTodosIds, setLoadingTodosIds] = useState<number[]>([]);

  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const newTodoInputRef = useRef<HTMLInputElement>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout>();

  const showError = useCallback((message: string) => {
    setErrorMessage(message);

    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }

    errorTimeoutRef.current = setTimeout(() => setErrorMessage(''), 3000);
  }, []);

  const hideError = useCallback(() => {
    setErrorMessage('');
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
  }, []);

  const focusInput = useCallback(() => {
    if (newTodoInputRef.current) {
      newTodoInputRef.current.focus();
    }
  }, []);

  const handleDeleteTodo = useCallback(async (id: number) => {
    setLoadingTodosIds(prev => [...prev, id]);

    try {
      await deleteTodo(id);
      setTodos(prev => prev.filter(todo => todo.id !== id));
      focusInput();
    } catch {
      showError('Unable to delete a todo');
    } finally {
      setLoadingTodosIds(prev => prev.filter(todoId => todoId !== id));
    }
  }, [focusInput, showError]);

  const handleStartEditing = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditingTitle(todo.title);
  };

  const handleSaveEdit = async (id: number) => {
    const trimmedTitle = editingTitle.trim();

    if (!trimmedTitle) {
      await handleDeleteTodo(id);
      setEditingTodoId(null);
      return;
    }

    const originalTodo = todos.find(todo => todo.id === id);
    if (trimmedTitle === originalTodo?.title) {
      setEditingTodoId(null);
      return;
    }

    setLoadingTodosIds(prev => [...prev, id]);

    try {
      const updatedTodo = await updateTodo(id, { title: trimmedTitle });
      setTodos(prev => prev.map(todo => (todo.id === id ? updatedTodo : todo)));
      setEditingTodoId(null);
    } catch {
      showError('Unable to update a todo');
    } finally {
      setLoadingTodosIds(prev => prev.filter(todoId => todoId !== id));
    }
  };

  const handleCancelEdit = () => {
    setEditingTodoId(null);
    setEditingTitle('');
  };

  const handleEditKeyPress = (event: React.KeyboardEvent, id: number) => {
    if (event.key === 'Enter') {
      handleSaveEdit(id);
    } else if (event.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleAddTodo = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      const trimmedTitle = newTodoTitle.trim();

      if (!trimmedTitle) {
        showError('Title should not be empty');
        focusInput();
        return;
      }

      const tempTodoData: Todo = {
        id: 0,
        userId: USER_ID,
        title: trimmedTitle,
        completed: false,
      };

      setTempTodo(tempTodoData);
      setNewTodoTitle('');

      try {
        const createdTodo = await createTodo({
          title: trimmedTitle,
          userId: USER_ID,
          completed: false,
        });

        setTodos(prev => [...prev, createdTodo]);
      } catch (error) {
        showError('Unable to add a todo');
        setNewTodoTitle(trimmedTitle);
      } finally {
        setTempTodo(null);
        focusInput();
      }
    },
    [newTodoTitle, focusInput, showError],
  );

  const handleToggleTodo = useCallback(
    async (id: number, completed: boolean) => {
      setLoadingTodosIds(prev => [...prev, id]);

      try {
        const updatedTodo = await updateTodo(id, { completed: !completed });
        setTodos(prev =>
          prev.map(todo => (todo.id === id ? updatedTodo : todo)),
        );
      } catch {
        showError('Unable to update a todo');
      } finally {
        setLoadingTodosIds(prev => prev.filter(todoId => todoId !== id));
      }
    },
    [showError],
  );

  const handleToggleAll = useCallback(async () => {
    const allCompleted = todos.length > 0 && todos.every(todo => todo.completed);
    const todosToUpdate = allCompleted
      ? todos.filter(todo => todo.completed)
      : todos.filter(todo => !todo.completed);

    if (todosToUpdate.length === 0) return;

    setLoadingTodosIds(prev => [
      ...prev,
      ...todosToUpdate.map(todo => todo.id),
    ]);

    try {
      const updatePromises = todosToUpdate.map(todo =>
        updateTodo(todo.id, { completed: !allCompleted }),
      );

      const updatedTodos = await Promise.all(updatePromises);

      setTodos(prev =>
        prev.map(todo => {
          const updatedTodo = updatedTodos.find(t => t.id === todo.id);
          return updatedTodo || todo;
        }),
      );
    } catch {
      showError('Unable to update todos');
    } finally {
      setLoadingTodosIds(prev =>
        prev.filter(id => !todosToUpdate.some(todo => todo.id === id)),
      );
    }
  }, [todos, showError]);

  const handleClearCompleted = useCallback(async () => {
    const completedTodos = todos.filter(todo => todo.completed);

    if (completedTodos.length === 0) return;

    setLoadingTodosIds(prev => [
      ...prev,
      ...completedTodos.map(todo => todo.id),
    ]);

    try {
      const deletePromises = completedTodos.map(todo => deleteTodo(todo.id));
      await Promise.all(deletePromises);
      setTodos(prev => prev.filter(todo => !todo.completed));
      focusInput();
    } catch {
      showError('Unable to delete completed todos');
    } finally {
      setLoadingTodosIds(prev =>
        prev.filter(id => !completedTodos.some(todo => todo.id === id)),
      );
    }
  }, [todos, focusInput, showError]);

  useEffect(() => {
    setIsLoading(true);
    getTodos()
      .then((loadedTodos: Todo[]) => {
        setTodos(loadedTodos || []);
      })
      .catch(() => {
        showError('Unable to load todos');
      })
      .finally(() => {
        setIsLoading(false);
        focusInput();
      });
  }, [focusInput, showError]);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  if (!USER_ID) {
    return <UserWarning />;
  }

  const filteredTodos = todos.filter(todo => {
    switch (filter) {
      case 'active':
        return !todo.completed;
      case 'completed':
        return todo.completed;
      default:
        return true;
    }
  });

  const activeTodosCount = todos.filter(todo => !todo.completed).length;
  const completedTodosCount = todos.filter(todo => todo.completed).length;
  const isAllCompleted = todos.length > 0 && todos.every(todo => todo.completed);

  const shouldShowFooter = todos.length > 0;

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {todos.length > 0 && (
            <button
              type="button"
              className={`todoapp__toggle-all ${isAllCompleted ? 'active' : ''}`}
              data-cy="ToggleAllButton"
              onClick={handleToggleAll}
            />
          )}

          <form onSubmit={handleAddTodo}>
            <input
              ref={newTodoInputRef}
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={newTodoTitle}
              onChange={e => setNewTodoTitle(e.target.value)}
              disabled={!!tempTodo}
            />
          </form>
        </header>

        <section className="todoapp__main" data-cy="TodoList">
          {isLoading && todos.length === 0 && (
            <div data-cy="TodoLoader" className="modal overlay is-active">
              <div className="modal-background has-background-white-ter" />
              <div className="loader" />
            </div>
          )}

          {filteredTodos.map(todo => {
            const isTodoLoading = loadingTodosIds.includes(todo.id);
            const isEditing = editingTodoId === todo.id;

            return (
              <div
                key={todo.id}
                data-cy="Todo"
                className={`todo ${todo.completed ? 'completed' : ''} ${isEditing ? 'editing' : ''}`}
              >
                <label className="todo__status-label">
                  <input
                    data-cy="TodoStatus"
                    type="checkbox"
                    className="todo__status"
                    checked={todo.completed}
                    onChange={() =>
                      handleToggleTodo(todo.id, todo.completed)
                    }
                    disabled={isTodoLoading}
                  />
                </label>

                {isEditing ? (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      handleSaveEdit(todo.id);
                    }}
                    onBlur={() => handleSaveEdit(todo.id)}
                  >
                    <input
                      data-cy="TodoTitleField"
                      type="text"
                      className="todo__title-field"
                      placeholder="Empty todo will be deleted"
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={e => handleEditKeyPress(e, todo.id)}
                      autoFocus
                    />
                  </form>
                ) : (
                  <>
                    <span
                      data-cy="TodoTitle"
                      className="todo__title"
                      onDoubleClick={() => handleStartEditing(todo)}
                    >
                      {todo.title}
                    </span>

                    <button
                      type="button"
                      className="todo__remove"
                      data-cy="TodoDelete"
                      onClick={() => handleDeleteTodo(todo.id)}
                      disabled={isTodoLoading}
                    >
                      ×
                    </button>
                  </>
                )}

                <div
                  data-cy="TodoLoader"
                  className={`modal overlay ${isTodoLoading ? 'is-active' : ''}`}
                >
                  <div className="modal-background has-background-white-ter" />
                  <div className="loader" />
                </div>
              </div>
            );
          })}

          {tempTodo && (
            <div data-cy="Todo" className="todo">
              <label className="todo__status-label">
                <input
                  data-cy="TodoStatus"
                  type="checkbox"
                  className="todo__status"
                  checked={false}
                  disabled
                />
              </label>
              <span data-cy="TodoTitle" className="todo__title">
                {tempTodo.title}
              </span>
              <button
                type="button"
                className="todo__remove"
                data-cy="TodoDelete"
                disabled
              >
                ×
              </button>
              <div data-cy="TodoLoader" className="modal overlay is-active">
                <div className="modal-background has-background-white-ter" />
                <div className="loader" />
              </div>
            </div>
          )}
        </section>

        {shouldShowFooter && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span className="todo-count" data-cy="TodosCounter">
              {activeTodosCount} item{activeTodosCount !== 1 ? 's' : ''} left
            </span>

            <nav className="filter" data-cy="Filter">
              <a
                href="#/"
                className={`filter__link ${filter === 'all' ? 'selected' : ''}`}
                data-cy="FilterLinkAll"
                onClick={e => {
                  e.preventDefault();
                  setFilter('all');
                }}
              >
                All
              </a>

              <a
                href="#/active"
                className={`filter__link ${filter === 'active' ? 'selected' : ''}`}
                data-cy="FilterLinkActive"
                onClick={e => {
                  e.preventDefault();
                  setFilter('active');
                }}
              >
                Active
              </a>

              <a
                href="#/completed"
                className={`filter__link ${filter === 'completed' ? 'selected' : ''}`}
                data-cy="FilterLinkCompleted"
                onClick={e => {
                  e.preventDefault();
                  setFilter('completed');
                }}
              >
                Completed
              </a>
            </nav>

            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              disabled={completedTodosCount === 0}
              onClick={handleClearCompleted}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <div
        data-cy="ErrorNotification"
        className={`notification is-danger is-light has-text-weight-normal ${errorMessage ? '' : 'hidden'}`}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={hideError}
        />
        {errorMessage}
      </div>
    </div>
  );
};
