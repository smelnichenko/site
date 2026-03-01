import { useEffect, useState } from 'react';
import {
  AdminUser, AppGroup,
  fetchAdminUsers, fetchAdminGroups,
  setUserEnabled, setUserGroups,
  createGroup, updateGroup, deleteGroup,
} from '../services/api';

const ALL_PERMISSIONS = ['PLAY', 'CHAT', 'EMAIL', 'METRICS', 'MANAGE_USERS'];

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function Admin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<AppGroup[]>([]);
  const [tab, setTab] = useState<'users' | 'groups'>('users');
  const [error, setError] = useState('');

  // User group editing
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  // Group form
  const [groupForm, setGroupForm] = useState<{
    id: number | null;
    name: string;
    description: string;
    permissions: string[];
  } | null>(null);

  const load = async () => {
    try {
      const [u, g] = await Promise.all([fetchAdminUsers(), fetchAdminGroups()]);
      setUsers(u);
      setGroups(g);
    } catch {
      setError('Failed to load data');
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggleEnabled = async (user: AdminUser) => {
    setError('');
    try {
      await setUserEnabled(user.id, !user.enabled);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const startEditGroups = (user: AdminUser) => {
    setEditingUserId(user.id);
    setSelectedGroupIds(
      groups.filter(g => user.groups.includes(g.name)).map(g => g.id)
    );
  };

  const saveUserGroups = async () => {
    if (editingUserId === null) return;
    setError('');
    try {
      await setUserGroups(editingUserId, selectedGroupIds);
      setEditingUserId(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const toggleGroupSelection = (groupId: number) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const startCreateGroup = () => {
    setGroupForm({ id: null, name: '', description: '', permissions: [] });
  };

  const startEditGroup = (group: AppGroup) => {
    setGroupForm({
      id: group.id,
      name: group.name,
      description: group.description || '',
      permissions: group.permissions.map(p => p.permission),
    });
  };

  const saveGroup = async () => {
    if (!groupForm) return;
    setError('');
    try {
      if (groupForm.id) {
        await updateGroup(groupForm.id, groupForm.name, groupForm.description, groupForm.permissions);
      } else {
        await createGroup(groupForm.name, groupForm.description, groupForm.permissions);
      }
      setGroupForm(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDeleteGroup = async (group: AppGroup) => {
    if (!confirm(`Delete group "${group.name}"?`)) return;
    setError('');
    try {
      await deleteGroup(group.id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const togglePermission = (perm: string) => {
    if (!groupForm) return;
    setGroupForm({
      ...groupForm,
      permissions: groupForm.permissions.includes(perm)
        ? groupForm.permissions.filter(p => p !== perm)
        : [...groupForm.permissions, perm],
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button
          className={tab === 'users' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('users')}
        >
          Users
        </button>
        <button
          className={tab === 'groups' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('groups')}
        >
          Groups
        </button>
      </div>

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      {tab === 'users' && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Groups</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>
                    {editingUserId === user.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {groups.map(g => (
                          <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={selectedGroupIds.includes(g.id)}
                              onChange={() => toggleGroupSelection(g.id)}
                            />
                            {g.name}
                          </label>
                        ))}
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <button className="btn-primary btn-sm" onClick={saveUserGroups}>Save</button>
                          <button className="btn-secondary btn-sm" onClick={() => setEditingUserId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <span
                        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                        onClick={() => startEditGroups(user)}
                        title="Click to edit groups"
                      >
                        {user.groups.length > 0 ? user.groups.join(', ') : <em style={{ color: 'var(--text-secondary)' }}>None</em>}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ color: user.enabled ? 'var(--success)' : 'var(--error)' }}>
                      {user.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => handleToggleEnabled(user)}
                    >
                      {user.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'groups' && (
        <div>
          <button className="btn-primary" onClick={startCreateGroup} style={{ marginBottom: 12 }}>
            New Group
          </button>

          {groupForm && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12 }}>{groupForm.id ? 'Edit Group' : 'New Group'}</h3>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label>Name</label>
                <input
                  value={groupForm.name}
                  onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="Group name"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label>Description</label>
                <input
                  value={groupForm.description}
                  onChange={e => setGroupForm({ ...groupForm, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Permissions</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ALL_PERMISSIONS.map(p => (
                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={groupForm.permissions.includes(p)}
                        onChange={() => togglePermission(p)}
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" onClick={saveGroup} disabled={!groupForm.name.trim()}>
                  Save
                </button>
                <button className="btn-secondary" onClick={() => setGroupForm(null)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Permissions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => (
                  <tr key={group.id}>
                    <td>{group.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{group.description || '-'}</td>
                    <td>{group.permissions.map(p => p.permission).join(', ') || '-'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-secondary btn-sm" onClick={() => startEditGroup(group)}>
                        Edit
                      </button>
                      {group.name !== 'Admins' && (
                        <button className="btn-danger btn-sm" onClick={() => handleDeleteGroup(group)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
