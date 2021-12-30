const profileModel = require('../models/profileSchema');

module.exports = {
	async levelCheck(message, profileData, botReply) {

		const requiredExperiencePoints = profileData.levels * 50;

		if (profileData.experience >= requiredExperiencePoints) {

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$inc: {
						experience: -requiredExperiencePoints,
						levels: +1,
					},
				},
				{ upsert: true, new: true },
			);

			const embed = {
				color: profileData.color,
				title: `${profileData.name} just leveled up! ${profileData.pronounArray[0].charAt(0).toUpperCase() + profileData.pronounArray[0].slice(1)} ${(profileData.pronounArray[5] == 'singular') ? 'is' : 'are'} now level ${profileData.levels}.`,
			};

			botReply.embeds.push(embed);
			await botReply.edit({ embeds: botReply.embeds });
		}
	},
};