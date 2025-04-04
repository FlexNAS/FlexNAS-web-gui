import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Container,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material'
import { Login as LoginIcon } from '@mui/icons-material'
import { useAuth } from '../hooks/useAuth'
import axios from 'axios'
import { Logo } from '../components/Logo'

interface LoginForm {
  username: string
  password: string
}

interface FormErrors {
  username?: string
  password?: string
  general?: string
}

const Login = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<LoginForm>({
    username: '',
    password: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [error, setError] = useState('')

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    console.log('Login form submitted with:', { username: formData.username, password: '***********' })

    if (!validateForm()) {
      setIsLoading(false)
      console.log('Form validation failed')
      return
    }

    try {
      console.log('Attempting to login with useAuth hook')
      await login(formData.username, formData.password)
      console.log('Login successful, waiting to navigate')
      
      // Add a delay to ensure the auth state is updated before navigation
      setTimeout(() => {
        console.log('Navigating to dashboard after delay')
        navigate('/', { replace: true })
      }, 500)
    } catch (err) {
      console.error('Login failed with error:', err)
      setError('Invalid username or password')
      setIsLoading(false)
    }
  }

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box sx={{ mb: 4, transform: 'scale(1.5)' }}>
          <Logo />
        </Box>
        <Card sx={{ width: '100%', mt: 2 }}>
          <CardContent>
            <Typography component="h1" variant="h5" sx={{ mb: 3, textAlign: 'center' }}>
              Sign in to FlexNAS
            </Typography>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                autoFocus
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                error={!!errors.username}
                helperText={errors.username}
                disabled={isLoading}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                error={!!errors.password}
                helperText={errors.password}
                disabled={isLoading}
              />
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Sign In'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  )
}

export default Login 