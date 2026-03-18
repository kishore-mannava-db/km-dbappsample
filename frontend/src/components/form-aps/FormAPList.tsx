import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Select, Input, Space, Typography, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { formApApi } from '../../services/api';
import type { FormAP, FormStatus } from '../../types';
import LatencyBadge from '../common/LatencyBadge';

const { Title } = Typography;

const statusColors: Record<FormStatus, string> = {
  draft: 'default', submitted: 'processing', under_review: 'warning',
  approved: 'success', rejected: 'error', archived: 'purple',
};
const COUNTRIES = ['USA','GBR','DEU','FRA','JPN','AUS','CAN','BRA','IND','CHN'];
const STATUSES: FormStatus[] = ['draft','submitted','under_review','approved','rejected','archived'];

const FormAPList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<FormAP[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number>();
  const [filters, setFilters] = useState<Record<string, any>>({ page: 1, page_size: 20 });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await formApApi.list(filters);
      setData(res.data.items);
      setTotal(res.data.total);
      setLatency(res.data.query_latency_ms);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const columns = [
    { title: 'Issuer ID', dataIndex: 'issuer_id', key: 'issuer',
      render: (v: string, r: FormAP) => <a onClick={() => navigate(`/form-aps/${r.form_ap_id}`)}>{v}</a> },
    { title: 'Year', dataIndex: 'fiscal_year', key: 'year', width: 80 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (s: FormStatus) => <Tag color={statusColors[s]}>{s.replace('_', ' ')}</Tag> },
    { title: 'Country', dataIndex: 'location_country', key: 'country', width: 80 },
    { title: 'Created', dataIndex: 'created_at', key: 'created', width: 120,
      render: (d: string) => new Date(d).toLocaleDateString() },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Form APs</Title>
        <Space>
          <LatencyBadge latencyMs={latency} />
          <Button icon={<ReloadOutlined />} onClick={fetch}>Refresh</Button>
        </Space>
      </div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search placeholder="Search issuer..." allowClear prefix={<SearchOutlined />}
          onSearch={(v) => setFilters(f => ({...f, search: v, page: 1}))} style={{ width: 200 }} />
        <Select placeholder="Country" allowClear style={{ width: 120 }}
          options={COUNTRIES.map(c => ({label: c, value: c}))}
          onChange={(v) => setFilters(f => ({...f, country: v, page: 1}))} />
        <Select placeholder="Status" allowClear style={{ width: 140 }}
          options={STATUSES.map(s => ({label: s.replace('_',' '), value: s}))}
          onChange={(v) => setFilters(f => ({...f, status: v, page: 1}))} />
        <Button type="link" onClick={() => setFilters({page: 1, page_size: 20})}>Reset</Button>
      </Space>
      <Table dataSource={data} columns={columns} rowKey="form_ap_id" loading={loading} size="small"
        pagination={{ current: filters.page, pageSize: filters.page_size, total, showSizeChanger: true,
          showTotal: (t) => `${t} total`,
          onChange: (p, ps) => setFilters(f => ({...f, page: p, page_size: ps})) }}
      />
    </div>
  );
};

export default FormAPList;
