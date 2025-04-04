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
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface NetworkInterface {
  id: number;
  name: string;
  type: string;
  ipAddress: string;
  subnetMask: string;
  gateway: string;
  dnsServers: string[];
  isDhcp: boolean;
  isEnabled: boolean;
  macAddress: string;
  speed: string;
  status: string;
}

interface NetworkSettings {
  hostname: string;
  domain: string;
  interfaces: NetworkInterface[];
  ipAddress: string;
  subnetMask: string;
  gateway: string;
  dnsServers: string[];
  dhcpEnabled: boolean;
}

const NetworkSettings: React.FC = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingInterface, setEditingInterface] = useState<NetworkInterface | null>(null);
  const [formData, setFormData] = useState<NetworkInterface>({
    id: 0,
    name: '',
    type: 'ethernet',
    ipAddress: '',
    subnetMask: '',
    gateway: '',
    dnsServers: [],
    isDhcp: false,
    isEnabled: true,
    macAddress: '',
    speed: '',
    status: 'up',
  });
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const { data: settings, isLoading } = useQuery<NetworkSettings>({
    queryKey: ['networkSettings'],
    queryFn: async () => {
      const response = await axios.get('http://localhost:5000/api/settings/network');
      return response.data;
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: NetworkSettings) =>
      axios.put('http://localhost:5000/api/settings/network', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networkSettings'] });
      setSuccess('Network settings updated successfully');
      setError('');
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Failed to update network settings');
      setSuccess('');
    },
  });

  const updateInterfaceMutation = useMutation({
    mutationFn: (data: NetworkInterface) =>
      axios.put(`/api/network/interfaces/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networkSettings'] });
      setOpenDialog(false);
      setEditingInterface(null);
    },
  });

  const handleOpenDialog = (networkInterface?: NetworkInterface) => {
    if (networkInterface) {
      setEditingInterface(networkInterface);
      setFormData(networkInterface);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingInterface(null);
  };

  const handleInterfaceSubmit = () => {
    updateInterfaceMutation.mutate(formData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data: NetworkSettings = {
      hostname: formData.get('hostname') as string,
      domain: formData.get('domain') as string,
      ipAddress: formData.get('ipAddress') as string,
      subnetMask: formData.get('subnetMask') as string,
      gateway: formData.get('gateway') as string,
      dnsServers: (formData.get('dnsServers') as string).split(',').map(s => s.trim()),
      dhcpEnabled: formData.get('dhcpEnabled') === 'true',
      interfaces: settings?.interfaces || [],
    };
    updateSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Network Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Hostname"
                  name="hostname"
                  defaultValue={settings?.hostname}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Domain"
                  name="domain"
                  defaultValue={settings?.domain}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      name="dhcpEnabled"
                      defaultChecked={settings?.dhcpEnabled}
                    />
                  }
                  label="Enable DHCP"
                />
              </Grid>
              {!settings?.dhcpEnabled && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="IP Address"
                      name="ipAddress"
                      defaultValue={settings?.ipAddress}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Subnet Mask"
                      name="subnetMask"
                      defaultValue={settings?.subnetMask}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Gateway"
                      name="gateway"
                      defaultValue={settings?.gateway}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="DNS Servers"
                      name="dnsServers"
                      defaultValue={settings?.dnsServers.join(', ')}
                      helperText="Separate multiple DNS servers with commas"
                    />
                  </Grid>
                </>
              )}
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={updateSettingsMutation.isLoading}
                >
                  {updateSettingsMutation.isLoading ? 'Saving...' : 'Save Settings'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      <Typography variant="h5" gutterBottom>
        Network Interfaces
      </Typography>

      <Grid container spacing={3}>
        {settings?.interfaces.map((networkInterface) => (
          <Grid item xs={12} md={6} key={networkInterface.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">{networkInterface.name}</Typography>
                  <Chip
                    label={networkInterface.status}
                    color={networkInterface.status === 'up' ? 'success' : 'error'}
                  />
                </Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {networkInterface.type.toUpperCase()} • {networkInterface.speed}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  MAC: {networkInterface.macAddress}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2">
                  IP Address: {networkInterface.ipAddress}
                  <br />
                  Subnet Mask: {networkInterface.subnetMask}
                  <br />
                  Gateway: {networkInterface.gateway}
                  <br />
                  DNS: {networkInterface.dnsServers.join(', ')}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Chip
                    label={networkInterface.isDhcp ? 'DHCP' : 'Static'}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label={networkInterface.isEnabled ? 'Enabled' : 'Disabled'}
                    color={networkInterface.isEnabled ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
              </CardContent>
              <CardActions>
                <Button
                  startIcon={<EditIcon />}
                  onClick={() => handleOpenDialog(networkInterface)}
                >
                  Edit
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingInterface ? 'Edit Network Interface' : 'New Network Interface'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Interface Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Type"
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <MenuItem value="ethernet">Ethernet</MenuItem>
                  <MenuItem value="wifi">WiFi</MenuItem>
                  <MenuItem value="bond">Bond</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isDhcp}
                    onChange={(e) => setFormData({ ...formData, isDhcp: e.target.checked })}
                  />
                }
                label="Use DHCP"
              />
            </Grid>
            {!formData.isDhcp && (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="IP Address"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Subnet Mask"
                    value={formData.subnetMask}
                    onChange={(e) => setFormData({ ...formData, subnetMask: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Gateway"
                    value={formData.gateway}
                    onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="DNS Servers"
                    value={formData.dnsServers.join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dnsServers: e.target.value.split(',').map((s) => s.trim()),
                      })
                    }
                    helperText="Separate multiple DNS servers with commas"
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                  />
                }
                label="Enable Interface"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<CancelIcon />}>
            Cancel
          </Button>
          <Button
            onClick={handleInterfaceSubmit}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NetworkSettings; 