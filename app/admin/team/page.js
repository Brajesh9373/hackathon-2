'use client';

import { useEffect, useMemo, useState } from 'react';
import PortalShell from '../../ui/PortalShell';
import { resources } from '../../lib/api';
import { EmptyState, PageIntro, friendlyError } from '../../ui/PortalBlocks';

const EMPTY_FORM = { name: '', mobile: '', email: '', role: 'supervisor', module: 'BOTH', ward: '', zone: '', designation: 'Field worker' };

function normalizePeople(result) {
  return [
    ...(result?.supervisors || []).map(person => ({ ...person, role: 'supervisor' })),
    ...(result?.workers || []).map(person => ({ ...person, role: 'worker' })),
  ];
}

export default function AdminTeamPage() {
  const [people, setPeople] = useState([]);
  const [scope, setScope] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = () => {
    setLoading(true);
    return resources.team()
      .then(result => {
        setPeople(normalizePeople(result));
        setError(result?.error || '');
      })
      .catch(() => setError('Could not load the people directory.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => people.filter(person => {
    if (scope === 'supervisors') return person.role === 'supervisor' && person.is_active !== false;
    if (scope === 'workers') return person.role === 'worker' && person.is_active !== false;
    if (scope === 'inactive') return person.is_active === false;
    return person.is_active !== false;
  }), [people, scope]);

  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError('');
  };

  const openEdit = person => {
    setEditing(person);
    setForm({
      name: person.name || '',
      mobile: person.mobile || '',
      email: person.email || '',
      role: person.role,
      module: person.module || 'BOTH',
      ward: person.ward || '',
      zone: person.zone || '',
      designation: person.worker_profile?.designation || 'Field worker',
    });
    setShowForm(true);
    setError('');
  };

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const payload = { ...form, district: form.ward };
    const result = editing
      ? await resources.updatePerson(editing._id, payload)
      : await resources.createPerson(payload);
    setBusy(false);
    if (!result?.success) return setError(friendlyError(result?.error));
    setNotice(editing ? `${form.name} was updated.` : `${form.name} was added to the directory.`);
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    await load();
  };

  const remove = async person => {
    setBusy(person._id);
    setError('');
    const result = await resources.removePerson(person._id);
    setBusy(false);
    if (!result?.success) return setError(friendlyError(result?.error));
    setNotice(`${person.name} was removed from active routing.`);
    await load();
    setScope('inactive');
  };

  const restore = async person => {
    setBusy(person._id);
    setError('');
    const result = await resources.updatePerson(person._id, { is_active: true });
    setBusy(false);
    if (!result?.success) return setError(friendlyError(result?.error));
    setNotice(`${person.name} is active again.`);
    await load();
    setScope('active');
  };

  return <PortalShell role="admin">
    <PageIntro eyebrow="PEOPLE" title="Keep ownership current." detail="Create, edit, deactivate, and restore the supervisors and workers who receive civic work." action={<button className="v-button v-button-primary" onClick={showForm ? () => { setShowForm(false); setEditing(null); } : openCreate}>{showForm ? 'Close form' : 'Add person'}</button>} />
    <div className="v-filterbar v-team-tabs" role="tablist" aria-label="People filter">
      {[['active', 'Active'], ['supervisors', 'Supervisors'], ['workers', 'Workers'], ['inactive', 'Inactive']].map(([key, label]) => <button type="button" role="tab" aria-selected={scope === key} className={`v-filter ${scope === key ? 'is-active' : ''}`} onClick={() => setScope(key)} key={key}>{label}</button>)}
      <span className="v-result-count">{visible.length} people</span>
    </div>
    {notice && <div className="v-notice v-notice-success" role="status">{notice}</div>}
    {error && <p className="v-form-error" role="alert">{error}</p>}
    {showForm && <form className="v-panel v-form v-team-form" onSubmit={submit}>
      <div className="v-section-heading"><div><span className="v-eyebrow">{editing ? 'EDIT PERSON' : 'NEW PERSON'}</span><h2>{editing ? `Update ${editing.name}` : 'Add a routing owner'}</h2></div></div>
      <div className="v-form-grid">
        <div className="v-field"><label htmlFor="team-name">Name</label><input id="team-name" name="name" value={form.name} onChange={update} required placeholder="Full name" /></div>
        <div className="v-field"><label htmlFor="team-mobile">Mobile</label><input id="team-mobile" name="mobile" value={form.mobile} onChange={update} required inputMode="tel" placeholder="+91 9XXXXXXXXX" /></div>
        <div className="v-field"><label htmlFor="team-role">Role</label><select id="team-role" name="role" value={form.role} onChange={update} disabled={Boolean(editing)}><option value="supervisor">Supervisor</option><option value="worker">Worker</option></select></div>
        <div className="v-field"><label htmlFor="team-module">Workstream</label><select id="team-module" name="module" value={form.module} onChange={update}><option value="BOTH">All civic work</option><option value="DEVELOPMENT">Development</option><option value="WASTE">Waste</option></select></div>
        <div className="v-field"><label htmlFor="team-ward">Ward or area</label><input id="team-ward" name="ward" value={form.ward} onChange={update} placeholder="Ward 7" /></div>
        <div className="v-field"><label htmlFor="team-zone">Zone</label><input id="team-zone" name="zone" value={form.zone} onChange={update} placeholder="Central zone" /></div>
        <div className="v-field v-field-full"><label htmlFor="team-email">Email <span>(optional)</span></label><input id="team-email" name="email" value={form.email} onChange={update} type="email" placeholder="name@example.org" /></div>
        {form.role === 'worker' && <div className="v-field v-field-full"><label htmlFor="team-designation">Designation</label><input id="team-designation" name="designation" value={form.designation} onChange={update} placeholder="Field worker" /></div>}
      </div>
      <div className="v-form-actions"><button type="button" className="v-button v-button-ghost" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button><button className="v-button v-button-primary" disabled={busy}>{busy ? 'Saving' : editing ? 'Save changes' : 'Add person'}</button></div>
    </form>}
    {loading ? <div className="v-loading" style={{ minHeight: 260 }}><div className="v-loading-mark">N</div><p>Reading the directory</p></div> : visible.length ? <div className="v-people-grid">{visible.map(person => <article className={`v-person-card ${person.is_active === false ? 'is-inactive' : ''}`} key={person._id}>
      <div className="v-person-avatar">{(person.name || 'P').slice(0, 1).toUpperCase()}</div>
      <div><h3>{person.name}</h3><p>{person.role === 'supervisor' ? 'Supervisor' : person.worker_profile?.designation || 'Field worker'}</p><small>{String(person.module || 'BOTH').replace(/_/g, ' ')}{person.ward ? ` / ${person.ward}` : ''}</small></div>
      <span className={`v-availability ${person.is_active === false ? 'is-inactive' : ''}`}><i />{person.is_active === false ? 'Inactive' : 'Active'}</span>
      <div className="v-person-actions">{person.is_active === false ? <button type="button" className="v-text-button" onClick={() => restore(person)} disabled={busy === person._id}>Restore</button> : <><button type="button" className="v-text-button" onClick={() => openEdit(person)}>Edit</button><button type="button" className="v-text-button v-text-danger" onClick={() => remove(person)} disabled={busy === person._id}>{busy === person._id ? 'Removing' : 'Remove'}</button></>}</div>
    </article>)}</div> : <EmptyState title={`No ${scope === 'inactive' ? 'inactive people' : 'people'} yet`} detail={scope === 'inactive' ? 'Removed people remain here so historic ownership stays auditable.' : 'Add a supervisor or worker to make routing actionable.'} action={!showForm && <button type="button" className="v-button v-button-ghost" onClick={openCreate}>Add person</button>} />}
  </PortalShell>;
}
