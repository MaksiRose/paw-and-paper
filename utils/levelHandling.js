const profileModel = require('../models/profileModel');

module.exports = {

	async checkLevelUp(profileData, botReply) {

		const requiredExperiencePoints = profileData.levels * 50;

		if (profileData.experience >= requiredExperiencePoints) {

			profileData = await profileModel.findOneAndUpdate(
				{ userId: profileData.userId, serverId: profileData.serverId },
				{
					$inc: {
						experience: -requiredExperiencePoints,
						levels: +1,
					},
				},
			);

			const embed = {
				color: profileData.color,
				title: `${profileData.name} just leveled up! ${profileData.pronounArray[0].charAt(0).toUpperCase() + profileData.pronounArray[0].slice(1)} ${(profileData.pronounArray[5] == 'singular') ? 'is' : 'are'} now level ${profileData.levels}.`,
			};

			botReply.embeds.push(embed);
			await botReply
				.edit({
					embeds: botReply.embeds,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			return botReply;
		}
	},

	async decreaseLevel(profileData, botReply) {

		const newUserLevel = Math.round(profileData.levels - (profileData.levels / 10));

		botReply.embeds[0].footer = `${(profileData.experience > 0) ? `-${profileData.experience} XP` : ''}\n${(newUserLevel != profileData.levels) ? `-${profileData.levels - newUserLevel} level${(profileData.levels - newUserLevel > 1) ? 's' : ''}` : ''}`;

		const newUserInventory = { ...profileData.inventoryObject };
		for (const itemType of Object.keys(newUserInventory)) {

			for (const item of Object.keys(newUserInventory[itemType])) {

				if (newUserInventory[itemType][item] > 0) {

					botReply.embeds[0].footer += `\n-${newUserInventory[itemType][item]} ${item}`;
					newUserInventory[itemType][item] = 0;
				}
			}
		}


		await profileModel.findOneAndUpdate(
			{ userId: profileData.userId, serverId: profileData.serverId },
			{
				$set: {
					levels: newUserLevel,
					experience: 0,
					inventoryObject: newUserInventory,
				},
			},
		);

		botReply = await botReply
			.edit({
				embeds: botReply.embeds,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		return botReply;
	},

};