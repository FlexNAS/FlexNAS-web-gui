import React, { useState, useEffect } from 'react';
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
  Switch,
  FormControlLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Grid,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Share {
  id: number;
  name: string;
  path: string;
  description: string;
  creator: string;
  createdAt: string;
  isPublic: boolean;
  allowedUsers: string[];
  readOnly: boolean;
}

const Shares: React.FC = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingShare, setEditingShare] = useState<Share | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    path: '',
    description: '',
    isPublic: false,
    allowedUsers: [] as string[],
    readOnly: false,
  });

  const queryClient = useQueryClient();

  const { data: shares, isLoading } = useQuery({
    queryKey: ['shares'],
    queryFn: async () => {
      const response = await axios.get('/api/shares');
      return response.data;
    },
  });

  const createShareMutation = useMutation({
    mutationFn: (data: typeof formData) => axios.post('/api/shares', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] });
      setOpenDialog(false);
      setFormData({
        name: '',
        path: '',
        description: '',
        isPublic: false,
        allowedUsers: [],
        readOnly: false,
      });
    },
  });

  const updateShareMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof formData }) =>
      axios.put(`/api/shares/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] });
      setOpenDialog(false);
      setEditingShare(null);
      setFormData({
        name: '',
        path: '',
        description: '',
        isPublic: false,
        allowedUsers: [],
        readOnly: false,
      });
    },
  });

  const deleteShareMutation = useMutation({
    mutationFn: (id: number) => axios.delete(`/api/shares/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] });
    },
  });

  const handleOpenDialog = (share?: Share) => {
    if (share) {
      setEditingShare(share);
      setFormData({
        name: share.name,
        path: share.path,
        description: share.description,
        isPublic: share.isPublic,
        allowedUsers: share.allowedUsers,
        readOnly: share.readOnly,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingShare(null);
    setFormData({
      name: '',
      path: '',
      description: '',
      isPublic: false,
      allowedUsers: [],
      readOnly: false,
    });
  };

  const handleSubmit = () => {
    if (editingShare) {
      updateShareMutation.mutate({ id: editingShare.id, data: formData });
    } else {
      createShareMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">File Shares</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          New Share
        </Button>
      </Box>

      <Grid container spacing={3}>
        {shares?.map((share: Share) => (
          <Grid item xs={12} sm={6} md={4} key={share.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{share.name}</Typography>
                <Typography color="textSecondary" gutterBottom>
                  {share.path}
                </Typography>
                <Typography variant="body2" paragraph>
                  {share.description}
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={share.isPublic ? 'Public' : 'Private'}
                    color={share.isPublic ? 'success' : 'default'}
                    size="small"
                  />
                  {share.readOnly && (
                    <Chip
                      label="Read Only"
                      color="warning"
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
                {!share.isPublic && share.allowedUsers.length > 0 && (
                  <Typography variant="body2" color="textSecondary">
                    Allowed Users: {share.allowedUsers.join(', ')}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <IconButton onClick={() => handleOpenDialog(share)}>
                  <EditIcon />
                </IconButton>
                <IconButton onClick={() => deleteShareMutation.mutate(share.id)}>
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingShare ? 'Edit Share' : 'Create New Share'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Share Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Path"
            fullWidth
            value={formData.path}
            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.isPublic}
                onChange={(e) =>
                  setFormData({ ...formData, isPublic: e.target.checked })
                }
              />
            }
            label="Public Share"
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.readOnly}
                onChange={(e) =>
                  setFormData({ ...formData, readOnly: e.target.checked })
                }
              />
            }
            label="Read Only"
          />
          {!formData.isPublic && (
            <TextField
              margin="dense"
              label="Allowed Users (comma-separated)"
              fullWidth
              value={formData.allowedUsers.join(', ')}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  allowedUsers: e.target.value
                    .split(',')
                    .map((user) => user.trim())
                    .filter(Boolean),
                })
              }
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingShare ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Shares; 