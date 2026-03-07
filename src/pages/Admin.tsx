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
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className="status-badge action"
          onClick={() => setTab('users')}
          style={{ background: tab === 'users' ? '#004085' : undefined, color: tab === 'users' ? 'white' : undefined }}
        >
          Users
        </button>
        <button
          className="status-badge action"
          onClick={() => setTab('groups')}
          style={{ background: tab === 'groups' ? '#004085' : undefined, color: tab === 'groups' ? 'white' : undefined }}
        >
          Groups
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {tab === 'users' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Users</span>
          </div>
          <table className="table">
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
                          <label key={g.id} className="toggle-label">
                            <input
                              type="checkbox"
                              checked={selectedGroupIds.includes(g.id)}
                              onChange={() => toggleGroupSelection(g.id)}
                            />
                            {g.name}
                          </label>
                        ))}
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <button className="status-badge action" onClick={saveUserGroups}>Save</button>
                          <button className="status-badge action" onClick={() => setEditingUserId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <span
                        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                        onClick={() => startEditGroups(user)}
                        title="Click to edit groups"
                      >
                        {user.groups.length > 0 ? user.groups.join(', ') : <em style={{ color: '#888' }}>None</em>}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ color: user.enabled ? '#28a745' : '#dc3545' }}>
                      {user.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <button
                      className={user.enabled ? 'status-badge danger' : 'status-badge action'}
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
          <div className="card">
            <div className="card-header">
              <span className="card-title">Groups</span>
              <button className="status-badge add" onClick={startCreateGroup}>+ New Group</button>
            </div>

            {groupForm && (
              <div className="config-form" style={{ marginBottom: 16 }}>
                <strong style={{ display: 'block', marginBottom: 12 }}>{groupForm.id ? 'Edit Group' : 'New Group'}</strong>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    value={groupForm.name}
                    onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                    placeholder="Group name"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input
                    value={groupForm.description}
                    onChange={e => setGroupForm({ ...groupForm, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <div className="form-group">
                  <label>Permissions</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {ALL_PERMISSIONS.map(p => (
                      <label key={p} className="toggle-label">
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
                <div className="form-actions">
                  <div />
                  <div>
                    <button className="status-badge action" onClick={() => setGroupForm(null)}>Cancel</button>
                    <button className="status-badge add" onClick={saveGroup} disabled={!groupForm.name.trim()}>Save</button>
                  </div>
                </div>
              </div>
            )}

            <div className="config-list">
              {groups.map(group => (
                <div key={group.id} className="config-item">
                  <div className="config-item-row">
                    <div className="config-item-info">
                      <strong>{group.name}</strong>
                      {group.description && <span className="config-detail">{group.description}</span>}
                      <span className="config-detail">
                        {group.permissions.map(p => p.permission).join(', ') || 'No permissions'}
                      </span>
                    </div>
                    <div className="config-item-actions">
                      <button className="status-badge action" onClick={() => startEditGroup(group)}>Edit</button>
                      {group.name !== 'Admins' && (
                        <button className="status-badge danger" onClick={() => handleDeleteGroup(group)}>Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
