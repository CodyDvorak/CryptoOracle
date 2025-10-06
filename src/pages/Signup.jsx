import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../config/api'
import { Mail, Lock, User, Eye, EyeOff, TrendingUp, CircleAlert as AlertCircle, CircleCheck as CheckCircle } from 'lucide-react'
import './Auth.css'

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const validatePassword = (pwd) => {
    return {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
    }
  }

  const passwordValidation = validatePassword(password)
  const isPasswordValid = Object.values(passwordValidation).every(Boolean)

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (!isPasswordValid) {
      setError('Please meet all password requirements')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      })

      if (error) throw error

      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      setError(err.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="success-message">
            <CheckCircle size={64} className="success-icon" />
            <h2>Account Created Successfully!</h2>
            <p>Check your email to verify your account.</p>
            <p className="redirect-text">Redirecting to login...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-logo">
            <TrendingUp size={40} />
            <h1>Crypto Oracle</h1>
          </div>
          <p>Create your account to start trading</p>
        </div>

        <form onSubmit={handleSignup} className="auth-form">
          {error && (
            <div className="auth-error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={20} />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {password && (
            <div className="password-requirements">
              <div className={`requirement ${passwordValidation.length ? 'met' : ''}`}>
                <CheckCircle size={16} />
                <span>At least 8 characters</span>
              </div>
              <div className={`requirement ${passwordValidation.uppercase ? 'met' : ''}`}>
                <CheckCircle size={16} />
                <span>One uppercase letter</span>
              </div>
              <div className={`requirement ${passwordValidation.lowercase ? 'met' : ''}`}>
                <CheckCircle size={16} />
                <span>One lowercase letter</span>
              </div>
              <div className={`requirement ${passwordValidation.number ? 'met' : ''}`}>
                <CheckCircle size={16} />
                <span>One number</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Confirm Password</label>
            <div className="input-wrapper">
              <Lock size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" className="auth-button" disabled={loading || !isPasswordValid}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
