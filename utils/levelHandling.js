const profileModel = require('../models/profileModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('./itemsInfo');

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
		}
	},

	async decreaseLevel(profileData) {

		const newUserLevel = Math.round(profileData.levels - (profileData.levels / 10));
		const emptyUserInventory = {
			commonPlants: {},
			uncommonPlants: {},
			rarePlants: {},
			meat: {},
		};

		for (const [commonPlantName] of commonPlantsMap) {

			emptyUserInventory.commonPlants[commonPlantName] = 0;
		}

		for (const [uncommonPlantName] of uncommonPlantsMap) {

			emptyUserInventory.uncommonPlants[uncommonPlantName] = 0;
		}

		for (const [rarePlantName] of rarePlantsMap) {

			emptyUserInventory.rarePlants[rarePlantName] = 0;
		}

		for (const [speciesName] of speciesMap) {

			emptyUserInventory.meat[speciesName] = 0;
		}

		await profileModel.findOneAndUpdate(
			{ userId: profileData.userId, serverId: profileData.serverId },
			{
				$set: {
					levels: newUserLevel,
					experience: 0,
					inventoryObject: emptyUserInventory,
				},
			},
		);
	},

};