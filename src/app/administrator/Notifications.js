import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('');
  const [responsibility, setResponsibility] = useState([]);
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [respOptions, setRespOptions] = useState([]);
  const [triggerOptions, setTriggerOptions] = useState([]);

  useEffect(() => {
    fetchItems();
    fetchResponsibilities();
    fetchTriggers();
  }, []);

  const fetchItems = async () => {
    const res = await axios.get('/api/notifications');
    setItems(res.data || []);
  };

  const fetchResponsibilities = async () => {
    const res = await axios.get('/api/user_responsibility');
    setRespOptions(res.data || []);
  };

  const fetchTriggers = async () => {
    // For now, hardcode or later fetch from backend
    setTriggerOptions(['ticket_created', 'escalation_updated', 'waiting_for_approval']);
  };

  const save = async () => {
    if (!name || !trigger || responsibility.length === 0) {
      return alert('Please fill all required fields');
    }
    const payload = {
      name,
      trigger,
      responsibility: JSON.stringify(responsibility),
      link,
      message
    };
    if (editing) {
      await axios.put(`/api/notifications/${editing}`, payload);
    } else {
      await axios.post('/api/notifications', payload);
    }
    resetForm();
    fetchItems();
  };

  const edit = (item) => {
    setName(item.name);
    setTrigger(item.trigger);
    try {
      setResponsibility(JSON.parse(item.responsibility));
    } catch {
      setResponsibility([]);
    }
    setLink(item.link);
    setMessage(item.message);
    setEditing(item.id);
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this notification?')) return;
    await axios.delete(`/api/notifications/${id}`);
    fetchItems();
  };

  const resetForm = () => {
    setName('');
    setTrigger('');
    setResponsibility([]);
    setLink('');
    setMessage('');
    setEditing(null);
  };

  const toggleResponsibility = (id) => {
    if (responsibility.includes(id)) {
      setResponsibility(responsibility.filter(r => r !== id));
    } else {
      setResponsibility([...responsibility, id]);
    }
  };

  return (
    <div className="notifications-page">
      <h3>Notifications</h3>
      <div className="form-section">
        <input
          type="text"
          placeholder="Notification Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          <option value="">Select Trigger</option>
          {triggerOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div>
          <label>Responsibility:</label>
          {respOptions.map(r => (
            <label key={r.id}>
              <input
                type="checkbox"
                checked={responsibility.includes(r.id)}
                onChange={() => toggleResponsibility(r.id)}
              />
              {r.resp_name}
            </label>
          ))}
        </div>
        <input
          type="text"
          placeholder="Link (e.g., /preview?pscid=123)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <textarea
          placeholder="Message Template (use {pscid}, {username})"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button onClick={save}>{editing ? 'Update' : 'Create'}</button>
        {editing && <button onClick={resetForm}>Cancel</button>}
      </div>
          <div className="custom-table-responsive">

       <table className="table table-bordered table-sm">
              <thead className="thead-light">
          <tr>
            <th>Name</th>
            <th>Trigger</th>
            <th>Responsibility</th>
            <th>Link</th>
            <th>Message</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.trigger}</td>
              <td>{(() => {
                try { return JSON.parse(item.responsibility).map(id => {
                  const r = respOptions.find(opt => opt.id === id);
                  return r ? r.resp_name : id;
                }).join(', '); }
                catch { return item.responsibility; }
              })()}</td>
              <td>{item.link}</td>
              <td>{item.message}</td>
              <td>
                <button onClick={() => edit(item)}>Edit</button>
                <button onClick={() => remove(item.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan="6">No notifications found</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}