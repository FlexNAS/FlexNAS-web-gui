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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Quota {
  id: number;
  targetType: 'user' | 'group';
  targetId: number;
  targetName: string;
  path: string;
  softLimit: number;
  hardLimit: number;
  usedSpace: number;
  gracePeriod: number;
  createdAt: string;
  updatedAt: string;
}

interface QuotaFormData {
  targetType: 'user' | 'group';
  targetId: string;
  path: string;
  softLimit: string;
  hardLimit: string;
  gracePeriod: number;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const Quotas: React.FC = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingQuota, setEditingQuota] = useState<Quota | null>(null);
  const [formData, setFormData] = useState<QuotaFormData>({
    targetType: 'user',
    targetId: '',
    path: '',
    softLimit: '',
    hardLimit: '',
    gracePeriod: 7,
  });

  const queryClient = useQueryClient();

  const { data: quotas, isLoading } = useQuery({
    queryKey: ['quotas'],
    queryFn: async () => {
      const response = await axios.get('/api/quotas');
      return response.data;
    },
  });

  const createQuotaMutation = useMutation({
    mutationFn: (data: QuotaFormData) => {
      const payload = {
        ...data,
        softLimit: parseInt(data.softLimit),
        hardLimit: parseInt(data.hardLimit),
        targetId: parseInt(data.targetId),
      };
      return axios.post('/api/quotas', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotas'] });
      setOpenDialog(false);
      setFormData({
        targetType: 'user',
        targetId: '',
        path: '',
        softLimit: '',
        hardLimit: '',
        gracePeriod: 7,
      });
    },
  });

  const updateQuotaMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Quota> }) =>
      axios.put(`/api/quotas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotas'] });
      setOpenDialog(false);
      setEditingQuota(null);
    },
  });

  const deleteQuotaMutation = useMutation({
    mutationFn: (id: number) => axios.delete(`/api/quotas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotas'] });
    },
  });

  const handleOpenDialog = (quota?: Quota) => {
    if (quota) {
      setEditingQuota(quota);
      setFormData({
        targetType: quota.targetType,
        targetId: quota.targetId.toString(),
        path: quota.path,
        softLimit: quota.softLimit.toString(),
        hardLimit: quota.hardLimit.toString(),
        gracePeriod: quota.gracePeriod,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingQuota(null);
    setFormData({
      targetType: 'user',
      targetId: '',
      path: '',
      softLimit: '',
      hardLimit: '',
      gracePeriod: 7,
    });
  };

  const handleSubmit = () => {
    if (editingQuota) {
      const updateData: Partial<Quota> = {
        targetType: formData.targetType,
        targetId: parseInt(formData.targetId),
        path: formData.path,
        softLimit: parseInt(formData.softLimit),
        hardLimit: parseInt(formData.hardLimit),
        gracePeriod: formData.gracePeriod,
      };
      updateQuotaMutation.mutate({ id: editingQuota.id, data: updateData });
    } else {
      createQuotaMutation.mutate(formData);
    }
  };

  const getUsagePercentage = (quota: Quota) => {
    return (quota.usedSpace / quota.hardLimit) * 100;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'error';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Storage Quotas</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          New Quota
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Target</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Path</TableCell>
              <TableCell>Used Space</TableCell>
              <TableCell>Soft Limit</TableCell>
              <TableCell>Hard Limit</TableCell>
              <TableCell>Grace Period</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quotas?.map((quota: Quota) => {
              const usagePercentage = getUsagePercentage(quota);
              return (
                <TableRow key={quota.id}>
                  <TableCell>{quota.targetName}</TableCell>
                  <TableCell>
                    <Chip
                      label={quota.targetType}
                      color={quota.targetType === 'user' ? 'primary' : 'secondary'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{quota.path}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: '100%' }}>
                        <LinearProgress
                          variant="determinate"
                          value={usagePercentage}
                          color={getUsageColor(usagePercentage)}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ minWidth: 60 }}>
                        {formatBytes(quota.usedSpace)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{formatBytes(quota.softLimit)}</TableCell>
                  <TableCell>{formatBytes(quota.hardLimit)}</TableCell>
                  <TableCell>{quota.gracePeriod} days</TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleOpenDialog(quota)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => deleteQuotaMutation.mutate(quota.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingQuota ? 'Edit Quota' : 'Create New Quota'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Target Type</InputLabel>
                <Select
                  value={formData.targetType}
                  label="Target Type"
                  onChange={(e) => setFormData({ ...formData, targetType: e.target.value as 'user' | 'group' })}
                >
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="group">Group</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Target ID"
                value={formData.targetId}
                onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Path"
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Soft Limit (bytes)"
                type="number"
                value={formData.softLimit}
                onChange={(e) => setFormData({ ...formData, softLimit: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Hard Limit (bytes)"
                type="number"
                value={formData.hardLimit}
                onChange={(e) => setFormData({ ...formData, hardLimit: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Grace Period (days)"
                type="number"
                value={formData.gracePeriod}
                onChange={(e) => setFormData({ ...formData, gracePeriod: parseInt(e.target.value) })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingQuota ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Quotas; 