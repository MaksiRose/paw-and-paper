const profileModel = require('../models/profileModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap } = require('./itemsInfo');

module.exports = {

	async pickRandomCommonPlant(message, profileData) {

		const userInventory = {
			commonPlants: { ...profileData.inventoryObject.commonPlants },
			uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
			rarePlants: { ...profileData.inventoryObject.rarePlants },
			meat: { ...profileData.inventoryObject.meat },
		};

		const randomCommonPlant = Array.from(commonPlantsMap.keys())[Math.floor(Math.random() * Array.from(commonPlantsMap.keys()).length)];

		userInventory.commonPlants[randomCommonPlant] += 1;

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { inventoryObject: userInventory } },
		);

		return randomCommonPlant;
	},

	async pickRandomUncommonPlant(message, profileData) {

		const userInventory = {
			commonPlants: { ...profileData.inventoryObject.commonPlants },
			uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
			rarePlants: { ...profileData.inventoryObject.rarePlants },
			meat: { ...profileData.inventoryObject.meat },
		};

		const randomUncommonPlant = Array.from(uncommonPlantsMap.keys())[Math.floor(Math.random() * Array.from(uncommonPlantsMap.keys()).length)];

		userInventory.uncommonPlants[randomUncommonPlant] += 1;

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { inventoryObject: userInventory } },
		);

		return randomUncommonPlant;
	},

	async pickRandomRarePlant(message, profileData) {

		const userInventory = {
			commonPlants: { ...profileData.inventoryObject.commonPlants },
			uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
			rarePlants: { ...profileData.inventoryObject.rarePlants },
			meat: { ...profileData.inventoryObject.meat },
		};

		const randomRarePlant = Array.from(rarePlantsMap.keys())[Math.floor(Math.random() * Array.from(rarePlantsMap.keys()).length)];

		userInventory.rarePlants[randomRarePlant] += 1;

		profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { inventoryObject: userInventory } },
		);

		return randomRarePlant;
	},

};