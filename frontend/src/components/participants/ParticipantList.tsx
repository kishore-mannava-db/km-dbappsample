import React, { useEffect, useState, useCallback } from 'react';
import { Table, Select, Space, Typography, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { participantApi } from '../../services/api';
import type { Participant } from '../../types';
import LatencyBadge from '../common/LatencyBadge';

const { Title } = Typography;
const ROLES = ['lead_auditor','engagement_partner','review_partner','team_member','specialist','observer'];
const COUNTRIES = ['USA','GBR','DEU','FRA','JPN','AUS','CAN','BRA','IND','CHN'];

const ParticipantList: React.FC = () => {
  const [data, setData] = useState<Participant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number>();
  const [filters, setFilters] = useState<Record<string, any>>({ page: 1, page_size: 20 });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await participantApi.list(filters);
      setData(res.data.items); setTotal(res.data.total); setLatency(res.data.query_latency_ms);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { title: 'Firm', dataIndex: 'firm_name', key: 'firm' },
    { title: 'Firm ID', dataIndex: 'firm_id', key: 'fid', width: 100 },
    { title: 'Role', dataIndex: 'role', key: 'role', width: 150,
      render: (r: string) => <Tag color="blue">{r.replace(/_/g,' ')}</Tag> },
    { title: 'Country', dataIndex: 'country', key: 'country', width: 80 },
    { title: 'Added', dataIndex: 'added_at', key: 'added', width: 110,
      render: (d: string) => new Date(d).toLocaleDateString() },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Participants</Title>
        <LatencyBadge latencyMs={latency} />
      </div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select placeholder="Role" allowClear style={{ width: 160 }}
          options={ROLES.map(r => ({label: r.replace(/_/g,' '), value: r}))}
          onChange={(v) => setFilters(f => ({...f, role: v, page: 1}))} />
        <Select placeholder="Country" allowClear style={{ width: 120 }}
          options={COUNTRIES.map(c => ({label: c, value: c}))}
          onChange={(v) => setFilters(f => ({...f, country: v, page: 1}))} />
      </Space>
      <Table dataSource={data} columns={columns} rowKey="participant_id" loading={loading} size="small"
        pagination={{ current: filters.page, pageSize: filters.page_size, total, showSizeChanger: true,
          showTotal: (t) => `${t} total`,
          onChange: (p, ps) => setFilters(f => ({...f, page: p, page_size: ps})) }}
      />
    </div>
  );
};

export default ParticipantList;
