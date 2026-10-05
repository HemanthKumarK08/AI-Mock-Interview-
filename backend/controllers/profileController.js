const ProfileService = require('../services/profileService');

class ProfileController {
  static async getProfile(req, res) {
    try {
      const profile = await ProfileService.getProfile(req.user.id);
      return res.status(200).json({
        success: true,
        data: {
          profile
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while fetching candidate profile'
      });
    }
  }

  static async createProfile(req, res) {
    try {
      const profile = await ProfileService.createProfile(req.user.id, req.body);
      return res.status(201).json({
        success: true,
        message: 'Profile created successfully',
        data: {
          profile
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while creating candidate profile'
      });
    }
  }

  static async updateProfile(req, res) {
    try {
      const profile = await ProfileService.updateProfile(req.user.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          profile
        }
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        message: err.message || 'An error occurred while updating candidate profile'
      });
    }
  }
}

module.exports = ProfileController;
