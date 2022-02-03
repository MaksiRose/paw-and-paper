const profileModel = require('../models/profileModel');
const maps = require('./maps');

module.exports = {

	async randomCommonPlant(message, profileData) {

		const userInventory = {
			commonPlants: { ...profileData.inventoryObject.commonPlants },
			uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
			rarePlants: { ...profileData.inventoryObject.rarePlants },
			meat: { ...profileData.inventoryObject.meat },
		};

		const randomCommonPlant = Array.from(maps.commonPlantMap.keys())[Math.floor(Math.random() * Array.from(maps.commonPlantMap.keys()).length)];

		userInventory.commonPlants[randomCommonPlant] += 1;

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { inventoryObject: userInventory } },
		);

		return randomCommonPlant;
	},

	async randomUncommonPlant(message, profileData) {

		const userInventory = {
			commonPlants: { ...profileData.inventoryObject.commonPlants },
			uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
			rarePlants: { ...profileData.inventoryObject.rarePlants },
			meat: { ...profileData.inventoryObject.meat },
		};

		const randomUncommonPlant = Array.from(maps.uncommonPlantMap.keys())[Math.floor(Math.random() * Array.from(maps.uncommonPlantMap.keys()).length)];

		userInventory.uncommonPlants[randomUncommonPlant] += 1;

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { inventoryObject: userInventory } },
		);

		return randomUncommonPlant;
	},

	async randomRarePlant(message, profileData) {

		const userInventory = {
			commonPlants: { ...profileData.inventoryObject.commonPlants },
			uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
			rarePlants: { ...profileData.inventoryObject.rarePlants },
			meat: { ...profileData.inventoryObject.meat },
		};

		const randomRarePlant = Array.from(maps.rarePlantMap.keys())[Math.floor(Math.random() * Array.from(maps.rarePlantMap.keys()).length)];

		userInventory.rarePlants[randomRarePlant] += 1;

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { inventoryObject: userInventory } },
		);

		return randomRarePlant;
	},

};