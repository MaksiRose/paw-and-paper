const profileModel = require('../models/profileModel');

module.exports = async (message, profileData) => {

	if (profileData.hasCooldown !== true) {

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { hasCooldown: true } },
		);
	}

	return profileData;
};