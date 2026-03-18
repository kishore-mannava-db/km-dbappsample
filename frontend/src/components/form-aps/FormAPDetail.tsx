import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Button, Space, Spin, Alert, Tag, Modal, Form, Input, Select, message, Table, Typography } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { formApApi, participantApi } from '../../services/api';
import type { FormAP, Participant, FormStatus } from '../../types';
import LatencyBadge from '../common/LatencyBadge';

const { Title } = Typography;

const statusColors: Record<FormStatus, string> = {
  draft: 'default', submitted: 'processing', under_review: 'warning',
  approved: 'success', rejected: 'error', archived: 'purple',
};

const FormAPDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [formAp, setFormAp] = useState<FormAP | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      formApApi.get(id),
      participantApi.list({ form_ap_id: id, page_size: 100 }),
    ]).then(([fRes, pRes]) => {
      setFormAp(fRes.data);
      setParticipants(pRes.data.items);
    }).catch(() => message.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleUpdate = async (values: any) => {
    if (!id) return;
    const res = await formApApi.update(id, values);
    setFormAp(res.data);
    setEditing(false);
    message.success('Updated');
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete this Form AP?',
      onOk: async () => { if (id) { await formApApi.delete(id); message.success('Deleted'); navigate('/form-aps'); } },
    });
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!formAp) return <Alert type="error" message="Not found" />;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/form-aps')}>Back</Button>
        <Button icon={<EditOutlined />} onClick={() => { setEditing(true); form.setFieldsValue(formAp); }}>Edit</Button>
        <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>Delete</Button>
        <LatencyBadge latencyMs={formAp.query_latency_ms} />
      </Space>
      <Card>
        <Title level={4}>{formAp.issuer_id} <Tag color={statusColors[formAp.status]}>{formAp.status}</Tag></Title>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Form AP ID">{formAp.form_ap_id}</Descriptions.Item>
          <Descriptions.Item label="Fiscal Year">{formAp.fiscal_year}</Descriptions.Item>
          <Descriptions.Item label="Country">{formAp.location_country}</Descriptions.Item>
          <Descriptions.Item label="Created">{new Date(formAp.created_at).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="Updated">{new Date(formAp.updated_at).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="Created By">{formAp.created_by}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title={`Participants (${participants.length})`} style={{ marginTop: 16 }} size="small">
        <Table dataSource={participants} rowKey="participant_id" size="small" pagination={false}
          columns={[
            { title: 'Firm', dataIndex: 'firm_name', key: 'firm' },
            { title: 'Role', dataIndex: 'role', key: 'role', render: (r: string) => <Tag>{r.replace(/_/g,' ')}</Tag> },
            { title: 'Country', dataIndex: 'country', key: 'country' },
          ]}
        />
      </Card>
      <Modal title="Edit Form AP" open={editing} onCancel={() => setEditing(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="issuer_id" label="Issuer ID"><Input /></Form.Item>
          <Form.Item name="fiscal_year" label="Fiscal Year"><Input type="number" /></Form.Item>
          <Form.Item name="location_country" label="Country"><Input maxLength={3} /></Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={['draft','submitted','under_review','approved','rejected','archived'].map(s => ({label: s, value: s}))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FormAPDetail;
