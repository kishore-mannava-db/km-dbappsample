import React, { useEffect, useState, useCallback } from 'react';
import { Table, Input, Select, Space, Typography, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { userApi } from '../../services/api';
import type { User } from '../../types';
import LatencyBadge from '../common/LatencyBadge';

const { Title } = Typography;
const ROLES = ['admin','global_reviewer','country_manager','auditor','viewer'];
const roleColors: Record<string, string> = {
  admin: 'red', global_reviewer: 'volcano', country_manager: 'orange', auditor: 'blue', viewer: 'default',
};

const UserList: React.FC = () => {
  const [data, setData] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number>();
  const [filters, setFilters] = useState<Record<string, any>>({ page: 1, page_size: 20 });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userApi.list(filters);
      setData(res.data.items); setTotal(res.data.total); setLatency(res.data.query_latency_ms);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: 'Role', dataIndex: 'role', key: 'role', width: 140,
      render: (r: string) => <Tag color={roleColors[r] || 'default'}>{r.replace(/_/g,' ')}</Tag> },
    { title: 'Countries', dataIndex: 'country_access', key: 'countries',
      render: (c: string[]) => c?.slice(0,3).map(x => <Tag key={x}>{x}</Tag>) },
    { title: 'Last Login', dataIndex: 'last_login', key: 'login', width: 110,
      render: (d: string | null) => d ? new Date(d).toLocaleDateString() : '-' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Users</Title>
        <LatencyBadge latencyMs={latency} />
      </div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search placeholder="Search name/email..." allowClear prefix={<SearchOutlined />}
          onSearch={(v) => setFilters(f => ({...f, search: v, page: 1}))} style={{ width: 220 }} />
        <Select placeholder="Role" allowClear style={{ width: 160 }}
          options={ROLES.map(r => ({label: r.replace(/_/g,' '), value: r}))}
          onChange={(v) => setFilters(f => ({...f, role: v, page: 1}))} />
      </Space>
      <Table dataSource={data} columns={columns} rowKey="user_id" loading={loading} size="small"
        pagination={{ current: filters.page, pageSize: filters.page_size, total, showSizeChanger: true,
          showTotal: (t) => `${t} total`,
          onChange: (p, ps) => setFilters(f => ({...f, page: p, page_size: ps})) }}
      />
    </div>
  );
};

export default UserList;
