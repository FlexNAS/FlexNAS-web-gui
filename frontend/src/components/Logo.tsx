import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const LogoWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  cursor: 'pointer',
  '& .logo-icon': {
    width: '40px',
    height: '40px',
    position: 'relative',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '100%',
      height: '100%',
      background: theme.palette.primary.main,
      borderRadius: '8px',
      filter: 'blur(12px)',
      opacity: 0.4,
      animation: 'pulse 2s infinite'
    }
  },
  '& .logo-text': {
    fontSize: '1.5rem',
    fontWeight: 700,
    background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  '@keyframes pulse': {
    '0%': {
      transform: 'translate(-50%, -50%) scale(1)',
      opacity: 0.4
    },
    '50%': {
      transform: 'translate(-50%, -50%) scale(1.2)',
      opacity: 0.2
    },
    '100%': {
      transform: 'translate(-50%, -50%) scale(1)',
      opacity: 0.4
    }
  }
}));

const LogoIcon = styled('svg')({
  width: '100%',
  height: '100%',
  fill: 'currentColor',
  color: '#2196f3', // Material-UI blue
  filter: 'drop-shadow(0 0 2px rgba(33, 150, 243, 0.3))'
});

export const Logo = () => {
  return (
    <LogoWrapper>
      <Box className="logo-icon">
        <LogoIcon viewBox="0 0 24 24">
          <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.7L19.5 8 12 11.3 4.5 8 12 4.7zM4 9.5l7 3.5v6.5l-7-3.5V9.5zm9 10V13l7-3.5v6.5l-7 3.5z"/>
        </LogoIcon>
      </Box>
      <Typography className="logo-text" variant="h6" component="span">
        FlexNAS
      </Typography>
    </LogoWrapper>
  );
}; 