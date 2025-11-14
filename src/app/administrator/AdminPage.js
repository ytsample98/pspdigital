import React, { useState } from 'react';
import '../../assets/styles/Administrator.scss';
import Masters from './Masters';
import OrganizationPage from './OrganizationPage';
import UserCreation from './UserCreation';
import UserType from './UserType';
import UserResponsibility from './UserResponsibility';
import EscalationMatrix from './EscalationMatrix';
import notify from './Notifications';
import { Link,NavLink } from 'react-router-dom';


const AdminMediaList = () => {
  const [visible, setVisible] = useState(null); // 'masters' | 'organization' | 'user'

  return (
    <div className="admin-media-list container mt-4">
      <h3>Administrator</h3>
      <div className="row">
        <div className="col-md-4 mb-3">
          {/* <div className={`media-card card text-center p-4 shadow-sm ${visible==='organization' ? 'border-primary' : ''}`} style={{cursor:'pointer'}} onClick={() => setVisible(visible==='organization' ? null : 'organization')}>
           */}
           <NavLink to="/administrator/OrganizationPage" className="media-card card text-center p-4 shadow-sm" activeClassName="border-primary">
           <div style={{padding:16}}> 
              <i className={`mdi mdi-domain mdi-48px mb-3`}></i>
              <h5>Business Group</h5>
            </div>
            </NavLink>
        </div>

        <div className="col-md-4 mb-3">
          {/* <div className={`media-card card text-center p-4 shadow-sm ${visible==='masters' ? 'border-primary' : ''}`} style={{cursor:'pointer'}} onClick={() => setVisible(visible==='masters' ? null : 'masters')}> */}
            <NavLink to="/administrator/Masters" className="media-card card text-center p-4 shadow-sm" activeClassName="border-primary">
             <div style={{padding:16}}>
              <i className={`mdi mdi-cogs mdi-48px mb-3`}></i>
              <h5>Masters</h5>
            </div>
            </NavLink>
           
        </div>

        <div className="col-md-4 mb-3">
          {/* <div className={`media-card card text-center p-4 shadow-sm ${visible==='usertype' ? 'border-primary' : ''}`} style={{cursor:'pointer'}} onClick={() => setVisible(visible==='usertype' ? null : 'usertype')}> */}
            <NavLink to="/administrator/UserType" className="media-card card text-center p-4 shadow-sm" activeClassName="border-primary">
              <div style={{padding:16}}>
              <i className={`mdi mdi-account-circle mdi-48px mb-3`}></i>
              <h5>User Type</h5>
            </div>
            </NavLink>
        </div>

        <div className="col-md-4 mb-3">
          {/* <div className={`media-card card text-center p-4 shadow-sm ${visible==='userresp' ? 'border-primary' : ''}`} style={{cursor:'pointer'}} onClick={() => setVisible(visible==='userresp' ? null : 'userresp')}> */}
            <NavLink to="/administrator/UserResponsibility" className="media-card card text-center p-4 shadow-sm" activeClassName="border-primary">
            <div style={{padding:16}}>
              <i className={`mdi mdi-shield-account mdi-48px mb-3`}></i>
              <h5>User Responsibility</h5>
            </div>
            </NavLink>
            
        </div>

        <div className="col-md-4 mb-3">
          {/* <div className={`media-card card text-center p-4 shadow-sm ${visible==='escalation' ? 'border-primary' : ''}`} style={{cursor:'pointer'}} onClick={() => setVisible(visible==='escalation' ? null : 'escalation')}> */}
            <NavLink to="/administrator/EscalationMatrix" className="media-card card text-center p-4 shadow-sm" activeClassName="border-primary">
             <div style={{padding:16}}>
              <i className={`mdi mdi-alert-circle-outline mdi-48px mb-3`}></i>
              <h5>Escalation Matrix</h5>
            </div>
            </NavLink>
        </div>

        <div className="col-md-4 mb-3">
          {/* <div className={`media-card card text-center p-4 shadow-sm ${visible==='user' ? 'border-primary' : ''}`} style={{cursor:'pointer'}} onClick={() => setVisible(visible==='user' ? null : 'user')}> */}
            <NavLink to="/administrator/UserCreation" className="media-card card text-center p-4 shadow-sm" activeClassName="border-primary">
            <div style={{padding:16}}>
              <i className={`mdi mdi-account-group mdi-48px mb-3`}></i>
              <h5>User Creation</h5>
            </div>
            </NavLink>
            
        </div>

      </div>
{/* 
      <div className="mt-3">
  {visible === 'masters' && <Masters />}
  {visible === 'organization' && <OrganizationPage />}
  {visible === 'user' && <UserCreation />}
  {visible === 'usertype' && <UserType />}
      {visible === 'userresp' && <UserResponsibility />}
      {visible === 'escalation' && <EscalationMatrix />}
      {/* {visible === 'notifications' && <Notifications />}
      </div> */}

    </div>
  );
};

export default AdminMediaList;
