import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  LinearProgress,
} from '@mui/material'
import {
  Folder,
  InsertDriveFile,
  ArrowUpward,
  CreateNewFolder,
  Delete,
  Download,
  NavigateNext,
  Edit,
  Add,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

interface FileItem {
  name: string
  type: 'file' | 'directory'
  size: number
  modified: string
  path: string
}

interface Volume {
  name: string
  mountPoint: string
  totalSpace: string
  usedSpace: string
  freeSpace: string
  usagePercent: number
}

interface Share {
  id: number
  name: string
  path: string
  description: string
  isPublic: boolean
  readOnly: boolean
  allowedUsers: string[]
  creator: string
  createdAt: string
}

interface ShareFormData {
  name: string
  path: string
  description: string
  isPublic: boolean
  readOnly: boolean
  allowedUsers: string[]
}

const Storage = () => {
  const queryClient = useQueryClient()
  const [currentPath, setCurrentPath] = useState('/')
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [open, setOpen] = useState(false)
  const [editingShare, setEditingShare] = useState<Share | null>(null)
  const [formData, setFormData] = useState<ShareFormData>({
    name: '',
    path: '',
    description: '',
    isPublic: false,
    readOnly: false,
    allowedUsers: [],
  })

  const { data: files, isLoading: isLoadingFiles } = useQuery<FileItem[]>({
    queryKey: ['files', currentPath],
    queryFn: async () => {
      const response = await axios.get(`/api/files?path=${encodeURIComponent(currentPath)}`)
      return response.data
    },
  })

  const { data: volumes } = useQuery<Volume[]>({
    queryKey: ['volumes'],
    queryFn: async () => {
      const response = await axios.get('/api/volumes')
      return response.data
    },
  })

  const { data: shares, isLoading } = useQuery<Share[]>({
    queryKey: ['shares'],
    queryFn: async () => {
      const response = await axios.get('http://localhost:5000/api/shares')
      return response.data
    },
  })

  const createShareMutation = useMutation({
    mutationFn: (data: ShareFormData) =>
      axios.post('http://localhost:5000/api/shares', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] })
      handleClose()
    },
  })

  const updateShareMutation = useMutation({
    mutationFn: (data: { id: number; share: ShareFormData }) =>
      axios.put(`http://localhost:5000/api/shares/${data.id}`, data.share),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] })
      handleClose()
    },
  })

  const deleteShareMutation = useMutation({
    mutationFn: (id: number) =>
      axios.delete(`http://localhost:5000/api/shares/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] })
    },
  })

  const handleNavigate = (path: string) => {
    setCurrentPath(path)
  }

  const handleCreateFolder = async () => {
    try {
      await axios.post('/api/files/create-folder', {
        path: `${currentPath}/${newFolderName}`.replace(/\/+/g, '/'),
      })
      setCreateFolderOpen(false)
      setNewFolderName('')
      // Refetch files
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const handleOpen = (share?: Share) => {
    if (share) {
      setEditingShare(share)
      setFormData({
        name: share.name,
        path: share.path,
        description: share.description,
        isPublic: share.isPublic,
        readOnly: share.readOnly,
        allowedUsers: share.allowedUsers,
      })
    } else {
      setEditingShare(null)
      setFormData({
        name: '',
        path: '',
        description: '',
        isPublic: false,
        readOnly: false,
        allowedUsers: [],
      })
    }
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setEditingShare(null)
    setFormData({
      name: '',
      path: '',
      description: '',
      isPublic: false,
      readOnly: false,
      allowedUsers: [],
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingShare) {
      updateShareMutation.mutate({ id: editingShare.id, share: formData })
    } else {
      createShareMutation.mutate(formData)
    }
  }

  const pathParts = currentPath.split('/').filter(Boolean)

  const formatSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  if (isLoading) {
    return <Typography>Loading...</Typography>
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>Storage Management</Typography>

      {/* Volume Information */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {volumes?.map((volume) => (
          <Grid item xs={12} md={6} key={volume.mountPoint}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6">{volume.name}</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {volume.mountPoint}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={volume.usagePercent}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Total</Typography>
                  <Typography>{volume.totalSpace}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Used</Typography>
                  <Typography>{volume.usedSpace}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Free</Typography>
                  <Typography>{volume.freeSpace}</Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* File Browser */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Breadcrumbs separator={<NavigateNext fontSize="small" />}>
            <Link
              component="button"
              variant="body1"
              onClick={() => handleNavigate('/')}
              sx={{ textDecoration: 'none' }}
            >
              Root
            </Link>
            {pathParts.map((part, index) => (
              <Link
                key={part}
                component="button"
                variant="body1"
                onClick={() => handleNavigate(`/${pathParts.slice(0, index + 1).join('/')}`)}
                sx={{ textDecoration: 'none' }}
              >
                {part}
              </Link>
            ))}
          </Breadcrumbs>
          <Box>
            <Button
              startIcon={<ArrowUpward />}
              variant="contained"
              sx={{ mr: 1 }}
            >
              Upload
            </Button>
            <Button
              startIcon={<CreateNewFolder />}
              variant="outlined"
              onClick={() => setCreateFolderOpen(true)}
            >
              New Folder
            </Button>
          </Box>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Modified</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files?.map((file) => (
                <TableRow key={file.path}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {file.type === 'directory' ? (
                        <Folder sx={{ mr: 1, color: 'primary.main' }} />
                      ) : (
                        <InsertDriveFile sx={{ mr: 1, color: 'text.secondary' }} />
                      )}
                      <Typography
                        variant="body2"
                        sx={{ cursor: file.type === 'directory' ? 'pointer' : 'default' }}
                        onClick={() => file.type === 'directory' && handleNavigate(file.path)}
                      >
                        {file.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{file.type === 'file' ? formatSize(file.size) : '--'}</TableCell>
                  <TableCell>{file.modified}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" sx={{ mr: 1 }}>
                      <Download />
                    </IconButton>
                    <IconButton size="small" color="error">
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onClose={() => setCreateFolderOpen(false)}>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            fullWidth
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFolderOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateFolder} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, mt: 3 }}>
        <Typography variant="h4">Shares</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpen()}
        >
          Create Share
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Path</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Public</TableCell>
              <TableCell>Read Only</TableCell>
              <TableCell>Creator</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shares?.map((share) => (
              <TableRow key={share.id}>
                <TableCell>{share.name}</TableCell>
                <TableCell>{share.path}</TableCell>
                <TableCell>{share.description}</TableCell>
                <TableCell>{share.isPublic ? 'Yes' : 'No'}</TableCell>
                <TableCell>{share.readOnly ? 'Yes' : 'No'}</TableCell>
                <TableCell>{share.creator}</TableCell>
                <TableCell>
                  {new Date(share.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(share)}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => deleteShareMutation.mutate(share.id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>
          {editingShare ? 'Edit Share' : 'Create Share'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              margin="normal"
            />
            <TextField
              fullWidth
              label="Path"
              value={formData.path}
              onChange={(e) =>
                setFormData({ ...formData, path: e.target.value })
              }
              margin="normal"
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              margin="normal"
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingShare ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Storage 