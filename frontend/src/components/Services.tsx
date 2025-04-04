import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  RestartAlt as RestartIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Service {
  id: number;
  name: string;
  displayName: string;
  description: string;
  status: 'running' | 'stopped' | 'error';
  isEnabled: boolean;
  startType: 'automatic' | 'manual' | 'disabled';
  config: Record<string, any>;
  lastStarted: string;
  pid?: number;
  memoryUsage?: string;
  cpuUsage?: string;
}

const Services: React.FC = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const queryClient = useQueryClient();

  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await axios.get('/api/services');
      return response.data;
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Service> }) =>
      axios.put(`/api/services/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const controlServiceMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'start' | 'stop' | 'restart' }) =>
      axios.post(`/api/services/${id}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const handleOpenDialog = (service: Service) => {
    setSelectedService(service);
    setFormData(service.config || {});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedService(null);
    setFormData({});
  };

  const handleServiceControl = (serviceId: number, action: 'start' | 'stop' | 'restart') => {
    controlServiceMutation.mutate({ id: serviceId, action });
  };

  const handleConfigSubmit = () => {
    if (selectedService) {
      updateServiceMutation.mutate({
        id: selectedService.id,
        data: { config: formData },
      });
      handleCloseDialog();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'default';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        System Services
      </Typography>

      <List>
        {services?.map((service: Service) => (
          <Card key={service.id} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6">{service.displayName}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {service.description}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={service.status}
                    color={getStatusColor(service.status)}
                    size="small"
                  />
                  <Chip
                    label={service.startType}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    <strong>Last Started:</strong> {new Date(service.lastStarted).toLocaleString()}
                  </Typography>
                  {service.pid && (
                    <Typography variant="body2">
                      <strong>PID:</strong> {service.pid}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  {service.memoryUsage && (
                    <Typography variant="body2">
                      <strong>Memory Usage:</strong> {service.memoryUsage}
                    </Typography>
                  )}
                  {service.cpuUsage && (
                    <Typography variant="body2">
                      <strong>CPU Usage:</strong> {service.cpuUsage}
                    </Typography>
                  )}
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Tooltip title="Start Service">
                  <IconButton
                    onClick={() => handleServiceControl(service.id, 'start')}
                    disabled={service.status === 'running'}
                  >
                    <PlayArrowIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Stop Service">
                  <IconButton
                    onClick={() => handleServiceControl(service.id, 'stop')}
                    disabled={service.status === 'stopped'}
                  >
                    <StopIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Restart Service">
                  <IconButton onClick={() => handleServiceControl(service.id, 'restart')}>
                    <RestartIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Configure Service">
                  <IconButton onClick={() => handleOpenDialog(service)}>
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
                <FormControlLabel
                  control={
                    <Switch
                      checked={service.isEnabled}
                      onChange={(e) =>
                        updateServiceMutation.mutate({
                          id: service.id,
                          data: { isEnabled: e.target.checked },
                        })
                      }
                    />
                  }
                  label="Enabled"
                />
              </Box>
            </CardContent>
          </Card>
        ))}
      </List>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Configure {selectedService?.displayName}
        </DialogTitle>
        <DialogContent>
          {selectedService && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {selectedService.description}
              </Typography>
              <Divider sx={{ my: 2 }} />
              {Object.entries(selectedService.config || {}).map(([key, value]) => (
                <TextField
                  key={key}
                  fullWidth
                  label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                  value={formData[key] || ''}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  sx={{ mb: 2 }}
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleConfigSubmit} variant="contained">
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Services; 