const profileModel = require('../models/profileSchema');
const arrays = require('./arrays');

module.exports = {

	async randomCommonPlant(message, profileData) {

		const userInventoryArray = profileData.inventoryArray;
		const randomCommonPlantArrayIndex = Math.floor(Math.random() * arrays.commonPlantNamesArray.length);

		++userInventoryArray[0][randomCommonPlantArrayIndex];

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { inventoryArray: userInventoryArray } },
			{ upsert: true, new: true },
		);

		return arrays.commonPlantNamesArray[randomCommonPlantArrayIndex];
	},

	async randomUncommonPlant(message, profileData) {

		const userInventoryArray = profileData.inventoryArray;
		const randomUncommonPlantArrayIndex = Math.floor(Math.random() * arrays.uncommonPlantNamesArray.length);

		++userInventoryArray[1][randomUncommonPlantArrayIndex];

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { inventoryArray: userInventoryArray } },
			{ upsert: true, new: true },
		);

		return arrays.uncommonPlantNamesArray[randomUncommonPlantArrayIndex];
	},

	async randomRarePlant(message, profileData) {

		const userInventoryArray = profileData.inventoryArray;
		const randomRarePlantArrayIndex = Math.floor(Math.random() * arrays.rarePlantNamesArray.length);

		++userInventoryArray[2][randomRarePlantArrayIndex];

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { inventoryArray: userInventoryArray } },
			{ upsert: true, new: true },
		);

		return arrays.rarePlantNamesArray[randomRarePlantArrayIndex];
	},

};