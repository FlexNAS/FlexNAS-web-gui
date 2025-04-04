import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  IconButton,
  Grid,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Backup {
  id: number;
  name: string;
  sourcePath: string;
  destinationPath: string;
  schedule: string;
  lastRun: string;
  nextRun: string;
  retentionDays: number;
  creator: string;
  createdAt: string;
  status: string;
  type: string;
}

const Backups: React.FC = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBackup, setEditingBackup] = useState<Backup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sourcePath: '',
    destinationPath: '',
    schedule: '',
    retentionDays: 30,
    type: 'incremental',
  });

  const queryClient = useQueryClient();

  const { data: backups, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const response = await axios.get('/api/backups');
      return response.data;
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: (data: typeof formData) => axios.post('/api/backups', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      setOpenDialog(false);
      setFormData({
        name: '',
        sourcePath: '',
        destinationPath: '',
        schedule: '',
        retentionDays: 30,
        type: 'incremental',
      });
    },
  });

  const updateBackupMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof formData }) =>
      axios.put(`/api/backups/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      setOpenDialog(false);
      setEditingBackup(null);
      setFormData({
        name: '',
        sourcePath: '',
        destinationPath: '',
        schedule: '',
        retentionDays: 30,
        type: 'incremental',
      });
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (id: number) => axios.delete(`/api/backups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });

  const runBackupMutation = useMutation({
    mutationFn: (id: number) => axios.post(`/api/backups/${id}/run`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });

  const handleOpenDialog = (backup?: Backup) => {
    if (backup) {
      setEditingBackup(backup);
      setFormData({
        name: backup.name,
        sourcePath: backup.sourcePath,
        destinationPath: backup.destinationPath,
        schedule: backup.schedule,
        retentionDays: backup.retentionDays,
        type: backup.type,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingBackup(null);
    setFormData({
      name: '',
      sourcePath: '',
      destinationPath: '',
      schedule: '',
      retentionDays: 30,
      type: 'incremental',
    });
  };

  const handleSubmit = () => {
    if (editingBackup) {
      updateBackupMutation.mutate({ id: editingBackup.id, data: formData });
    } else {
      createBackupMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Backup Jobs</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          New Backup
        </Button>
      </Box>

      <Grid container spacing={3}>
        {backups?.map((backup: Backup) => (
          <Grid item xs={12} sm={6} md={4} key={backup.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{backup.name}</Typography>
                <Typography color="textSecondary" gutterBottom>
                  {backup.type.charAt(0).toUpperCase() + backup.type.slice(1)} Backup
                </Typography>
                <Typography variant="body2" paragraph>
                  Source: {backup.sourcePath}
                  <br />
                  Destination: {backup.destinationPath}
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={backup.status}
                    color={backup.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                  {backup.schedule && (
                    <Chip
                      label={`Schedule: ${backup.schedule}`}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
                <Typography variant="body2" color="textSecondary">
                  Last Run: {new Date(backup.lastRun).toLocaleString()}
                  <br />
                  Next Run: {new Date(backup.nextRun).toLocaleString()}
                  <br />
                  Retention: {backup.retentionDays} days
                </Typography>
              </CardContent>
              <CardActions>
                <IconButton onClick={() => handleOpenDialog(backup)}>
                  <EditIcon />
                </IconButton>
                <IconButton onClick={() => runBackupMutation.mutate(backup.id)}>
                  <PlayArrowIcon />
                </IconButton>
                <IconButton onClick={() => deleteBackupMutation.mutate(backup.id)}>
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingBackup ? 'Edit Backup' : 'Create New Backup'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Backup Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Source Path"
            fullWidth
            value={formData.sourcePath}
            onChange={(e) =>
              setFormData({ ...formData, sourcePath: e.target.value })
            }
          />
          <TextField
            margin="dense"
            label="Destination Path"
            fullWidth
            value={formData.destinationPath}
            onChange={(e) =>
              setFormData({ ...formData, destinationPath: e.target.value })
            }
          />
          <TextField
            margin="dense"
            label="Schedule (Cron format)"
            fullWidth
            value={formData.schedule}
            onChange={(e) =>
              setFormData({ ...formData, schedule: e.target.value })
            }
            placeholder="0 0 * * *"
            helperText="Use cron format (e.g., 0 0 * * * for daily at midnight)"
          />
          <TextField
            margin="dense"
            label="Retention Days"
            type="number"
            fullWidth
            value={formData.retentionDays}
            onChange={(e) =>
              setFormData({
                ...formData,
                retentionDays: parseInt(e.target.value),
              })
            }
          />
          <TextField
            margin="dense"
            label="Backup Type"
            select
            fullWidth
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            SelectProps={{
              native: true,
            }}
          >
            <option value="full">Full</option>
            <option value="incremental">Incremental</option>
            <option value="differential">Differential</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingBackup ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Backups; 