import React from 'react';
import { Tag, Space, Typography } from 'antd';
const { Text } = Typography;

interface LatencyBadgeProps {
  latencyMs?: number;
}

const LatencyBadge: React.FC<LatencyBadgeProps> = ({ latencyMs }) => {
  if (!latencyMs) return null;
  const color = latencyMs < 50 ? 'green' : latencyMs < 200 ? 'blue' : latencyMs < 500 ? 'orange' : 'red';
  return (
    <Space size={4}>
      <Tag color={color}>Lakebase</Tag>
      <Text type="secondary">{latencyMs.toFixed(1)} ms</Text>
    </Space>
  );
};

export default LatencyBadge;
