import React, { Component } from 'react';
import axios from 'axios';

// Simple reusable table/form helper for small masters
class Masters extends Component {
  state = {
    activeSection: 'department', // department | valuestream | line | machine | shift | plant
    data: {
      department: [],
      valuestream: [],
      line: [],
      machine: [],
      shift: [],
      plant: []
    },
    formVisible: false,
    editingId: null,
    formData: {}
  };

  componentDidMount() {
    this.fetchAll();
  }

  fetchAll = async () => {
    await Promise.all([
      this.fetchSection('department'),
      this.fetchSection('valuestream'),
      this.fetchSection('line'),
      this.fetchSection('machine'),
      this.fetchSection('shift'),
      this.fetchSection('plant')
    ]);
  };

  fetchSection = async (section) => {
    try {
      const res = await axios.get(`/api/${section}`);
      const list = res.data || [];
      this.setState(prev => ({ data: { ...prev.data, [section]: list } }));
    } catch (err) {
      console.error('fetchSection error', err);
      this.setState(prev => ({ data: { ...prev.data, [section]: [] } }));
    }
  };

  openCreate = (section) => {
    this.setState({ activeSection: section, formVisible: true, editingId: null, formData: this.getEmpty(section) });
  };

  openEdit = (section, item) => {
    this.setState({ activeSection: section, formVisible: true, editingId: item.id, formData: { ...item } });
  };

  getEmpty = (section) => {
    switch (section) {
      case 'department': return { deptCode: '', deptName: '', createdBy: '', createdDate: new Date().toISOString().split('T')[0] };
      case 'valuestream': return { vl_code: '', vl_name: '', createdBy: '', createdDate: new Date().toISOString().split('T')[0] };
      case 'line': return { line_code: '', line_name: '', vl_code: '', createdBy: '', createdDate: new Date().toISOString().split('T')[0] };
      case 'machine': return { machineName: '', machineNo: '', machineType: '', createdBy: '', createdDate: new Date().toISOString().split('T')[0] };
      case 'shift': return { shift_name: '', shift_type: '', start_time: '', end_time: '', createdBy: '', createdDate: new Date().toISOString().split('T')[0] };
      case 'plant': return { plant_name: '', plant_type: '', createdBy: '', createdDate: new Date().toISOString().split('T')[0] };
      default: return {};
    }
  };

  handleChange = (field, value) => {
    this.setState(prev => ({ formData: { ...prev.formData, [field]: value } }));
  };

  save = async () => {
    const { activeSection, editingId, formData } = this.state;
    try {
      // map frontend keys to backend snake_case keys
      const toSnake = (obj) => {
        const out = {};
        Object.keys(obj).forEach(k => {
          const snake = k.replace(/([A-Z])/g, '_$1').toLowerCase();
          out[snake] = obj[k];
        });
        return out;
      };

      const payload = toSnake(formData);

      if (editingId) {
        await axios.put(`/api/${activeSection}/${editingId}`, payload);
      } else {
        await axios.post(`/api/${activeSection}`, payload);
      }
      this.setState({ formVisible: false, editingId: null });
      await this.fetchSection(activeSection);
    } catch (err) {
      console.error('save error', err);
      alert('Error saving. See console.');
    }
  };

  remove = async (section, id) => {
    if (!window.confirm('Delete record?')) return;
    try {
      await axios.delete(`/api/${section}/${id}`);
      await this.fetchSection(section);
    } catch (err) {
      console.error('delete error', err);
      alert('Error deleting. See console.');
    }
  };

  // helpers for shift times: generate 24h options with 30min step
  genTimes = () => {
    const times = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');
        times.push(`${hh}:${mm}`);
      }
    }
    return times;
  };

  renderSectionList = (section) => {
    const list = this.state.data[section] || [];
    switch (section) {
      case 'department':
        return (
          <table className="table table-bordered table-sm">
            <thead><tr><th></th><th>Dept Code</th><th>Dept Name</th><th>Created By</th><th>Created Date</th></tr></thead>
            <tbody>
              {list.map(l => (
                <tr key={l.id}>
                  <td><button className="btn btn-sm btn-link p-0" onClick={() => this.openEdit('department', l)}>Edit</button></td>
                  <td>{l.deptCode}</td>
                  <td>{l.deptName}</td>
                  <td>{l.createdBy}</td>
                  <td>{l.createdDate}</td>
                </tr>
              ))}
              {list.length===0 && <tr><td colSpan={5} className="text-center">No records</td></tr>}
            </tbody>
          </table>
        );

      case 'valuestream':
        return (
          <table className="table table-bordered table-sm">
            <thead><tr><th></th><th>VL ID</th><th>VL Name</th><th>Created By</th><th>Created Date</th></tr></thead>
            <tbody>
              {list.map(l => (
                <tr key={l.id}>
                  <td><button className="btn btn-sm btn-link p-0" onClick={() => this.openEdit('valuestream', l)}>Edit</button></td>
                  <td>{l.vl_code}</td>
                  <td>{l.vl_name}</td>
                  <td>{l.createdBy}</td>
                  <td>{l.createdDate}</td>
                </tr>
              ))}
              {list.length===0 && <tr><td colSpan={5} className="text-center">No records</td></tr>}
            </tbody>
          </table>
        );

      case 'line':
        return (
          <table className="table table-bordered table-sm">
            <thead><tr><th></th><th>Line Code</th><th>Line Name</th><th>VL Name</th><th>Created By</th><th>Created Date</th></tr></thead>
            <tbody>
              {list.map(l => (
                <tr key={l.id}>
                  <td><button className="btn btn-sm btn-link p-0" onClick={() => this.openEdit('line', l)}>Edit</button></td>
                  <td>{l.line_code}</td>
                  <td>{l.line_name}</td>
                  <td>{l.vl_code}</td>
                  <td>{l.createdBy}</td>
                  <td>{l.createdDate}</td>
                </tr>
              ))}
              {list.length===0 && <tr><td colSpan={6} className="text-center">No records</td></tr>}
            </tbody>
          </table>
        );

      case 'machine':
        return (
          <table className="table table-bordered table-sm">
            <thead><tr><th></th><th>Machine Name</th><th>Machine No</th><th>Machine Type</th><th>Created By</th><th>Created Date</th></tr></thead>
            <tbody>
              {list.map(l => (
                <tr key={l.id}>
                  <td><button className="btn btn-sm btn-link p-0" onClick={() => this.openEdit('machine', l)}>Edit</button></td>
                  <td>{l.machineName}</td>
                  <td>{l.machineNo}</td>
                  <td>{l.machineType}</td>
                  <td>{l.createdBy}</td>
                  <td>{l.createdDate}</td>
                </tr>
              ))}
              {list.length===0 && <tr><td colSpan={6} className="text-center">No records</td></tr>}
            </tbody>
          </table>
        );

      case 'shift':
        return (
          <table className="table table-bordered table-sm">
            <thead><tr><th></th><th>Shift Name</th><th>Shift Type</th><th>Start</th><th>End</th><th>Created By</th><th>Created Date</th></tr></thead>
            <tbody>
              {list.map(l => (
                <tr key={l.id}>
                  <td><button className="btn btn-sm btn-link p-0" onClick={() => this.openEdit('shift', l)}>Edit</button></td>
                  <td>{l.shift_name}</td>
                  <td>{l.shift_type}</td>
                  <td>{l.start_time}</td>
                  <td>{l.end_time}</td>
                  <td>{l.createdBy}</td>
                  <td>{l.createdDate}</td>
                </tr>
              ))}
              {list.length===0 && <tr><td colSpan={7} className="text-center">No records</td></tr>}
            </tbody>
          </table>
        );

      case 'plant':
        return (
          <table className="table table-bordered table-sm">
            <thead><tr><th></th><th>Plant Name</th><th>Plant Type</th><th>Created By</th><th>Created Date</th></tr></thead>
            <tbody>
              {list.map(l => (
                <tr key={l.id}>
                  <td><button className="btn btn-sm btn-link p-0" onClick={() => this.openEdit('plant', l)}>Edit</button></td>
                  <td>{l.plant_name || l.plantName}</td>
                  <td>{l.plant_type || l.plantType}</td>
                  <td>{l.createdBy}</td>
                  <td>{l.createdDate}</td>
                </tr>
              ))}
              {list.length===0 && <tr><td colSpan={5} className="text-center">No records</td></tr>}
            </tbody>
          </table>
        );

      default:
        return null;
    }
  };

  renderForm = () => {
    const { activeSection, formData } = this.state;
    const times = this.genTimes();
    switch (activeSection) {
      case 'department':
        return (
          <div>
            <div className="form-row">
              <div className="form-group col-md-4"><label>Dept Code</label><input className="form-control form-control-sm" value={formData.deptCode} onChange={e=>this.handleChange('deptCode', e.target.value)} /></div>
              <div className="form-group col-md-6"><label>Dept Name</label><input className="form-control form-control-sm" value={formData.deptName} onChange={e=>this.handleChange('deptName', e.target.value)} /></div>
            </div>
            <div className="mt-2"><button className="btn btn-success btn-sm" onClick={this.save}>Save</button> <button className="btn btn-secondary btn-sm" onClick={()=>this.setState({formVisible:false})}>Cancel</button></div>
          </div>
        );

        case 'plant':
          return (
            <div>
              <div className="form-row">
                <div className="form-group col-md-6"><label>Plant Name</label><input className="form-control form-control-sm" value={formData.plant_name} onChange={e=>this.handleChange('plant_name', e.target.value)} /></div>
                <div className="form-group col-md-4"><label>Plant Type</label><input className="form-control form-control-sm" value={formData.plant_type} onChange={e=>this.handleChange('plant_type', e.target.value)} /></div>
              </div>
              <div className="mt-2"><button className="btn btn-success btn-sm" onClick={this.save}>Save</button> <button className="btn btn-secondary btn-sm" onClick={()=>this.setState({formVisible:false})}>Cancel</button></div>
            </div>
          );

      case 'valuestream':
        return (
          <div>
            <div className="form-row">
              <div className="form-group col-md-4"><label>VL Code</label><input className="form-control form-control-sm" value={formData.vl_code} onChange={e=>this.handleChange('vl_code', e.target.value)} /></div>
              <div className="form-group col-md-6"><label>VL Name</label><input className="form-control form-control-sm" value={formData.vl_name} onChange={e=>this.handleChange('vl_name', e.target.value)} /></div>
            </div>
            <div className="mt-2"><button className="btn btn-success btn-sm" onClick={this.save}>Save</button> <button className="btn btn-secondary btn-sm" onClick={()=>this.setState({formVisible:false})}>Cancel</button></div>
          </div>
        );

      case 'line':
        return (
          <div>
            <div className="form-row">
              <div className="form-group col-md-3"><label>Line Code</label><input className="form-control form-control-sm" value={formData.line_code} onChange={e=>this.handleChange('line_code', e.target.value)} /></div>
              <div className="form-group col-md-4"><label>Line Name</label><input className="form-control form-control-sm" value={formData.line_name} onChange={e=>this.handleChange('line_name', e.target.value)} /></div>
              <div className="form-group col-md-4"><label>VL Name</label><select className="form-control form-control-sm" value={formData.vl_code} onChange={e=>this.handleChange('vl_code', e.target.value)}>
                <option value="">Select VL</option>
                {this.state.data.valuestream.map(v=> <option key={v.id} value={v.vl_code}>{v.vl_name}</option>)}
              </select></div>
            </div>
            <div className="mt-2"><button className="btn btn-success btn-sm" onClick={this.save}>Save</button> <button className="btn btn-secondary btn-sm" onClick={()=>this.setState({formVisible:false})}>Cancel</button></div>
          </div>
        );

      case 'machine':
        return (
          <div>
            <div className="form-row">
              <div className="form-group col-md-4"><label>Machine Name</label><input className="form-control form-control-sm" value={formData.machineName} onChange={e=>this.handleChange('machineName', e.target.value)} /></div>
              <div className="form-group col-md-3"><label>Machine No</label><input className="form-control form-control-sm" value={formData.machineNo} onChange={e=>this.handleChange('machineNo', e.target.value)} /></div>
              <div className="form-group col-md-4"><label>Machine Type</label><input className="form-control form-control-sm" value={formData.machineType} onChange={e=>this.handleChange('machineType', e.target.value)} /></div>
            </div>
            <div className="mt-2"><button className="btn btn-success btn-sm" onClick={this.save}>Save</button> <button className="btn btn-secondary btn-sm" onClick={()=>this.setState({formVisible:false})}>Cancel</button></div>
          </div>
        );

      case 'shift':
        return (
          <div>
            <div className="form-row">
              <div className="form-group col-md-3"><label>Shift Name</label><input className="form-control form-control-sm" value={formData.shift_name} onChange={e=>this.handleChange('shift_name', e.target.value)} /></div>
              <div className="form-group col-md-2"><label>Shift Type</label><input className="form-control form-control-sm" value={formData.shift_type} onChange={e=>this.handleChange('shift_type', e.target.value)} /></div>
              <div className="form-group col-md-3"><label>Start Time</label><select className="form-control form-control-sm" value={formData.start_time} onChange={e=>this.handleChange('start_time', e.target.value)}>
                <option value="">Select</option>
                {times.map(t=> <option key={t}>{t}</option>)}
              </select></div>
              <div className="form-group col-md-3"><label>End Time</label><select className="form-control form-control-sm" value={formData.end_time} onChange={e=>this.handleChange('end_time', e.target.value)}>
                <option value="">Select</option>
                {times.filter(t=> !formData.start_time || t>formData.start_time).map(t=> <option key={t}>{t}</option>)}
              </select></div>
            </div>
            <div className="mt-2"><button className="btn btn-success btn-sm" onClick={this.save}>Save</button> <button className="btn btn-secondary btn-sm" onClick={()=>this.setState({formVisible:false})}>Cancel</button></div>
          </div>
        );

      default:
        return null;
    }
  };

  render() {
    const { activeSection, formVisible } = this.state;
    return (
      <div className="container-fluid">
        <div className="card p-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4>Masters</h4>
            <div>
              {['department','valuestream','line','machine','shift','plant'].map(s=> (
                <button key={s} className={`btn btn-sm mr-2 ${activeSection===s? 'btn-primary':'btn-outline-primary'}`} onClick={()=>this.setState({activeSection:s, formVisible:false})}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
              ))}
              <button className="btn btn-success btn-sm ml-2" onClick={()=>this.openCreate(activeSection)}>+ Add</button>
            </div>
          </div>

          <div>
            {this.renderSectionList(activeSection)}
          </div>

          {formVisible && (
            <div className="mt-3 card p-3">
              <h5>{this.state.editingId? 'Edit': 'Add'} {activeSection}</h5>
              {this.renderForm()}
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default Masters;
