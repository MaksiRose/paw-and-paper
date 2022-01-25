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

		(profileData.inventoryObject != userInventory) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): inventoryObject.commonPlants changed from \x1b[33m${JSON.stringify(profileData.inventoryObject.commonPlants)} \x1b[0mto \x1b[33m${JSON.stringify(userInventory.commonPlants)} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		profileData = await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { inventoryObject: userInventory } },
			)
			.catch((error) => {
				throw new Error(error);
			});

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

		(profileData.inventoryObject != userInventory) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): inventoryObject.uncommonPlants changed from \x1b[33m${JSON.stringify(profileData.inventoryObject.uncommonPlants)} \x1b[0mto \x1b[33m${JSON.stringify(userInventory.uncommonPlants)} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		profileData = await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { inventoryObject: userInventory } },
			)
			.catch((error) => {
				throw new Error(error);
			});

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

		(profileData.inventoryObject != userInventory) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): inventoryObject.rarePlants changed from \x1b[33m${JSON.stringify(profileData.inventoryObject.rarePlants)} \x1b[0mto \x1b[33m[${JSON.stringify(userInventory.rarePlants)}] \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		profileData = await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { inventoryObject: userInventory } },
			)
			.catch((error) => {
				throw new Error(error);
			});

		return randomRarePlant;
	},

};