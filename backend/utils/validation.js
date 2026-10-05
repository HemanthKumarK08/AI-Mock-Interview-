function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  // Minimum 6 characters
  return password.length >= 6;
}

function validateProfileData(data) {
  const errors = [];
  const sanitized = {};

  if (data.phone !== undefined && data.phone !== null) {
    if (typeof data.phone !== 'string' || data.phone.length > 50) {
      errors.push('Phone number must be a string up to 50 characters');
    } else {
      sanitized.phone = data.phone.trim();
    }
  }

  if (data.education !== undefined && data.education !== null) {
    if (typeof data.education !== 'string' || data.education.length > 255) {
      errors.push('Education must be a string up to 255 characters');
    } else {
      sanitized.education = data.education.trim();
    }
  }

  if (data.institution !== undefined && data.institution !== null) {
    if (typeof data.institution !== 'string' || data.institution.length > 255) {
      errors.push('Institution must be a string up to 255 characters');
    } else {
      sanitized.institution = data.institution.trim();
    }
  }

  if (data.experience_years !== undefined && data.experience_years !== null) {
    const exp = parseFloat(data.experience_years);
    if (isNaN(exp) || exp < 0 || exp > 70) {
      errors.push('Experience years must be a valid number between 0 and 70');
    } else {
      sanitized.experience_years = exp;
    }
  }

  if (data.current_role !== undefined && data.current_role !== null) {
    if (typeof data.current_role !== 'string' || data.current_role.length > 255) {
      errors.push('Current role must be a string up to 255 characters');
    } else {
      sanitized.current_role = data.current_role.trim();
    }
  }

  if (data.target_role !== undefined && data.target_role !== null) {
    if (typeof data.target_role !== 'string' || data.target_role.length > 255) {
      errors.push('Target role must be a string up to 255 characters');
    } else {
      sanitized.target_role = data.target_role.trim();
    }
  }

  if (data.skills !== undefined && data.skills !== null) {
    if (typeof data.skills !== 'string' || data.skills.length > 5000) {
      errors.push('Skills must be a text string up to 5000 characters');
    } else {
      sanitized.skills = data.skills.trim();
    }
  }

  if (data.bio !== undefined && data.bio !== null) {
    if (typeof data.bio !== 'string' || data.bio.length > 5000) {
      errors.push('Bio must be a text string up to 5000 characters');
    } else {
      sanitized.bio = data.bio.trim();
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

module.exports = {
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateProfileData
};
