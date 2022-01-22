const profileModel = require('../models/profileSchema');
const arrays = require('./arrays');

module.exports = {

	async randomCommonPlant(message, profileData) {

		const userInventoryArray = [[...profileData.inventoryArray[0]], [...profileData.inventoryArray[1]], [...profileData.inventoryArray[2]], [...profileData.inventoryArray[3]]];
		const randomCommonPlantArrayIndex = Math.floor(Math.random() * arrays.commonPlantNamesArray.length);

		userInventoryArray[0][randomCommonPlantArrayIndex] += 1;

		(profileData.inventoryArray != userInventoryArray) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): inventoryArray[0] changed from \x1b[33m[${profileData.inventoryArray[0]}] \x1b[0mto \x1b[33m[${userInventoryArray[0]}] \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		profileData = await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { inventoryArray: userInventoryArray } },
				{ new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});

		return arrays.commonPlantNamesArray[randomCommonPlantArrayIndex];
	},

	async randomUncommonPlant(message, profileData) {

		const userInventoryArray = [[...profileData.inventoryArray[0]], [...profileData.inventoryArray[1]], [...profileData.inventoryArray[2]], [...profileData.inventoryArray[3]]];
		const randomUncommonPlantArrayIndex = Math.floor(Math.random() * arrays.uncommonPlantNamesArray.length);

		++userInventoryArray[1][randomUncommonPlantArrayIndex];

		(profileData.inventoryArray != userInventoryArray) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): inventoryArray[1] changed from \x1b[33m[${profileData.inventoryArray[1]}] \x1b[0mto \x1b[33m[${userInventoryArray[1]}] \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		profileData = await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { inventoryArray: userInventoryArray } },
				{ new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});

		return arrays.uncommonPlantNamesArray[randomUncommonPlantArrayIndex];
	},

	async randomRarePlant(message, profileData) {

		const userInventoryArray = [[...profileData.inventoryArray[0]], [...profileData.inventoryArray[1]], [...profileData.inventoryArray[2]], [...profileData.inventoryArray[3]]];
		const randomRarePlantArrayIndex = Math.floor(Math.random() * arrays.rarePlantNamesArray.length);

		++userInventoryArray[2][randomRarePlantArrayIndex];

		(profileData.inventoryArray != userInventoryArray) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): inventoryArray[3] changed from \x1b[33m[${profileData.inventoryArray[3]}] \x1b[0mto \x1b[33m[${userInventoryArray[3]}] \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		profileData = await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { inventoryArray: userInventoryArray } },
				{ new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});

		return arrays.rarePlantNamesArray[randomRarePlantArrayIndex];
	},

};