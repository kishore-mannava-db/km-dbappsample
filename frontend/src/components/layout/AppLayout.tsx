import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Button } from 'antd';
import {
  FileTextOutlined, TeamOutlined, UserOutlined,
  AuditOutlined, ExperimentOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <ExperimentOutlined />, label: 'Evaluation' },
    { key: '/form-aps', icon: <FileTextOutlined />, label: 'Form APs' },
    { key: '/participants', icon: <TeamOutlined />, label: 'Participants' },
    { key: '/users', icon: <UserOutlined />, label: 'Users' },
    { key: '/audit', icon: <AuditOutlined />, label: 'Audit Log' },
    { key: '/query-activity', icon: <DatabaseOutlined />, label: 'Query Activity' },
  ];

  const selectedKey = menuItems.find(
    item => item.key !== '/' && location.pathname.startsWith(item.key)
  )?.key || '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} trigger={null} width={240}>
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Title level={4} style={{ margin: 0, color: '#fff', fontSize: collapsed ? 14 : 16 }}>
            {collapsed ? 'LB' : 'Lakebase Eval'}
          </Title>
        </div>
        <Menu
          theme="dark" mode="inline" selectedKeys={[selectedKey]}
          items={menuItems} onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', display: 'flex', alignItems: 'center', background: '#fff',
          borderBottom: '1px solid #f0f0f0' }}>
          <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)} />
          <Title level={5} style={{ margin: '0 0 0 16px' }}>Lakebase OLTP Evaluation Track</Title>
        </Header>
        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
