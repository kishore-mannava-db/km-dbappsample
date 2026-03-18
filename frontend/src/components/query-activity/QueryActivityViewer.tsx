import React, { useState, useCallback } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Statistic, Row, Col, Spin, message } from 'antd';
import {
  ReloadOutlined, DatabaseOutlined, ApiOutlined, HistoryOutlined,
  CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import { evalApi } from '../../services/api';

const { Title, Text } = Typography;

interface TableStat {
  relname: string;
  seq_scan: number;
  seq_tup_read: number;
  idx_scan: number;
  idx_tup_fetch: number;
  n_tup_ins: number;
  n_tup_upd: number;
  n_tup_del: number;
  n_live_tup: number;
}

interface ActiveConn {
  pid: number;
  usename: string;
  state: string | null;
  query: string;
  query_start: string | null;
  backend_start: string | null;
}

interface QueryHistoryEntry {
  query: string;
  calls: number;
  avg_ms: number;
  total_ms: number;
  rows: number;
  note?: string;
}

interface ProofSummary {
  total_idx_scans: number;
  total_seq_scans: number;
  total_inserts: number;
  total_updates: number;
  active_pool_connections: number;
}

interface QueryActivityData {
  pg_stat_statements_status: string;
  table_stats: TableStat[];
  active_connections: ActiveConn[];
  query_history: (QueryHistoryEntry | { note: string })[];
  proof_summary: ProofSummary;
}

const QueryActivityViewer: React.FC = () => {
  const [data, setData] = useState<QueryActivityData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const res = await evalApi.queryActivity(reset);
      setData(res.data);
      message.success(reset ? 'Stats refreshed (reset requested)' : 'Query activity loaded');
    } catch (e: any) {
      message.error(`Failed to load: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const extEnabled = data?.pg_stat_statements_status?.startsWith('enabled');

  const tableStatCols = [
    { title: 'Table', dataIndex: 'relname', key: 'relname',
      render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Idx Scans', dataIndex: 'idx_scan', key: 'idx_scan',
      render: (v: number) => <Text style={{ color: '#1677ff' }}>{v?.toLocaleString()}</Text> },
    { title: 'Seq Scans', dataIndex: 'seq_scan', key: 'seq_scan',
      render: (v: number) => <Text>{v?.toLocaleString()}</Text> },
    { title: 'Rows Read (idx)', dataIndex: 'idx_tup_fetch', key: 'idx_tup_fetch',
      render: (v: number) => v?.toLocaleString() },
    { title: 'Rows Read (seq)', dataIndex: 'seq_tup_read', key: 'seq_tup_read',
      render: (v: number) => v?.toLocaleString() },
    { title: 'Inserts', dataIndex: 'n_tup_ins', key: 'n_tup_ins',
      render: (v: number) => <Tag color={v > 0 ? 'green' : 'default'}>{v?.toLocaleString()}</Tag> },
    { title: 'Updates', dataIndex: 'n_tup_upd', key: 'n_tup_upd',
      render: (v: number) => <Tag color={v > 0 ? 'blue' : 'default'}>{v?.toLocaleString()}</Tag> },
    { title: 'Live Rows', dataIndex: 'n_live_tup', key: 'n_live_tup',
      render: (v: number) => v?.toLocaleString() },
  ];

  const connCols = [
    { title: 'PID', dataIndex: 'pid', key: 'pid', width: 80 },
    { title: 'User', dataIndex: 'usename', key: 'usename', width: 180,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v?.slice(0, 24)}</Text> },
    { title: 'State', dataIndex: 'state', key: 'state', width: 80,
      render: (v: string | null) => v
        ? <Tag color={v === 'active' ? 'green' : v === 'idle' ? 'default' : 'orange'}>{v}</Tag>
        : <Tag>unknown</Tag> },
    { title: 'Query', dataIndex: 'query', key: 'query',
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v || '(idle)'}</Text> },
    { title: 'Started', dataIndex: 'backend_start', key: 'backend_start', width: 180,
      render: (v: string | null) => <Text type="secondary" style={{ fontSize: 11 }}>{v?.slice(0, 19) || '-'}</Text> },
  ];

  const queryHistoryCols = [
    { title: 'Calls', dataIndex: 'calls', key: 'calls', width: 70, sorter: (a: any, b: any) => a.calls - b.calls,
      defaultSortOrder: 'descend' as const,
      render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{v?.toLocaleString()}</Text> },
    { title: 'Avg (ms)', dataIndex: 'avg_ms', key: 'avg_ms', width: 90, sorter: (a: any, b: any) => a.avg_ms - b.avg_ms,
      render: (v: number) => <Text>{v}</Text> },
    { title: 'Total (ms)', dataIndex: 'total_ms', key: 'total_ms', width: 100, sorter: (a: any, b: any) => a.total_ms - b.total_ms,
      render: (v: number) => <Text type="secondary">{v?.toLocaleString()}</Text> },
    { title: 'Rows', dataIndex: 'rows', key: 'rows', width: 80,
      render: (v: number) => v?.toLocaleString() },
    { title: 'Query', dataIndex: 'query', key: 'query',
      render: (v: string) => (
        <Text code style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {v}
        </Text>
      ) },
  ];

  const queryHistoryData = data?.query_history?.filter(
    (q): q is QueryHistoryEntry => 'calls' in q
  ) || [];

  const hasNote = data?.query_history?.find((q): q is { note: string } => 'note' in q);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <DatabaseOutlined /> Query Activity Proof
        </Title>
        <Space>
          <Button onClick={() => fetchData(true)} disabled={loading}>
            Reset & Reload
          </Button>
          <Button type="primary" icon={<ReloadOutlined />} onClick={() => fetchData(false)} loading={loading}>
            {data ? 'Refresh' : 'Load Activity'}
          </Button>
        </Space>
      </div>

      {!data && !loading && (
        <Card>
          <Text type="secondary">
            Click "Load Activity" to query Postgres system views and show server-side proof that evaluation queries hit the Lakebase instance.
          </Text>
        </Card>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={4}>
              <Card size="small">
                <Statistic title="Index Scans" value={data.proof_summary.total_idx_scans}
                  valueStyle={{ color: '#1677ff' }} prefix={<DatabaseOutlined />} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="Seq Scans" value={data.proof_summary.total_seq_scans} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="Total Inserts" value={data.proof_summary.total_inserts}
                  valueStyle={{ color: '#52c41a' }} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="Total Updates" value={data.proof_summary.total_updates}
                  valueStyle={{ color: '#722ed1' }} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="Pool Connections" value={data.proof_summary.active_pool_connections}
                  prefix={<ApiOutlined />} />
              </Card>
            </Col>
            <Col span={4}>
              <Card size="small">
                <Statistic title="pg_stat_statements"
                  value={extEnabled ? 'Enabled' : 'Unavailable'}
                  valueStyle={{ color: extEnabled ? '#52c41a' : '#faad14', fontSize: 16 }}
                  prefix={extEnabled ? <CheckCircleOutlined /> : <WarningOutlined />} />
              </Card>
            </Col>
          </Row>

          {/* Query History */}
          <Card title={<><HistoryOutlined /> Query History (pg_stat_statements)</>}
            size="small" style={{ marginBottom: 16, borderTop: '3px solid #1677ff' }}
            extra={<Text type="secondary" style={{ fontSize: 11 }}>
              {queryHistoryData.length} queries tracked · sorted by total execution time
            </Text>}>
            {hasNote && !queryHistoryData.length ? (
              <Text type="warning">{hasNote.note}</Text>
            ) : (
              <Table dataSource={queryHistoryData} columns={queryHistoryCols}
                rowKey={(_, i) => String(i)} size="small" pagination={false}
                scroll={{ y: 400 }} />
            )}
          </Card>

          {/* Table Stats */}
          <Card title={<><DatabaseOutlined /> Table I/O Statistics (pg_stat_user_tables)</>}
            size="small" style={{ marginBottom: 16, borderTop: '3px solid #52c41a' }}>
            <Table dataSource={data.table_stats} columns={tableStatCols}
              rowKey="relname" size="small" pagination={false} />
          </Card>

          {/* Active Connections */}
          <Card title={<><ApiOutlined /> Active Connections (pg_stat_activity)</>}
            size="small" style={{ borderTop: '3px solid #722ed1' }}>
            <Table dataSource={data.active_connections} columns={connCols}
              rowKey="pid" size="small" pagination={false} />
          </Card>
        </>
      )}
    </div>
  );
};

export default QueryActivityViewer;
