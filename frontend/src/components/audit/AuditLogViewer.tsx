import React, { useEffect, useState, useCallback } from 'react';
import { Table, Input, Select, Space, Typography, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { auditApi } from '../../services/api';
import type { AuditLog } from '../../types';
import LatencyBadge from '../common/LatencyBadge';

const { Title } = Typography;
const ACTIONS = ['CREATE','UPDATE','DELETE','LOGIN','LOGOUT','VIEW','EXPORT','APPROVE','REJECT','SUBMIT'];
const TABLES = ['form_ap_active','participants_active','users','user_sessions'];
const actionColors: Record<string, string> = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'cyan', LOGOUT: 'default',
  VIEW: 'default', EXPORT: 'purple', APPROVE: 'green', REJECT: 'red', SUBMIT: 'orange',
};

const AuditLogViewer: React.FC = () => {
  const [data, setData] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number>();
  const [filters, setFilters] = useState<Record<string, any>>({ page: 1, page_size: 50 });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list(filters);
      setData(res.data.items); setTotal(res.data.total); setLatency(res.data.query_latency_ms);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { title: 'ID', dataIndex: 'audit_id', key: 'id', width: 70 },
    { title: 'User', dataIndex: 'user_email', key: 'user', ellipsis: true },
    { title: 'Action', dataIndex: 'action', key: 'action', width: 90,
      render: (a: string) => <Tag color={actionColors[a] || 'default'}>{a}</Tag> },
    { title: 'Table', dataIndex: 'table_name', key: 'table', width: 150 },
    { title: 'Record', dataIndex: 'record_id', key: 'rec', width: 100,
      render: (v: string | null) => v ? v.substring(0,8) + '...' : '-' },
    { title: 'Time', dataIndex: 'timestamp', key: 'ts', width: 150,
      render: (d: string) => new Date(d).toLocaleString() },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Audit Log</Title>
        <LatencyBadge latencyMs={latency} />
      </div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search placeholder="Filter by email..." allowClear prefix={<SearchOutlined />}
          onSearch={(v) => setFilters(f => ({...f, user_email: v, page: 1}))} style={{ width: 220 }} />
        <Select placeholder="Action" allowClear style={{ width: 120 }}
          options={ACTIONS.map(a => ({label: a, value: a}))}
          onChange={(v) => setFilters(f => ({...f, action: v, page: 1}))} />
        <Select placeholder="Table" allowClear style={{ width: 180 }}
          options={TABLES.map(t => ({label: t, value: t}))}
          onChange={(v) => setFilters(f => ({...f, table_name: v, page: 1}))} />
      </Space>
      <Table dataSource={data} columns={columns} rowKey="audit_id" loading={loading} size="small"
        pagination={{ current: filters.page, pageSize: filters.page_size, total, showSizeChanger: true,
          showTotal: (t) => `${t} total`,
          onChange: (p, ps) => setFilters(f => ({...f, page: p, page_size: ps})) }}
      />
    </div>
  );
};

export default AuditLogViewer;
