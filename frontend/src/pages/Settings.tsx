import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Divider,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  Snackbar,
  Card,
  CardContent,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material'
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  NetworkCheck as NetworkIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

interface SystemSettings {
  hostname: string
  timezone: string
  autoUpdate: boolean
  sshEnabled: boolean
  sshPort: number
}

interface NetworkSettings {
  ipAddress: string
  subnet: string
  gateway: string
  dns: string[]
  dhcpEnabled: boolean
}

interface StorageSettings {
  raidLevel: string
  autoRepair: boolean
  smartMonitoring: boolean
  backupEnabled: boolean
  backupSchedule: string
}

export default function Settings() {
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    hostname: '',
    timezone: '',
    autoUpdate: true,
    sshEnabled: true,
    sshPort: 22,
  })

  const [networkSettings, setNetworkSettings] = useState<NetworkSettings>({
    ipAddress: '',
    subnet: '',
    gateway: '',
    dns: [''],
    dhcpEnabled: true,
  })

  const [storageSettings, setStorageSettings] = useState<StorageSettings>({
    raidLevel: 'raid1',
    autoRepair: true,
    smartMonitoring: true,
    backupEnabled: false,
    backupSchedule: '0 0 * * *',
  })

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  })

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await axios.get('/api/settings')
      return response.data
    },
    onSuccess: (data) => {
      setSystemSettings(data.system)
      setNetworkSettings(data.network)
      setStorageSettings(data.storage)
    },
  })

  const handleSaveSettings = async () => {
    try {
      await axios.post('/api/settings', {
        system: systemSettings,
        network: networkSettings,
        storage: storageSettings,
      })
      setSnackbar({
        open: true,
        message: 'Settings saved successfully',
        severity: 'success',
      })
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save settings',
        severity: 'error',
      })
    }
  }

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false })
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        System Settings
      </Typography>

      <Grid container spacing={3}>
        {/* System Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SecurityIcon sx={{ mr: 1 }} />
                <Typography variant="h6">System Configuration</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Hostname"
                  fullWidth
                  value={systemSettings.hostname}
                  onChange={(e) =>
                    setSystemSettings({ ...systemSettings, hostname: e.target.value })
                  }
                />
                <TextField
                  label="Timezone"
                  fullWidth
                  value={systemSettings.timezone}
                  onChange={(e) =>
                    setSystemSettings({ ...systemSettings, timezone: e.target.value })
                  }
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={systemSettings.autoUpdate}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          autoUpdate: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Enable Automatic Updates"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={systemSettings.sshEnabled}
                      onChange={(e) =>
                        setSystemSettings({
                          ...systemSettings,
                          sshEnabled: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Enable SSH Access"
                />
                <TextField
                  label="SSH Port"
                  type="number"
                  value={systemSettings.sshPort}
                  onChange={(e) =>
                    setSystemSettings({
                      ...systemSettings,
                      sshPort: parseInt(e.target.value),
                    })
                  }
                  disabled={!systemSettings.sshEnabled}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Network Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <NetworkIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Network Configuration</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={networkSettings.dhcpEnabled}
                      onChange={(e) =>
                        setNetworkSettings({
                          ...networkSettings,
                          dhcpEnabled: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Enable DHCP"
                />
                <TextField
                  label="IP Address"
                  fullWidth
                  value={networkSettings.ipAddress}
                  onChange={(e) =>
                    setNetworkSettings({ ...networkSettings, ipAddress: e.target.value })
                  }
                  disabled={networkSettings.dhcpEnabled}
                />
                <TextField
                  label="Subnet Mask"
                  fullWidth
                  value={networkSettings.subnet}
                  onChange={(e) =>
                    setNetworkSettings({ ...networkSettings, subnet: e.target.value })
                  }
                  disabled={networkSettings.dhcpEnabled}
                />
                <TextField
                  label="Gateway"
                  fullWidth
                  value={networkSettings.gateway}
                  onChange={(e) =>
                    setNetworkSettings({ ...networkSettings, gateway: e.target.value })
                  }
                  disabled={networkSettings.dhcpEnabled}
                />
                <TextField
                  label="DNS Servers"
                  fullWidth
                  value={networkSettings.dns.join(', ')}
                  onChange={(e) =>
                    setNetworkSettings({
                      ...networkSettings,
                      dns: e.target.value.split(',').map((s) => s.trim()),
                    })
                  }
                  helperText="Separate multiple DNS servers with commas"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Storage Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <StorageIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Storage Configuration</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>RAID Level</InputLabel>
                  <Select
                    value={storageSettings.raidLevel}
                    label="RAID Level"
                    onChange={(e) =>
                      setStorageSettings({
                        ...storageSettings,
                        raidLevel: e.target.value,
                      })
                    }
                  >
                    <MenuItem value="raid0">RAID 0 (Striping)</MenuItem>
                    <MenuItem value="raid1">RAID 1 (Mirroring)</MenuItem>
                    <MenuItem value="raid5">RAID 5 (Striping with Parity)</MenuItem>
                    <MenuItem value="raid10">RAID 10 (Striping and Mirroring)</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Switch
                      checked={storageSettings.autoRepair}
                      onChange={(e) =>
                        setStorageSettings({
                          ...storageSettings,
                          autoRepair: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Enable Automatic RAID Repair"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={storageSettings.smartMonitoring}
                      onChange={(e) =>
                        setStorageSettings({
                          ...storageSettings,
                          smartMonitoring: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Enable S.M.A.R.T. Monitoring"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={storageSettings.backupEnabled}
                      onChange={(e) =>
                        setStorageSettings({
                          ...storageSettings,
                          backupEnabled: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Enable Automated Backups"
                />
                <TextField
                  label="Backup Schedule (cron format)"
                  fullWidth
                  value={storageSettings.backupSchedule}
                  onChange={(e) =>
                    setStorageSettings({
                      ...storageSettings,
                      backupSchedule: e.target.value,
                    })
                  }
                  disabled={!storageSettings.backupEnabled}
                  helperText="Example: 0 0 * * * (daily at midnight)"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            if (settings) {
              setSystemSettings(settings.system)
              setNetworkSettings(settings.network)
              setStorageSettings(settings.storage)
            }
          }}
        >
          Reset Changes
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveSettings}
        >
          Save Settings
        </Button>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
} 