const config = require('../config.json');
const profileModel = require('../models/profileModel');
const serverModel = require('../models/serverModel');
const errorHandling = require('../utils/errorHandling');
const rest = require('../commands/general/rest');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');
let lastMessageEpochTime = 0;
const automaticRestingTimeoutMap = new Map();
const automaticCooldownTimeoutMap = new Map();
const usersActiveCommandsAmountMap = new Map();

module.exports = {
	name: 'messageCreate',
	once: false,
	async execute(client, message) {

		const prefix = config.prefix;

		if (!message.content.toLowerCase().startsWith(prefix) || message.author.bot || message.channel.type === 'dm') {

			return;
		}

		let profileData = await profileModel.findOne({
			userId: message.author.id,
			serverId: message.guild.id,
		});

		let serverData = await serverModel.findOne({
			serverId: message.guild.id,
		});

		if (!serverData) {

			const serverInventoryObject = {
				commonPlants: {},
				uncommonPlants: {},
				rarePlants: {},
				meat: {},
			};

			for (const [commonPlantName] of commonPlantsMap) {

				serverInventoryObject.commonPlants[commonPlantName] = 0;
			}

			for (const [uncommonPlantName] of uncommonPlantsMap) {

				serverInventoryObject.uncommonPlants[uncommonPlantName] = 0;
			}

			for (const [rarePlantName] of rarePlantsMap) {

				serverInventoryObject.rarePlants[rarePlantName] = 0;
			}

			for (const [speciesName] of speciesMap) {

				serverInventoryObject.meat[speciesName] = 0;
			}

			serverData = await serverModel.create({
				serverId: message.guild.id,
				name: message.guild.name,
				inventoryObject: serverInventoryObject,
				accountsToDelete: {},
				activeUsersArray: [],
			});
		}

		if (speciesMap.size > Object.keys(serverData.inventoryObject.meat).length) {

			const serverMeatObject = { ...serverData.inventoryObject.meat };

			for (const [speciesName] of speciesMap) {

				if (speciesName in serverMeatObject) {

					serverMeatObject[speciesName] = 0;
				}
			}

			serverData = await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { 'inventoryObject.meat': serverMeatObject } },
			);
		}

		if (commonPlantsMap.size > Object.keys(serverData.inventoryObject.commonPlants).length) {

			const serverCommonPlantMap = new Map(JSON.parse(JSON.stringify([...serverData.inventoryObject.commonPlants])));

			for (const [speciesName] of commonPlantsMap) {

				if (!serverCommonPlantMap.has(speciesName)) {

					serverCommonPlantMap.set(speciesName, 0);
				}
			}

			serverData = await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { 'inventoryObject.commonPlants': serverCommonPlantMap } },
			);
		}

		if (uncommonPlantsMap.size > Object.keys(serverData.inventoryObject.uncommonPlants).length) {

			const serverUncommonPlantMap = new Map(JSON.parse(JSON.stringify([...serverData.inventoryObject.uncommonPlants])));

			for (const [speciesName] of uncommonPlantsMap) {

				if (!serverUncommonPlantMap.has(speciesName)) {

					serverUncommonPlantMap.set(speciesName, 0);
				}
			}

			serverData = await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { 'inventoryObject.uncommonPlants': serverUncommonPlantMap } },
			);
		}

		if (rarePlantsMap.size > Object.keys(serverData.inventoryObject.rarePlants).length) {

			const serverRarePlantMap = new Map(JSON.parse(JSON.stringify([...serverData.inventoryObject.rarePlants])));

			for (const [speciesName] of rarePlantsMap) {

				if (!serverRarePlantMap.has(speciesName)) {

					serverRarePlantMap.set(speciesName, 0);
				}
			}

			serverData = await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { 'inventoryObject.rarePlants': serverRarePlantMap } },
			);
		}

		let pingRuins = false;
		const embedArray = [];

		const argumentsArray = message.content.slice(prefix.length).trim().split(/ +/);
		const cmd = argumentsArray.shift().toLowerCase();

		const command = client.commands.get(cmd) || client.commands.find(cmnd => cmnd.aliases && cmnd.aliases.includes(cmd));

		if (!command) {

			await message
				.reply({
					embeds: [{
						title: 'This command doesn\'t exist!',
						description: 'Please check \'rp help\' to review your options.',
					}],
				})
				.catch(async (error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			console.log(`\x1b[32m${message.author.tag}\x1b[0m unsuccessfully tried to execute \x1b[33m${message.content} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			return;
		}

		if (command == 'say') {

			if (profileData.currentRegion == 'ruins') {

				const currentEpochTime = Date.now();
				const cooldownMilliseconds = 3600000;
				const expirationEpochTime = lastMessageEpochTime + cooldownMilliseconds;

				/*
				Every time the bot starts up or the 1-hour-Timeout executes, lastMessageEpochTime is set to 0 (January 1, 1970)
				This sets expirationEpochTime to one hour after January 1, 1970, making it smaller than the current time
				This means that pings get set to true for this command (which is reset every time a new message is called)
				After that, lastMessageEpochTime is set to the current time, making expirationEpochTime bigger than currentEpochTime
				This means that every following command will not set the Ping to true, until the Timeout executes and lastMessageEpochTime is back to 0 (January 1, 1970)
				*/

				if (expirationEpochTime < currentEpochTime) {

					pingRuins = true;
				}

				lastMessageEpochTime = currentEpochTime;

				setTimeout(() => lastMessageEpochTime = 0, cooldownMilliseconds);
			}
		}

		clearTimeout(automaticCooldownTimeoutMap.get('nr' + message.author.id + message.guild.id));
		clearTimeout(automaticRestingTimeoutMap.get('nr' + message.author.id + message.guild.id));

		try {

			console.log(`\x1b[32m${message.author.tag}\x1b[0m successfully executed \x1b[33m${message.content} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			if (usersActiveCommandsAmountMap.has('nr' + message.author.id + message.guild.id) == false) {

				usersActiveCommandsAmountMap.set('nr' + message.author.id + message.guild.id, { activeCommands: 0 });
			}
			usersActiveCommandsAmountMap.get('nr' + message.author.id + message.guild.id).activeCommands += 1;

			await message.channel
				.sendTyping()
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});

			await command
				.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray, pingRuins)
				.then(async () => {

					usersActiveCommandsAmountMap.get('nr' + message.author.id + message.guild.id).activeCommands -= 1;

					if (profileData && usersActiveCommandsAmountMap.get('nr' + message.author.id + message.guild.id).activeCommands <= 0) {

						profileData = await profileModel.findOne({
							userId: message.author.id,
							serverId: message.guild.id,
						});

						automaticCooldownTimeoutMap.set('nr' + message.author.id + message.guild.id, setTimeout(await removeCooldown, 500));
					}
				});
		}
		catch (error) {

			usersActiveCommandsAmountMap.get('nr' + message.author.id + message.guild.id).activeCommands -= 1;

			if (profileData && usersActiveCommandsAmountMap.get('nr' + message.author.id + message.guild.id).activeCommands <= 0) {

				profileData = await profileModel.findOne({
					userId: message.author.id,
					serverId: message.guild.id,
				});

				automaticCooldownTimeoutMap.set('nr' + message.author.id + message.guild.id, setTimeout(await removeCooldown, 500));
			}

			await errorHandling.output(message, error);
		}

		automaticRestingTimeoutMap.set('nr' + message.author.id + message.guild.id, setTimeout(await startResting, 600000));

		async function removeCooldown() {

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { hasCooldown: false } },
			);
		}

		async function startResting() {

			profileData = await profileModel.findOne({
				userId: message.author.id,
				serverId: message.guild.id,
			});

			if (profileData && profileData.isResting == false && profileData.energy < profileData.maxEnergy) {

				await rest
					.sendMessage(client, message, [], profileData, serverData, embedArray)
					.then(async () => {

						automaticCooldownTimeoutMap.set('nr' + message.author.id + message.guild.id, setTimeout(await removeCooldown, 500));
					})
					.catch(async (error) => {
						return await errorHandling.output(message, error);
					});
			}
		}
	},
};