const serverModel = require('../models/serverModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {

		console.log('Paw and Paper is online!');
		client.user.setActivity('this awesome RPG :)\nrp help', { type: 'PLAYING' });

		for (const file of ['commands', 'profiles', 'servers']) {

			require(`../handlers/${file}`).execute(client);
		}

		for (const [, guild] of await client.guilds.fetch()) {

			const serverData = await serverModel.findOne({
				serverId: guild.id,
			});

			if (!serverData) {

				const serverInventoryObject = {
					commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
					uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
					rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
					meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
				};

				await serverModel.create({
					serverId: guild.id,
					name: guild.name,
					inventoryObject: serverInventoryObject,
					blockedEntranceObject: { den: null, blockedKind: null },
					activeUsersArray: [],
					nextPossibleAttack: Date.now(),
					visitChannelId: null,
					currentlyVisiting: null,
				});
			}
		}
	},
};