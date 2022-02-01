const config = require('../config.json');
const profileModel = require('../models/profileSchema');
const serverModel = require('../models/serverSchema');
const errorHandling = require('../utils/errorHandling');
const arrays = require('../utils/arrays');
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

		let profileData = await profileModel
			.findOne({
				userId: message.author.id,
				serverId: message.guild.id,
			}).catch(async (error) => {
				return await errorHandling.output(message, error);
			});

		const species = arrays.species(profileData);

		let serverData = await serverModel
			.findOne({
				serverId: message.guild.id,
			})
			.catch(async (error) => {
				return await errorHandling.output(message, error);
			});

		if (!serverData) {

			serverData = await serverModel.create({
				serverId: message.guild.id,
				name: message.guild.name,
				commonPlantsArray: Array(arrays.commonPlantNamesArray.length).fill(0),
				uncommonPlantsArray: Array(arrays.uncommonPlantNamesArray.length).fill(0),
				rarePlantsArray: Array(arrays.rarePlantNamesArray.length).fill(0),
				meatArray: Array(species.nameArray.length).fill(0),
			}).catch(async (error) => {
				return await errorHandling.output(message, error);
			});

			await serverData
				.save()
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});
		}

		if (species.nameArray.length > serverData.meatArray.length) {

			const serverDataMeatArray = [...serverData.meatArray].concat(new Array(species.nameArray.length - serverData.meatArray.length).fill(0));

			console.log(`\x1b[32m\x1b[0m${message.guild.name} (${message.guild.id}): meatArray changed from \x1b[33m${serverData.meatArray} \x1b[0mto \x1b[33m${serverDataMeatArray} \x1b[0mthrough \x1b[32m${message.author.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			serverData = await serverModel
				.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { meatArray: serverDataMeatArray } },
					{ new: true },
				)
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});
		}

		if (arrays.commonPlantNamesArray.length > serverData.commonPlantsArray.length) {

			const serverDataCommonPlantsArray = [...serverData.commonPlantsArray].concat(new Array(arrays.commonPlantNamesArray.length - serverData.commonPlantsArray.length).fill(0));

			console.log(`\x1b[32m\x1b[0m${message.guild.name} (${message.guild.id}): commonPlantsArray changed from \x1b[33m${serverData.commonPlantsArray} \x1b[0mto \x1b[33m${serverDataCommonPlantsArray} \x1b[0mthrough \x1b[32m${message.author.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			serverData = await serverModel
				.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { commonPlantsArray: serverDataCommonPlantsArray } },
					{ new: true },
				)
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});
		}

		if (arrays.uncommonPlantNamesArray.length > serverData.uncommonPlantsArray.length) {

			const serverDataUncommonPlantsArray = [...serverData.uncommonPlantsArray].concat(new Array(arrays.uncommonPlantNamesArray.length - serverData.uncommonPlantsArray.length).fill(0));

			console.log(`\x1b[32m\x1b[0m${message.guild.name} (${message.guild.id}): uncommonPlantsArray changed from \x1b[33m${serverData.uncommonPlantsArray} \x1b[0mto \x1b[33m${serverDataUncommonPlantsArray} \x1b[0mthrough \x1b[32m${message.author.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			serverData = await serverModel
				.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { uncommonPlantsArray: serverDataUncommonPlantsArray } },
					{ new: true },
				)
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});
		}

		if (arrays.rarePlantNamesArray.length > serverData.rarePlantsArray.length) {

			const serverDataRarePlantsArray = [...serverData.rarePlantsArray].concat(new Array(arrays.rarePlantNamesArray.length - serverData.rarePlantsArray.length).fill(0));

			console.log(`\x1b[32m\x1b[0m${message.guild.name} (${message.guild.id}): rarePlantsArray changed from \x1b[33m${serverData.rarePlantsArray} \x1b[0mto \x1b[33m${serverDataRarePlantsArray} \x1b[0mthrough \x1b[32m${message.author.tag} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			serverData = await serverModel
				.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { rarePlantsArray: serverDataRarePlantsArray } },
					{ new: true },
				)
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});
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
					throw new Error(error);
				});

			return console.log(`\x1b[32m\x1b[0m${message.author.tag} unsuccessfully tried to execute \x1b[33m${message.content} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
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

			console.log(`\x1b[32m\x1b[0m${message.author.tag} successfully executed \x1b[33m${message.content} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

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

						profileData = await profileModel
							.findOne({
								userId: message.author.id,
								serverId: message.guild.id,
							}).catch(async (error) => {
								return await errorHandling.output(message, error);
							});

						automaticCooldownTimeoutArray[message.author.id] = setTimeout(async function() {

							(profileData.hasCooldown != false) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): hasCooldown changed from \x1b[33m${profileData.hasCooldown} \x1b[0mto \x1b[33mfalse \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
							profileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
									{ new: true },
								)
								.catch(async (error) => {
									await errorHandling.output(message, error);
								});
						}, 3000);
					}
				})
				.catch(() => {
					--usersActiveCommandsAmountMap.get(message.author.id).activeCommands;
				});
		}
		catch (error) {

			await errorHandling.output(message, error);
		}

		automaticRestingTimeoutArray[message.author.id] = setTimeout(async () => {

			await automaticRestingTimeoutFunction();
		}, 600000);

		async function automaticRestingTimeoutFunction() {

			profileData = await profileModel
				.findOne({
					userId: message.author.id,
					serverId: message.guild.id,
				})
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});

			if (profileData && profileData.isResting == false && profileData.energy < profileData.maxEnergy) {

				await rest
					.sendMessage(client, message, [], profileData, serverData, embedArray)
					.then(async () => {

						automaticCooldownTimeoutArray[message.author.id] = setTimeout(async function() {

							(profileData.hasCooldown != false) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): hasCooldown changed from \x1b[33m${profileData.hasCooldown} \x1b[0mto \x1b[33mfalse \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
							profileData = await profileModel
								.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $set: { hasCooldown: false } },
									{ new: true },
								)
								.catch(async (error) => {
									await errorHandling.output(message, error);
								});
						}, 3000);
					})
					.catch(async (error) => {
						return await errorHandling.output(message, error);
					});
			}
		}
	},
};