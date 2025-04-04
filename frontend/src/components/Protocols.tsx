import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Protocol {
  id: number;
  name: string;
  displayName: string;
  description: string;
  port: number;
  status: 'running' | 'stopped';
  isEnabled: boolean;
  config: Record<string, any>;
  lastUpdated: string;
}

const Protocols: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('smb');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<Protocol>>({});
  
  const queryClient = useQueryClient();

  const { data: protocols, isLoading, error } = useQuery({
    queryKey: ['protocols'],
    queryFn: async () => {
      const response = await axios.get('/api/protocols');
      return response.data as Protocol[];
    },
  });

  const updateProtocolMutation = useMutation({
    mutationFn: (data: { name: string; protocol: Partial<Protocol> }) => {
      return axios.put(`/api/protocols/${data.name}`, data.protocol);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protocols'] });
      setIsEditing(false);
    },
  });

  const controlProtocolMutation = useMutation({
    mutationFn: (data: { name: string; action: 'start' | 'stop' | 'restart' }) => {
      return axios.post(`/api/protocols/${data.name}/${data.action}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protocols'] });
    },
  });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
    setIsEditing(false);
  };

  const handleEdit = (protocol: Protocol) => {
    setFormData({
      port: protocol.port,
      isEnabled: protocol.isEnabled,
      config: { ...protocol.config },
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
  };

  const handleSave = (protocol: Protocol) => {
    updateProtocolMutation.mutate({
      name: protocol.name,
      protocol: formData,
    });
  };

  const handleControlAction = (protocol: Protocol, action: 'start' | 'stop' | 'restart') => {
    controlProtocolMutation.mutate({ name: protocol.name, action });
  };

  const handleConfigChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Error loading protocols</Alert>
      </Box>
    );
  }

  const activeProtocol = protocols?.find((p) => p.name === activeTab);

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        File Sharing Protocols
      </Typography>
      
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        aria-label="file sharing protocols"
        sx={{ mb: 3 }}
      >
        {protocols?.map((protocol) => (
          <Tab
            key={protocol.name}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {protocol.displayName}
                <Chip
                  size="small"
                  label={protocol.status}
                  color={protocol.status === 'running' ? 'success' : 'default'}
                />
              </Box>
            }
            value={protocol.name}
          />
        ))}
      </Tabs>

      {activeProtocol && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5">{activeProtocol.displayName} Configuration</Typography>
              <Box>
                {!isEditing ? (
                  <Tooltip title="Edit Configuration">
                    <IconButton onClick={() => handleEdit(activeProtocol)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <>
                    <Tooltip title="Save Changes">
                      <IconButton 
                        color="primary" 
                        onClick={() => handleSave(activeProtocol)}
                        disabled={updateProtocolMutation.isLoading}
                      >
                        <SaveIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Cancel">
                      <IconButton onClick={handleCancel}>
                        <CancelIcon />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            </Box>

            <Typography variant="body1" gutterBottom>
              {activeProtocol.description}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Port"
                  type="number"
                  value={isEditing ? formData.port : activeProtocol.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                  disabled={!isEditing}
                  fullWidth
                  margin="normal"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={isEditing ? !!formData.isEnabled : activeProtocol.isEnabled}
                      onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                      disabled={!isEditing}
                    />
                  }
                  label={`${activeProtocol.displayName} Enabled`}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Status: <Chip label={activeProtocol.status} color={activeProtocol.status === 'running' ? 'success' : 'default'} />
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last Updated: {new Date(activeProtocol.lastUpdated).toLocaleString()}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => handleControlAction(activeProtocol, 'start')}
                    disabled={activeProtocol.status === 'running' || controlProtocolMutation.isLoading}
                  >
                    Start
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<StopIcon />}
                    onClick={() => handleControlAction(activeProtocol, 'stop')}
                    disabled={activeProtocol.status === 'stopped' || controlProtocolMutation.isLoading}
                  >
                    Stop
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => handleControlAction(activeProtocol, 'restart')}
                    disabled={controlProtocolMutation.isLoading}
                  >
                    Restart
                  </Button>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Protocol Settings
            </Typography>

            <Grid container spacing={2}>
              {Object.entries(isEditing ? formData.config || {} : activeProtocol.config || {}).map(
                ([key, value]) => {
                  // Skip the shares object as it's handled separately
                  if (key === 'shares') return null;
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} key={key}>
                      {typeof value === 'boolean' ? (
                        <FormControlLabel
                          control={
                            <Switch
                              checked={value}
                              onChange={(e) =>
                                handleConfigChange(key, e.target.checked)
                              }
                              disabled={!isEditing}
                            />
                          }
                          label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        />
                      ) : (
                        <TextField
                          label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          value={value}
                          onChange={(e) => handleConfigChange(key, e.target.value)}
                          disabled={!isEditing}
                          fullWidth
                          margin="normal"
                        />
                      )}
                    </Grid>
                  );
                }
              )}
            </Grid>
          </CardContent>
          
          <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
            {isEditing && (
              <>
                <Button onClick={handleCancel}>Cancel</Button>
                <Button
                  variant="contained"
                  onClick={() => handleSave(activeProtocol)}
                  disabled={updateProtocolMutation.isLoading}
                >
                  {updateProtocolMutation.isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            )}
          </CardActions>
        </Card>
      )}
    </Box>
  );
};

export default Protocols; 