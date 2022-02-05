const config = require('../config.json');
const profileModel = require('../models/profileModel');
const serverModel = require('../models/serverModel');
const errorHandling = require('../utils/errorHandling');
const maps = require('../utils/maps');
const rest = require('../commands/general/rest');
let lastMessageEpochTime = 0;
const automaticRestingTimeoutArray = new Array();
const automaticCooldownTimeoutArray = new Array();
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

			for (const [commonPlantName] of maps.commonPlantMap) {

				serverInventoryObject.commonPlants[commonPlantName] = 0;
			}

			for (const [uncommonPlantName] of maps.uncommonPlantMap) {

				serverInventoryObject.uncommonPlants[uncommonPlantName] = 0;
			}

			for (const [rarePlantName] of maps.rarePlantMap) {

				serverInventoryObject.rarePlants[rarePlantName] = 0;
			}

			for (const [speciesName] of maps.speciesMap) {

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

		if (maps.speciesMap.size > Object.keys(serverData.inventoryObject.meat).length) {

			const serverMeatObject = { ...serverData.inventoryObject.meat };

			for (const [speciesName] of maps.speciesMap) {

				if (speciesName in serverMeatObject) {

					serverMeatObject[speciesName] = 0;
				}
			}

			serverData = await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { 'inventoryObject.meat': serverMeatObject } },
			);
		}

		if (maps.commonPlantMap.size > Object.keys(serverData.inventoryObject.commonPlants).length) {

			const serverCommonPlantMap = new Map(JSON.parse(JSON.stringify([...serverData.inventoryObject.commonPlants])));

			for (const [speciesName] of maps.commonPlantMap) {

				if (!serverCommonPlantMap.has(speciesName)) {

					serverCommonPlantMap.set(speciesName, 0);
				}
			}

			serverData = await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { 'inventoryObject.commonPlants': serverCommonPlantMap } },
			);
		}

		if (maps.uncommonPlantMap.size > Object.keys(serverData.inventoryObject.uncommonPlants).length) {

			const serverUncommonPlantMap = new Map(JSON.parse(JSON.stringify([...serverData.inventoryObject.uncommonPlants])));

			for (const [speciesName] of maps.uncommonPlantMap) {

				if (!serverUncommonPlantMap.has(speciesName)) {

					serverUncommonPlantMap.set(speciesName, 0);
				}
			}

			serverData = await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { 'inventoryObject.uncommonPlants': serverUncommonPlantMap } },
			);
		}

		if (maps.rarePlantMap.size > Object.keys(serverData.inventoryObject.rarePlants).length) {

			const serverRarePlantMap = new Map(JSON.parse(JSON.stringify([...serverData.inventoryObject.rarePlants])));

			for (const [speciesName] of maps.rarePlantMap) {

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

		clearTimeout(automaticCooldownTimeoutArray[message.author.id]);
		clearTimeout(automaticRestingTimeoutArray[message.author.id]);

		try {

			console.log(`\x1b[32m${message.author.tag}\x1b[0m successfully executed \x1b[33m${message.content} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			if (usersActiveCommandsAmountMap.has(message.author.id) == false) {

				usersActiveCommandsAmountMap.set(message.author.id, { activeCommands: 0 });
			}
			usersActiveCommandsAmountMap.get(message.author.id).activeCommands++;

			await message.channel
				.sendTyping()
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});

			await command
				.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray, pingRuins)
				.then(async () => {

					--usersActiveCommandsAmountMap.get(message.author.id).activeCommands;

					if (profileData && usersActiveCommandsAmountMap.get(message.author.id).activeCommands <= 0) {

						profileData = await profileModel.findOne({
							userId: message.author.id,
							serverId: message.guild.id,
						});

						automaticCooldownTimeoutArray[message.author.id] = setTimeout(async function() {

							profileData = await profileModel.findOneAndUpdate(
								{ userId: message.author.id, serverId: message.guild.id },
								{ $set: { hasCooldown: false } },
							);
						}, 3000);
					}
				})
				.catch(async (error) => {
					--usersActiveCommandsAmountMap.get(message.author.id).activeCommands;
					await errorHandling.output(message, error);
				});
		}
		catch (error) {

			await errorHandling.output(message, error);
		}

		automaticRestingTimeoutArray[message.author.id] = setTimeout(async () => {

			await automaticRestingTimeoutFunction();
		}, 600000);

		async function automaticRestingTimeoutFunction() {

			profileData = await profileModel.findOne({
				userId: message.author.id,
				serverId: message.guild.id,
			});

			if (profileData && profileData.isResting == false && profileData.energy < profileData.maxEnergy) {

				await rest
					.sendMessage(client, message, [], profileData, serverData, embedArray)
					.then(async () => {

						automaticCooldownTimeoutArray[message.author.id] = setTimeout(async function() {

							profileData = await profileModel.findOneAndUpdate(
								{ userId: message.author.id, serverId: message.guild.id },
								{ $set: { hasCooldown: false } },
							);
						}, 3000);
					})
					.catch(async (error) => {
						return await errorHandling.output(message, error);
					});
			}
		}
	},
};