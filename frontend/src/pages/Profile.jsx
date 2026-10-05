import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ApiService from '../services/api';

export default function Profile({ onNavigate }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    phone: '',
    education: '',
    institution: '',
    experience_years: 0,
    current_role: '',
    target_role: '',
    skills: '',
    bio: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await ApiService.getProfile();
        if (res.success && res.data?.profile) {
          const p = res.data.profile;
          setFormData({
            phone: p.phone || '',
            education: p.education || '',
            institution: p.institution || '',
            experience_years: p.experience_years !== null && p.experience_years !== undefined ? p.experience_years : 0,
            current_role: p.current_role || '',
            target_role: p.target_role || '',
            skills: p.skills || '',
            bio: p.bio || ''
          });
        }
      } catch (err) {
        setErrorMsg('Failed to load candidate profile');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'experience_years' ? (value === '' ? '' : parseFloat(value)) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSaving(true);

    try {
      const res = await ApiService.updateProfile(formData);
      if (res.success) {
        setSuccessMsg('Profile updated successfully!');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(res.message || 'Failed to update profile');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network error updating profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading candidate profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="page-header">
        <div className="header-info">
          <h2>Candidate Profile</h2>
          <p>Customize your candidate profile to tailor future AI interview simulations</p>
        </div>
        <button className="btn-secondary" onClick={() => onNavigate('dashboard')}>
          Back to Dashboard
        </button>
      </div>

      {errorMsg && (
        <div className="alert-box alert-danger">
          <span>⚠️</span> {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="alert-box alert-success">
          <span>✓</span> {successMsg}
        </div>
      )}

      <div className="profile-layout">
        {/* User Identity Card */}
        <div className="card profile-id-card">
          <div className="id-avatar">
            {user?.name ? user.name[0].toUpperCase() : 'S'}
          </div>
          <h3>{user?.name}</h3>
          <p className="text-muted">{user?.email}</p>
          <div className="badge-student-pill">Verified Candidate</div>
          <div className="id-meta">
            <div className="meta-item">
              <span className="meta-label">System Role</span>
              <span className="meta-val">Student</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Access Level</span>
              <span className="meta-val">Standard Candidate</span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="card profile-form-card">
          <form onSubmit={handleSubmit}>
            <div className="form-section-title">Academic & Professional Details</div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="education">Degree / Qualification</label>
                <input
                  id="education"
                  name="education"
                  type="text"
                  placeholder="e.g. B.Tech Computer Science"
                  value={formData.education}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="institution">College / University</label>
                <input
                  id="institution"
                  name="institution"
                  type="text"
                  placeholder="e.g. Bangalore Institute of Technology"
                  value={formData.institution}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="experience_years">Years of Experience</label>
                <input
                  id="experience_years"
                  name="experience_years"
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  placeholder="0.0"
                  value={formData.experience_years}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-section-title">Interview Target Preferences</div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="current_role">Current Role / Status</label>
                <input
                  id="current_role"
                  name="current_role"
                  type="text"
                  placeholder="e.g. Final Year Student / Frontend Intern"
                  value={formData.current_role}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="target_role">Target Interview Role</label>
                <input
                  id="target_role"
                  name="target_role"
                  type="text"
                  placeholder="e.g. Full Stack Developer / SDE-1"
                  value={formData.target_role}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="skills">Key Technical & Soft Skills (comma separated)</label>
              <textarea
                id="skills"
                name="skills"
                rows="3"
                placeholder="e.g. React, Node.js, Python, System Design, SQL, Problem Solving"
                value={formData.skills}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="bio">Candidate Bio / Professional Summary</label>
              <textarea
                id="bio"
                name="bio"
                rows="4"
                placeholder="Brief summary of your background, projects, and interview goals..."
                value={formData.bio}
                onChange={handleChange}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving Changes...' : 'Save Candidate Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
