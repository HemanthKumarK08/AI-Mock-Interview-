const ProfileModel = require('../models/profileModel');
const { validateProfileData } = require('../utils/validation');

class ProfileService {
  static async getProfile(userId) {
    let profile = await ProfileModel.findByUserId(userId);
    if (!profile) {
      // Create a default empty profile row if not existing
      profile = await ProfileModel.create(userId, {});
    }
    return profile;
  }

  static async createProfile(userId, profileData) {
    const existing = await ProfileModel.findByUserId(userId);
    if (existing) {
      throw { status: 409, message: 'Profile already exists for this user. Use PUT to update.' };
    }

    const validation = validateProfileData(profileData);
    if (!validation.isValid) {
      throw { status: 400, message: validation.errors.join(', ') };
    }

    return await ProfileModel.create(userId, validation.sanitized);
  }

  static async updateProfile(userId, profileData) {
    const validation = validateProfileData(profileData);
    if (!validation.isValid) {
      throw { status: 400, message: validation.errors.join(', ') };
    }

    const existing = await ProfileModel.findByUserId(userId);
    if (!existing) {
      return await ProfileModel.create(userId, validation.sanitized);
    }

    return await ProfileModel.update(userId, validation.sanitized);
  }
}

module.exports = ProfileService;
