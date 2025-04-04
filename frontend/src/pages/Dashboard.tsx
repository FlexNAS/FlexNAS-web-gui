import React from 'react';
import { Box, Grid, Card, CardContent, Typography, LinearProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface SystemStatus {
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  totalStorage: string;
  usedStorage: string;
  freeStorage: string;
  systemStatus: 'healthy' | 'warning';
}

const Dashboard = () => {
  const { data: systemStatus, isLoading } = useQuery<SystemStatus>({
    queryKey: ['systemStatus'],
    queryFn: async () => {
      const response = await axios.get('http://localhost:5000/api/system-status');
      return response.data;
    },
    refetchInterval: false, // Disable automatic refreshing
    staleTime: Infinity, // Keep data fresh indefinitely
  });

  if (isLoading) {
    return (
      <Box sx={{ width: '100%', mt: 4 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* CPU Usage */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                CPU Usage
              </Typography>
              <Typography variant="h3" component="div">
                {systemStatus?.cpuUsage ?? 0}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={systemStatus?.cpuUsage ?? 0}
                color={(systemStatus?.cpuUsage ?? 0) > 80 ? 'error' : 'primary'}
                sx={{ mt: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Memory Usage */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Memory Usage
              </Typography>
              <Typography variant="h3" component="div">
                {systemStatus?.memoryUsage ?? 0}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={systemStatus?.memoryUsage ?? 0}
                color={(systemStatus?.memoryUsage ?? 0) > 80 ? 'error' : 'primary'}
                sx={{ mt: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Storage Usage */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Storage Usage
              </Typography>
              <Typography variant="h3" component="div">
                {systemStatus?.storageUsage ?? 0}%
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="textSecondary">
                  Total: {systemStatus?.totalStorage ?? 'N/A'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Used: {systemStatus?.usedStorage ?? 'N/A'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Free: {systemStatus?.freeStorage ?? 'N/A'}
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={systemStatus?.storageUsage ?? 0}
                color={(systemStatus?.storageUsage ?? 0) > 80 ? 'error' : 'primary'}
                sx={{ mt: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard; 