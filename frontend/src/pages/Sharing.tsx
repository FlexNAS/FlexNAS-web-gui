import React from 'react';
import { Box, Typography, Paper, Tabs, Tab } from '@mui/material';
import { styled } from '@mui/material/styles';
import Protocols from '../components/Protocols';
import Shares from '../components/Shares';

const TabPanel = styled('div')(({ theme }) => ({
  padding: theme.spacing(3),
}));

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`sharing-tabpanel-${index}`}
      aria-labelledby={`sharing-tab-${index}`}
      {...other}
    >
      {value === index && (
        <TabPanel>{children}</TabPanel>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `sharing-tab-${index}`,
    'aria-controls': `sharing-tabpanel-${index}`,
  };
}

const Sharing = () => {
  const [value, setValue] = React.useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        File Sharing
      </Typography>
      
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={value} 
            onChange={handleChange} 
            aria-label="file sharing tabs"
          >
            <Tab label="Protocols" {...a11yProps(0)} />
            <Tab label="Shares" {...a11yProps(1)} />
          </Tabs>
        </Box>
        
        <CustomTabPanel value={value} index={0}>
          <Protocols />
        </CustomTabPanel>
        
        <CustomTabPanel value={value} index={1}>
          <Shares />
        </CustomTabPanel>
      </Paper>
    </Box>
  );
};

export default Sharing; 