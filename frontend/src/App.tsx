import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import AppLayout from './components/layout/AppLayout';
import FormAPList from './components/form-aps/FormAPList';
import FormAPDetail from './components/form-aps/FormAPDetail';
import ParticipantList from './components/participants/ParticipantList';
import UserList from './components/users/UserList';
import AuditLogViewer from './components/audit/AuditLogViewer';
import EvalRunner from './components/evaluation/EvalRunner';
import QueryActivityViewer from './components/query-activity/QueryActivityViewer';

const App: React.FC = () => (
  <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<EvalRunner />} />
          <Route path="form-aps" element={<FormAPList />} />
          <Route path="form-aps/:id" element={<FormAPDetail />} />
          <Route path="participants" element={<ParticipantList />} />
          <Route path="users" element={<UserList />} />
          <Route path="audit" element={<AuditLogViewer />} />
          <Route path="query-activity" element={<QueryActivityViewer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </ConfigProvider>
);

export default App;
