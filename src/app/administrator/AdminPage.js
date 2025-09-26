import React from 'react';
import { Link } from 'react-router-dom';
import '../../assets/styles/Administrator.scss';

const AdminMediaList = () => {
  const items = [
    { icon: 'mdi mdi-domain', label: 'Business Group', path: '/administrator/OrganizationPage' },
    { icon: 'mdi mdi-account-group', label: 'User Creation', path: '/administrator/UserCreation' },
    // Add more items as needed
  ];

  return (
    <div className="admin-media-list container mt-4">
      <h3>Administrator</h3>
      <div className="row">
        {items.map((item, idx) => (
          <div className="col-md-4 mb-3" key={idx}>
            <Link to={item.path} className="media-card text-decoration-none">
              <div className="card text-center p-4 shadow-sm">
                <i className={`${item.icon} mdi-48px mb-3`}></i>
                <h5>{item.label}</h5>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminMediaList;
