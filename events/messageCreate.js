const config = require('../config.json');
const profileModel = require('../models/profileModel');
const serverModel = require('../models/serverModel');
const errorHandling = require('../utils/errorHandling');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');
const { activeCommandsObject } = require('../utils/commandCollector');
let lastMessageEpochTime = 0;
const userMap = new Map();

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
				commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
				uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
				rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
				meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
			};

			serverData = await serverModel.create({
				serverId: message.guild.id,
				name: message.guild.name,
				inventoryObject: serverInventoryObject,
				activeUsersArray: [],
				nextPossibleAttack: Date.now(),
			});
		}

		let pingRuins = false;
		const embedArray = [];

		const argumentsArray = message.content.slice(prefix.length).trim().split(/ +/);
		const commandName = argumentsArray.shift().toLowerCase();

		const command = client.commands[commandName] || client.commands[Object.keys(client.commands).find(cmnd => client.commands[cmnd].aliases !== undefined && client.commands[cmnd].aliases.includes(commandName))];
		console.log(command);

		if (command === undefined) {

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

		if (command.name === 'say') {

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

		if (userMap.has('nr' + message.author.id + message.guild.id) == false) {

			userMap.set('nr' + message.author.id + message.guild.id, { activeCommands: 0, activityTimeout: null, cooldownTimeout: null, restingTimeout: null });
		}

		clearTimeout(userMap.get('nr' + message.author.id + message.guild.id).activityTimeout);
		clearTimeout(userMap.get('nr' + message.author.id + message.guild.id).cooldownTimeout);
		clearTimeout(userMap.get('nr' + message.author.id + message.guild.id).restingTimeout);

		if (Object.hasOwn(activeCommandsObject, 'nr' + message.author.id + message.guild.id)) {

			await activeCommandsObject['nr' + message.author.id + message.guild.id]();
		}

		try {

			console.log(`\x1b[32m${message.author.tag}\x1b[0m successfully executed \x1b[33m${message.content} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			if (serverData.activeUsersArray.findIndex(element => element == message.author.id) == -1) {

				serverData.activeUsersArray.push(message.author.id);

				serverData = await serverModel.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { activeUsersArray: serverData.activeUsersArray } },
				);
			}

			userMap.get('nr' + message.author.id + message.guild.id).activeCommands += 1;
			userMap.get('nr' + message.author.id + message.guild.id).activityTimeout = setTimeout(removeActiveUser, 300000);

			await message.channel
				.sendTyping()
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});

			await command
				.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray, pingRuins)
				.then(async () => {

					userMap.get('nr' + message.author.id + message.guild.id).activeCommands -= 1;

					if (profileData && userMap.get('nr' + message.author.id + message.guild.id).activeCommands <= 0) {

						profileData = await profileModel.findOne({
							userId: message.author.id,
							serverId: message.guild.id,
						});

						userMap.get('nr' + message.author.id + message.guild.id).cooldownTimeout = setTimeout(removeCooldown, 1000);
					}
				});
		}
		catch (error) {

			userMap.get('nr' + message.author.id + message.guild.id).activeCommands -= 1;

			if (profileData && userMap.get('nr' + message.author.id + message.guild.id).activeCommands <= 0) {

				profileData = await profileModel.findOne({
					userId: message.author.id,
					serverId: message.guild.id,
				});

				userMap.get('nr' + message.author.id + message.guild.id).cooldownTimeout = setTimeout(removeCooldown, 1000);
			}

			await errorHandling.output(message, error);
		}

		userMap.get('nr' + message.author.id + message.guild.id).restingTimeout = setTimeout(startResting, 600000);

		async function startResting() {

			profileData = await profileModel.findOne({
				userId: message.author.id,
				serverId: message.guild.id,
			});

			if (profileData && profileData.isResting == false && profileData.energy < profileData.maxEnergy) {

				message.content = `${config.prefix}rest`;

				await module.exports.execute(client, message);
			}
		}

		async function removeCooldown() {

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { hasCooldown: false } },
			);
		}

		async function removeActiveUser() {

			serverData = await serverModel.findOne({ serverId: message.guild.id });
			const authorIndex = serverData.activeUsersArray.findIndex(element => element == message.author.id);

			if (authorIndex >= 0) {

				serverData.activeUsersArray.splice(authorIndex, 1);

				serverData = await serverModel.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { activeUsersArray: serverData.activeUsersArray } },
				);
			}
		}
	},
};