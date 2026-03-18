import React, { useState } from 'react';
import { Row, Col, Card, Button, Table, Tag, Typography, Space, InputNumber, Statistic, Progress, Spin, message, Steps, Collapse } from 'antd';
import {
  ThunderboltOutlined, SafetyOutlined, DatabaseOutlined,
  KeyOutlined, PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  CodeOutlined, LoadingOutlined, RocketOutlined,
} from '@ant-design/icons';
import { evalApi } from '../../services/api';
import type { EvalResult } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface EvalStep {
  item: number;
  title: string;
  query: string;
  target: string;
}

interface EvalCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  steps: EvalStep[];
  action: () => Promise<{ data: EvalResult[] }>;
}

const CATEGORY_DEFS: Omit<EvalCategory, 'action'>[] = [
  {
    key: 'read', label: 'Read Performance (1-6)', icon: <ThunderboltOutlined />, color: '#1677ff',
    description: 'Measures OLTP read latencies against 10,000 form_ap_active records with 21 B-tree indexes.',
    steps: [
      { item: 1, title: 'Single-row PK lookup', query: 'SELECT * FROM form_ap_active WHERE form_ap_id = $1', target: '< 10ms p95' },
      { item: 2, title: 'Paginated list (20 rows)', query: 'SELECT * FROM form_ap_active WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 20 OFFSET 0', target: '< 200ms' },
      { item: 3, title: 'Single index filter', query: "SELECT * FROM form_ap_active WHERE location_country = 'USA' AND deleted_at IS NULL LIMIT 20", target: '< 200ms' },
      { item: 4, title: 'Composite index filter', query: "SELECT * FROM form_ap_active WHERE location_country = 'USA' AND status = 'approved' AND deleted_at IS NULL LIMIT 20", target: '< 200ms' },
      { item: 5, title: 'ILIKE text search', query: "SELECT * FROM form_ap_active WHERE issuer_id ILIKE '%ISS-2025%' AND deleted_at IS NULL LIMIT 20", target: '< 300ms' },
      { item: 6, title: 'FK index lookup (participants by form)', query: 'SELECT * FROM participants_active WHERE form_ap_id = $1', target: '< 200ms' },
    ],
  },
  {
    key: 'write', label: 'Write Performance (7-11)', icon: <ThunderboltOutlined />, color: '#722ed1',
    description: 'Tests transactional write latencies: INSERT, UPDATE, soft DELETE, FK validation, and audit logging within the same transaction.',
    steps: [
      { item: 7, title: 'Single INSERT', query: "INSERT INTO form_ap_active (issuer_id, fiscal_year, status, location_country, created_by) VALUES ('ISS-EVAL-...', 2025, 'draft', 'USA', $uid) RETURNING form_ap_id", target: '< 50ms' },
      { item: 8, title: 'Single UPDATE', query: "UPDATE form_ap_active SET status = 'submitted' WHERE form_ap_id = $1 RETURNING *", target: '< 50ms' },
      { item: 9, title: 'Soft DELETE', query: 'UPDATE form_ap_active SET deleted_at = NOW() WHERE form_ap_id = $1', target: '< 50ms' },
      { item: 10, title: 'INSERT with FK validation', query: "INSERT INTO participants_active (form_ap_id, firm_name, firm_id, role, country, added_by) VALUES ($fk, 'EvalFirm', 'EVAL-001', 'team_member', 'USA', $uid) RETURNING participant_id", target: '< 50ms' },
      { item: 11, title: 'Write + audit in same txn', query: "BEGIN;\n  INSERT INTO form_ap_active (...) RETURNING form_ap_id;\n  INSERT INTO audit_log_recent (user_email, action, table_name, record_id, new_value) VALUES (...);\nCOMMIT;", target: '< 100ms' },
    ],
  },
  {
    key: 'pool', label: 'Connection Pool (12-18)', icon: <DatabaseOutlined />, color: '#13c2c2',
    description: 'Verifies psycopg2 ThreadedConnectionPool configuration: pool sizing, OAuth token auth, SSL enforcement, and RLS context injection.',
    steps: [
      { item: 12, title: 'Pool initialized', query: 'ThreadedConnectionPool(minconn=2, maxconn=20, sslmode="require")', target: 'initialized = true' },
      { item: 13, title: 'OAuth token auth', query: 'databricks.sdk.WorkspaceClient().database.generate_database_credential()', target: 'token_len > 0' },
      { item: 14, title: 'Token lifecycle', query: 'Token expires in 1h; production needs 50-min background refresh', target: 'documented' },
      { item: 15, title: 'SSL enforcement', query: "psycopg2.connect(..., sslmode='require')", target: 'sslmode = require' },
      { item: 16, title: 'Per-request RLS context', query: "SET app.current_user_email = 'user@example.com'  -- per connection", target: 'SET on each checkout' },
      { item: 17, title: 'Pool max connections', query: 'pool_max >= 20 (configurable via POOL_MAX env var)', target: '>= 20' },
      { item: 18, title: 'Graceful shutdown', query: 'pool.closeall()  -- on FastAPI lifespan exit', target: 'cleanup on exit' },
    ],
  },
  {
    key: 'rls', label: 'Row-Level Security (19-26)', icon: <KeyOutlined />, color: '#fa8c16',
    description: 'Validates Postgres RLS policies that enforce country-based data isolation. Admins bypass RLS; country managers see only their assigned countries.',
    steps: [
      { item: 19, title: 'RLS enabled on form_ap_active', query: "SELECT relrowsecurity FROM pg_class WHERE relname = 'form_ap_active'", target: 'true' },
      { item: 20, title: 'RLS enabled on participants_active', query: "SELECT relrowsecurity FROM pg_class WHERE relname = 'participants_active'", target: 'true' },
      { item: 21, title: 'SELECT policy filters by country', query: "-- As country_manager:\nSELECT COUNT(*) FROM form_ap_active  -- returns filtered count\n-- vs admin: returns full count", target: 'cm_count < admin_count' },
      { item: 22, title: 'INSERT policy enforces country', query: "CREATE POLICY form_ap_insert_policy ON form_ap_active FOR INSERT\n  WITH CHECK (is_admin_user() OR location_country IN\n    (SELECT jsonb_array_elements_text(get_user_country_access())))", target: 'policy exists' },
      { item: 23, title: 'UPDATE policy enforces country', query: "CREATE POLICY form_ap_update_policy ON form_ap_active FOR UPDATE\n  USING (is_admin_user() OR location_country IN (...))", target: 'policy exists' },
      { item: 24, title: 'DELETE restricted to admin', query: "SELECT policyname FROM pg_policies\n  WHERE tablename = 'form_ap_active' AND cmd = 'DELETE'", target: 'policy exists' },
      { item: 25, title: 'Admin bypass (sees all)', query: "-- As admin: SELECT COUNT(*) = total_records\nCREATE FUNCTION is_admin_user() RETURNS BOOLEAN\n  -- returns true for admin, global_reviewer", target: 'admin_count = total' },
      { item: 26, title: 'Helper function exists', query: "SELECT proname FROM pg_proc WHERE proname = 'get_user_country_access'", target: 'function exists' },
    ],
  },
  {
    key: 'integrity', label: 'Data Integrity (27-35)', icon: <SafetyOutlined />, color: '#52c41a',
    description: 'Checks database constraints: UUID PKs, foreign keys, ENUM types, CHECK constraints, UNIQUE constraints, triggers, and soft-delete pattern.',
    steps: [
      { item: 27, title: 'UUID primary keys', query: "SELECT form_ap_id FROM form_ap_active LIMIT 1\n-- verify: len=36, format=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", target: 'valid UUID format' },
      { item: 28, title: 'FK: form → users', query: "SELECT conname FROM pg_constraint\n  WHERE conrelid = 'form_ap_active'::regclass AND contype = 'f'\n  -- expect: fk_form_created_by", target: 'FK exists' },
      { item: 29, title: 'FK: participants → form', query: "SELECT conname FROM pg_constraint\n  WHERE conrelid = 'participants_active'::regclass AND contype = 'f'\n  -- expect: participants_active_form_ap_id_fkey", target: 'FK exists' },
      { item: 30, title: 'FK: sessions → users', query: "SELECT conname FROM pg_constraint\n  WHERE conrelid = 'user_sessions'::regclass AND contype = 'f'", target: 'FK exists' },
      { item: 31, title: 'ENUM types exist', query: "SELECT typname FROM pg_type\n  WHERE typname IN ('form_status', 'participant_role', 'user_role', 'audit_action')", target: '4 enums found' },
      { item: 32, title: 'CHECK constraint', query: "INSERT INTO form_ap_active (..., fiscal_year=1999, ...)\n  -- expect: ERROR: violates check constraint\n  -- constraint: fiscal_year >= 2000 AND fiscal_year <= 2100", target: 'CheckViolation raised' },
      { item: 33, title: 'UNIQUE constraint', query: "INSERT INTO users (email='existing@email.com', ...)\n  -- expect: ERROR: violates unique constraint \"users_email_key\"", target: 'UniqueViolation raised' },
      { item: 34, title: 'updated_at trigger', query: "SELECT tgname FROM pg_trigger\n  WHERE tgname = 'update_form_ap_updated_at'\n  -- fires: BEFORE UPDATE, sets updated_at = NOW()", target: 'trigger exists' },
      { item: 35, title: 'Soft delete columns', query: "SELECT column_name FROM information_schema.columns\n  WHERE table_name = 'form_ap_active'\n  AND column_name IN ('deleted_at', 'deleted_by')", target: 'both columns exist' },
    ],
  },
  {
    key: 'indexes', label: 'Index Coverage (36-45)', icon: <DatabaseOutlined />, color: '#eb2f96',
    description: 'Verifies all 21 B-tree indexes exist and that EXPLAIN plans show Index Scan (not Seq Scan) for key query patterns.',
    steps: [
      { item: 36, title: 'idx_form_ap_country', query: "EXPLAIN (FORMAT JSON)\n  SELECT * FROM form_ap_active WHERE location_country = 'USA'\n  -- expect: Index Scan using idx_form_ap_country", target: 'Index Scan' },
      { item: 37, title: 'idx_form_ap_status', query: "CREATE INDEX idx_form_ap_status ON form_ap_active(status)", target: 'index exists' },
      { item: 38, title: 'idx_form_ap_fiscal_year', query: "CREATE INDEX idx_form_ap_fiscal_year ON form_ap_active(fiscal_year)", target: 'index exists' },
      { item: 39, title: 'idx_form_ap_country_status', query: "EXPLAIN (FORMAT JSON)\n  SELECT * FROM form_ap_active\n  WHERE location_country = 'USA' AND status = 'approved'\n  -- expect: Bitmap Index Scan on idx_form_ap_country_status", target: 'Index Scan' },
      { item: 40, title: 'idx_form_ap_country_year', query: "CREATE INDEX idx_form_ap_country_year ON form_ap_active(location_country, fiscal_year)", target: 'index exists' },
      { item: 41, title: 'idx_form_ap_deleted (partial)', query: "CREATE INDEX idx_form_ap_deleted ON form_ap_active(deleted_at)\n  WHERE deleted_at IS NULL  -- partial index for soft-delete", target: 'index exists' },
      { item: 42, title: 'idx_participant_form', query: "EXPLAIN (FORMAT JSON)\n  SELECT * FROM participants_active WHERE form_ap_id = $1\n  -- expect: Index Scan using idx_participant_form", target: 'Index Scan' },
      { item: 43, title: 'idx_participant_country', query: "CREATE INDEX idx_participant_country ON participants_active(country)", target: 'index exists' },
      { item: 44, title: 'idx_participant_firm', query: "CREATE INDEX idx_participant_firm ON participants_active(firm_id)", target: 'index exists' },
      { item: 45, title: 'idx_audit_user_timestamp', query: "EXPLAIN (FORMAT JSON)\n  SELECT * FROM audit_log_recent\n  WHERE user_email = 'x' AND timestamp > '2025-01-01'\n  -- expect: Index Scan on idx_audit_user_timestamp", target: 'Index Scan' },
    ],
  },
];

const EvalRunner: React.FC = () => {
  const [results, setResults] = useState<Record<string, EvalResult[]>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Record<string, number>>({});
  const [concurrencyUsers, setConcurrencyUsers] = useState(50);

  const categories: EvalCategory[] = CATEGORY_DEFS.map(def => ({
    ...def,
    label: def.key === 'read' ? `Read Performance (1-6) \u00d7${concurrencyUsers}` :
           def.key === 'write' ? `Write Performance (7-11) \u00d7${concurrencyUsers}` : def.label,
    action: def.key === 'read' ? () => evalApi.readPerformance(concurrencyUsers) :
            def.key === 'write' ? () => evalApi.writePerformance(concurrencyUsers) :
            def.key === 'pool' ? () => evalApi.poolStats() :
            def.key === 'rls' ? () => evalApi.rlsCheck() :
            def.key === 'integrity' ? () => evalApi.integrityCheck() :
            () => evalApi.indexCheck(),
  }));

  const runCategory = async (cat: EvalCategory) => {
    setRunning(cat.key);
    // Animate through steps
    const stepCount = cat.steps.length;
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        const cur = prev[cat.key] || 0;
        return { ...prev, [cat.key]: cur < stepCount - 1 ? cur + 1 : cur };
      });
    }, 800);

    try {
      setCurrentStep(prev => ({ ...prev, [cat.key]: 0 }));
      const res = await cat.action();
      setResults(prev => ({ ...prev, [cat.key]: res.data }));
      const passed = res.data.filter(r => r.passed).length;
      message.success(`${cat.label}: ${passed}/${res.data.length} passed`);
    } catch (e: any) {
      message.error(`${cat.label} failed: ${e.message}`);
    } finally {
      clearInterval(interval);
      setCurrentStep(prev => ({ ...prev, [cat.key]: -1 }));
      setRunning(null);
    }
  };

  const runAll = async () => {
    for (const cat of categories) {
      await runCategory(cat);
    }
  };

  const resultColumns = [
    { title: '#', dataIndex: 'item_number', key: 'num', width: 40 },
    { title: 'Description', dataIndex: 'description', key: 'desc' },
    { title: 'Result', dataIndex: 'passed', key: 'result', width: 80,
      render: (p: boolean) => p ? <Tag color="success" icon={<CheckCircleOutlined />}>PASS</Tag>
        : <Tag color="error" icon={<CloseCircleOutlined />}>FAIL</Tag> },
    { title: 'Measured', dataIndex: 'measured_value', key: 'val', width: 220,
      render: (v: any) => {
        if (typeof v === 'number') return <Text strong>{v.toFixed(2)} ms</Text>;
        if (typeof v === 'object' && v !== null && 'p95' in v) {
          return (
            <span style={{ fontSize: 11 }}>
              <Text strong>p95: {v.p95}ms</Text>
              {' · '}p50: {v.p50}ms · p99: {v.p99}ms
              <br />
              <Text type="secondary">{v.iterations} iters · {v.errors} errs</Text>
            </span>
          );
        }
        if (typeof v === 'object') return <Text code style={{ fontSize: 11 }}>{JSON.stringify(v).slice(0, 80)}</Text>;
        return <Text style={{ fontSize: 12 }}>{String(v).slice(0, 50)}</Text>;
      }},
    { title: 'Target', dataIndex: 'target_value', key: 'target', width: 100,
      render: (v: any) => {
        if (typeof v === 'object' && v !== null && 'p95_target' in v)
          return <Text type="secondary">{`p95 < ${v.p95_target}ms`}</Text>;
        return typeof v === 'number' ? <Text type="secondary">{`< ${v}ms`}</Text> :
          <Text type="secondary">{String(v === true ? 'true' : v).slice(0, 20)}</Text>;
      }},
  ];

  const allResults = Object.values(results).flat();
  const totalItems = allResults.length;
  const totalPassed = allResults.filter(r => r.passed).length;
  const totalFailed = totalItems - totalPassed;
  const passRate = totalItems > 0 ? Math.round(totalPassed / totalItems * 1000) / 10 : 0;

  const categoryColors: Record<string, string> = {
    read: '#1677ff', write: '#722ed1', pool: '#13c2c2',
    rls: '#fa8c16', integrity: '#52c41a', indexes: '#eb2f96',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Lakebase OLTP Evaluation</Title>
        <Space>
          <Text>Concurrent users:</Text>
          <InputNumber min={10} max={200} value={concurrencyUsers}
            onChange={(v) => setConcurrencyUsers(v || 50)} />
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={runAll}
            loading={running !== null} size="large">
            Run All
          </Button>
        </Space>
      </div>

      {totalItems > 0 && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Total Items" value={totalItems} prefix={<RocketOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Passed" value={totalPassed} valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="Failed" value={totalFailed}
                  valueStyle={{ color: totalFailed > 0 ? '#ff4d4f' : '#52c41a' }}
                  prefix={<CloseCircleOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <Progress type="circle" percent={passRate} size={64}
                    strokeColor={passRate >= 90 ? '#52c41a' : passRate >= 70 ? '#faad14' : '#ff4d4f'} />
                  <div style={{ marginTop: 4 }}><Text strong>Pass Rate</Text></div>
                </div>
              </Card>
            </Col>
          </Row>
          <Row gutter={8} style={{ marginBottom: 24 }}>
            {categories.filter(c => results[c.key]).map(cat => {
              const catResults = results[cat.key];
              const p = catResults.filter(r => r.passed).length;
              const t = catResults.length;
              return (
                <Col span={4} key={cat.key}>
                  <Card size="small" style={{ borderTop: `3px solid ${categoryColors[cat.key] || '#1677ff'}` }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>{cat.icon} <Text strong style={{ fontSize: 12 }}>{cat.key}</Text></Space>
                      <Progress percent={Math.round(p / t * 100)} size="small"
                        strokeColor={categoryColors[cat.key]} />
                      <Text type="secondary" style={{ fontSize: 11 }}>{p}/{t} passed</Text>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </>
      )}

      <Row gutter={[16, 16]}>
        {categories.map(cat => {
          const isRunning = running === cat.key;
          const hasResults = !!results[cat.key];
          const step = currentStep[cat.key] ?? -1;
          const passedCount = hasResults ? results[cat.key].filter(r => r.passed).length : 0;
          const totalCount = hasResults ? results[cat.key].length : 0;

          return (
            <Col xs={24} md={12} key={cat.key}>
              <Card
                title={
                  <Space>
                    {cat.icon}
                    <span>{cat.label}</span>
                    {hasResults && (
                      <Tag color={passedCount === totalCount ? 'success' : 'warning'}>
                        {passedCount}/{totalCount}
                      </Tag>
                    )}
                  </Space>
                }
                extra={
                  <Button type="primary" size="small" onClick={() => runCategory(cat)}
                    loading={isRunning} style={{ background: cat.color, borderColor: cat.color }}>
                    {isRunning ? 'Running...' : 'Run'}
                  </Button>
                }
                size="small"
                style={{ borderTop: `3px solid ${cat.color}` }}
              >
                {/* Description */}
                <Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
                  {cat.description}
                </Paragraph>

                {/* Running state: show steps with current query */}
                {isRunning && (
                  <div style={{ marginBottom: 16 }}>
                    <Steps
                      current={step}
                      size="small"
                      direction="vertical"
                      items={cat.steps.map((s, idx) => ({
                        title: <Text style={{ fontSize: 12 }}>{`#${s.item}: ${s.title}`}</Text>,
                        description: idx === step ? (
                          <div style={{
                            background: '#f6f8fa', borderRadius: 4, padding: '6px 10px',
                            fontFamily: 'monospace', fontSize: 11, marginTop: 4,
                            borderLeft: `3px solid ${cat.color}`,
                          }}>
                            <div style={{ color: '#666', marginBottom: 2 }}>
                              <CodeOutlined /> Running:
                            </div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#333' }}>
                              {s.query}
                            </pre>
                            <div style={{ color: '#999', marginTop: 4 }}>
                              Target: {s.target}
                            </div>
                          </div>
                        ) : null,
                        icon: idx === step ? <LoadingOutlined style={{ color: cat.color }} /> :
                              idx < step ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : undefined,
                      }))}
                    />
                  </div>
                )}

                {/* Results table */}
                {!isRunning && hasResults && (
                  <Table dataSource={results[cat.key]} columns={resultColumns}
                    rowKey="item_number" size="small" pagination={false}
                    expandable={{
                      expandedRowRender: (record) => {
                        const stepDef = cat.steps.find(s => s.item === record.item_number);
                        return stepDef ? (
                          <div style={{
                            background: '#f6f8fa', borderRadius: 4, padding: '8px 12px',
                            fontFamily: 'monospace', fontSize: 11,
                          }}>
                            <div style={{ color: '#666', marginBottom: 4 }}>
                              <CodeOutlined /> Query / Check:
                            </div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#333' }}>
                              {stepDef.query}
                            </pre>
                          </div>
                        ) : null;
                      },
                      rowExpandable: (record) => !!cat.steps.find(s => s.item === record.item_number),
                    }}
                  />
                )}

                {/* Idle state: show what will run */}
                {!isRunning && !hasResults && (
                  <Collapse ghost size="small">
                    <Panel header={<Text type="secondary" style={{ fontSize: 12 }}>
                      <CodeOutlined /> {cat.steps.length} evaluation items — click to preview
                    </Text>} key="preview">
                      {cat.steps.map(s => (
                        <div key={s.item} style={{ marginBottom: 12 }}>
                          <Text strong style={{ fontSize: 12 }}>#{s.item}: {s.title}</Text>
                          <Tag style={{ marginLeft: 8, fontSize: 10 }}>{s.target}</Tag>
                          <pre style={{
                            background: '#f6f8fa', borderRadius: 4, padding: '6px 10px',
                            fontFamily: 'monospace', fontSize: 11, marginTop: 4,
                            borderLeft: `3px solid ${cat.color}`, whiteSpace: 'pre-wrap',
                          }}>
                            {s.query}
                          </pre>
                        </div>
                      ))}
                    </Panel>
                  </Collapse>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

export default EvalRunner;
