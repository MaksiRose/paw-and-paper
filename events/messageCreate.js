// @ts-check
const config = require('../config.json');
const { profileModel } = require('../models/profileModel');
const serverModel = require('../models/serverModel');
const errorHandling = require('../utils/errorHandling');
const { activeCommandsObject } = require('../utils/commandCollector');
const createGuild = require('../utils/createGuild');
const { pronoun, pronounAndPlural } = require('../utils/getPronouns');
let lastMessageEpochTime = 0;
const userMap = new Map();

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'messageCreate',
	once: false,

	/**
	 * Emitted whenever a message is created.
	 * @param {import('../paw').client} client
	 * @param {import('discord.js').Message} message
	 */
	async execute(client, message) {

		const prefix = config.prefix;

		if (!message.content.toLowerCase().startsWith(prefix) || message.author.bot || message.channel.type === 'DM') {

			return;
		}

		let serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({
			serverId: message.guild.id,
		}));

		if (!serverData) {

			await createGuild(client, message.guild);
		}

		let profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({
			userId: message.author.id,
			serverId: message.guild.id,
		}));

		let pingRuins = false;
		const embedArray = [];

		const argumentsArray = message.content.slice(prefix.length).trim().split(/ +/);
		const commandName = argumentsArray.shift().toLowerCase();

		const command = client.commands[commandName] || client.commands[Object.keys(client.commands).find(cmnd => client.commands[cmnd].aliases !== undefined && client.commands[cmnd].aliases.includes(commandName))];

		if (command === undefined) {

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

			userMap.set('nr' + message.author.id + message.guild.id, { activeCommands: 0, lastGentleWaterReminderTimestamp: 0, activityTimeout: null, cooldownTimeout: null, restingTimeout: null });
		}

		clearTimeout(userMap.get('nr' + message.author.id + message.guild.id).activityTimeout);
		clearTimeout(userMap.get('nr' + message.author.id + message.guild.id).cooldownTimeout);
		clearTimeout(userMap.get('nr' + message.author.id + message.guild.id).restingTimeout);

		// @ts-ignore
		if (Object.hasOwn(activeCommandsObject, 'nr' + message.author.id + message.guild.id)) {

			await activeCommandsObject['nr' + message.author.id + message.guild.id]();
		}

		try {

			console.log(`\x1b[32m${message.author.tag}\x1b[0m successfully executed \x1b[33m${message.content} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			if (serverData.activeUsersArray.findIndex(element => element == message.author.id) == -1) {

				serverData.activeUsersArray.push(message.author.id);

				serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { activeUsersArray: serverData.activeUsersArray } },
				));
			}

			userMap.get('nr' + message.author.id + message.guild.id).activeCommands += 1;
			userMap.get('nr' + message.author.id + message.guild.id).activityTimeout = setTimeout(removeActiveUser, 300000);

			if (command.name !== 'say') {

				await message.channel
					.sendTyping()
					.catch(async (error) => {
						return await errorHandling.output(message, error);
					});
			}

			await command
				.sendMessage(client, message, argumentsArray, profileData, serverData, embedArray, pingRuins)
				.then(async () => {

					userMap.get('nr' + message.author.id + message.guild.id).activeCommands -= 1;

					if (profileData && userMap.get('nr' + message.author.id + message.guild.id).activeCommands <= 0) {

						profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({
							userId: message.author.id,
							serverId: message.guild.id,
						}));

						userMap.get('nr' + message.author.id + message.guild.id).cooldownTimeout = setTimeout(removeCooldown, 1000);
					}
				});
		}
		catch (error) {

			userMap.get('nr' + message.author.id + message.guild.id).activeCommands -= 1;

			if (profileData && userMap.get('nr' + message.author.id + message.guild.id).activeCommands <= 0) {

				profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({
					userId: message.author.id,
					serverId: message.guild.id,
				}));

				userMap.get('nr' + message.author.id + message.guild.id).cooldownTimeout = setTimeout(removeCooldown, 1000);
			}

			await errorHandling.output(message, error);
		}

		profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({
			userId: message.author.id,
			serverId: message.guild.id,
		}));

		const oneHourInMs = 3600000;
		// If sapling exists, the watering time is between 2 hours from perfect and 3 hours from perfect, and there wasn't a reminder in the last hour
		// The reminder in the last hour prevents the reminder from being sent out multiple times
		if (profileData !== null && profileData.saplingObject.exists === true && Date.now() > profileData.saplingObject.nextWaterTimestamp + oneHourInMs * 2 && Date.now() < profileData.saplingObject.nextWaterTimestamp + oneHourInMs * 3 && Date.now() > userMap.get('nr' + message.author.id + message.guild.id).lastGentleWaterReminderTimestamp + oneHourInMs) {

			userMap.get('nr' + message.author.id + message.guild.id).lastGentleWaterReminderTimestamp = Date.now();

			await message.channel
				.send({
					embeds: [{
						color: /** @type {`#${string}`} */ (profileData.color),
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*Engrossed in ${pronoun(profileData, 2)} work, ${profileData.name} suddenly remembers that ${pronounAndPlural(profileData, 0, 'has', 'have')} not yet watered ${pronoun(profileData, 2)} plant today. The ${profileData.species} should really do it soon!*`,
						footer: { text: 'Type "rp water" to water your ginkgo sapling!' },
					}],
				})
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});
		}

		/*
		This ensures that no two timeouts are set at the same time, and only one of them being cleared. When a command that doesn't immediately return (ie explore) is called, this timeout doesn't exist yet, but the old timeout was already cleared. If a second command (ie stats) is started while the old one is still running, it will try to delete the same timeout that the first command (aka explore) already cleared, and create a new one, that subsequently is going to be overwritten by the first command (aka explore) once it is finished. That means that the timeout created by the other command (aka stats) is never going to be cleared, and instead only the timeout of the last finished command (aka explore) is going to be cleared, which means that 10 minutes after the other command (aka stats) was executed, the user will start automatically resting, even if they were still actively playing in that time.
		It is not a good idea to place clearing the timeout behind the command finish executing, since the command finish executing might take some time, and the 10 minutes from that timer might over in that time, making the user attempt to rest while executing a command.
		It is also not a good idea to place starting the timeout before the command start executing, since the command again might take some time to finish executing, and then the 10 minute timer might be over sooner as expected.
		*/
		if (userMap.get('nr' + message.author.id + message.guild.id).activeCommands === 0) {

			userMap.get('nr' + message.author.id + message.guild.id).restingTimeout = setTimeout(startResting, 600000);
		}

		/**
		 * Checks if character is eligable for resting, and executes rest command if true.
		 */
		async function startResting() {

			profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({
				userId: message.author.id,
				serverId: message.guild.id,
			}));

			if (profileData && (profileData.energy > 0 && profileData.health > 0 && profileData.hunger > 0 && profileData.thirst > 0) && profileData.isResting === false && profileData.energy < profileData.maxEnergy) {

				message.content = `${config.prefix}rest`;

				await module.exports.execute(client, message);
			}
		}

		/**
		 * Sets `hasCooldown` to false.
		 */
		async function removeCooldown() {

			/** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { hasCooldown: false } },
			));
		}

		/**
		 * Looks for this users ID in `activeUserArray` and removes it.
		 */
		async function removeActiveUser() {

			serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({ serverId: message.guild.id }));
			const authorIndex = serverData.activeUsersArray.findIndex(element => element == message.author.id);

			if (authorIndex >= 0) {

				serverData.activeUsersArray.splice(authorIndex, 1);

				/** @type {import('../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
					{ serverId: message.guild.id },
					{ $set: { activeUsersArray: serverData.activeUsersArray } },
				));
			}
		}
	},
};
module.exports = event;