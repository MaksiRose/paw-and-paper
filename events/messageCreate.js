// @ts-check
const config = require('../config.json');
const profileModel = require('../models/profileModel');
const serverModel = require('../models/serverModel');
const errorHandling = require('../utils/errorHandling');
const { activeCommandsObject } = require('../utils/commandCollector');
const { createGuild } = require('../utils/updateGuild');
const { pronoun, pronounAndPlural } = require('../utils/getPronouns');
const userMap = require('../utils/userMap');

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

		/* Checking if the message starts with the prefix, if the author is a bot, or if the channel is a DM. */
		if (!message.content.toLowerCase().startsWith(prefix) || message.author.bot || message.channel.type === 'DM') {

			return;
		}

		let serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({
			serverId: message.guild.id,
		}));

		/* Checking if the serverData is not null. If it is not null, it will create a guild. */
		if (!serverData) {

			await createGuild(client, message.guild);
		}

		/* Getting the user's profile data from the database. */
		let userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({
			userId: message.author.id,
		}));
		let characterData = userData.characters[userData.currentCharacter[message.guild.id]];
		let profileData = characterData.profiles[message.guild.id];

		let pingRuins = false;
		const embedArray = [];

		/* Taking the command name and arguments from the message and storing them in variables. */
		const argumentsArray = message.content.slice(prefix.length).trim().split(/ +/);
		const commandName = argumentsArray.shift().toLowerCase();

		const command = client.commands[commandName] || client.commands[Object.keys(client.commands).find(cmnd => client.commands[cmnd].aliases !== undefined && client.commands[cmnd].aliases.includes(commandName))];

		/* Checking if the command is undefined. If it is, it will return. */
		if (command === undefined) {

			return;
		}

		if (userMap.has('nr' + message.author.id + message.guild.id) === false) {

			userMap.set('nr' + message.author.id + message.guild.id, { activeCommands: 0, lastGentleWaterReminderTimestamp: 0, lastMessageTimestamp: 0, activityTimeout: null, cooldownTimeout: null, restingTimeout: null });
		}

		if (command.name === 'say' && profileData.currentRegion === 'ruins') {

			const currentTimestamp = Date.now();
			const cooldownMilliseconds = 3600000;
			const expirationTimestamp = userMap.get('nr' + message.author.id + message.guild.id).lastMessageTimestamp + cooldownMilliseconds;

			/*
				Every time the bot starts up or the 1-hour-Timeout executes, lastMessageEpochTime is set to 0 (January 1, 1970)
				This sets expirationTimestamp to one hour after January 1, 1970, making it smaller than the current time
				This means that pings get set to true for this command (which is reset every time a new message is called)
				After that, lastMessageEpochTime is set to the current time, making expirationTimestamp bigger than currentTimestamp
				This means that every following command will not set the Ping to true, until the Timeout executes and lastMessageEpochTime is back to 0 (January 1, 1970)
				*/

			if (expirationTimestamp < currentTimestamp) {

				pingRuins = true;
			}

			userMap.get('nr' + message.author.id + message.guild.id).lastMessageTimestamp = currentTimestamp;
		}

		clearTimeout(userMap.get('nr' + message.author.id + message.guild.id).activityTimeout);
		clearTimeout(userMap.get('nr' + message.author.id + message.guild.id).cooldownTimeout);
		clearTimeout(userMap.get('nr' + message.author.id + message.guild.id).restingTimeout);

		if (Object.hasOwn(activeCommandsObject, 'nr' + message.author.id + message.guild.id)) {

			await activeCommandsObject['nr' + message.author.id + message.guild.id]();
		}

		try {

			console.log(`\x1b[32m${message.author.tag} (${message.author.id})\x1b[0m successfully executed \x1b[33m${message.content} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				(/** @type {import('../typedef').ServerSchema} */ s) => {
					s.activeUsers.push(message.author.id);
				},
			));

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

					userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: userData.uuid }));
					userMap.get('nr' + message.author.id + message.guild.id).activeCommands -= 1;

					if (userData && userMap.get('nr' + message.author.id + message.guild.id).activeCommands <= 0) {

						userMap.get('nr' + message.author.id + message.guild.id).cooldownTimeout = setTimeout(removeCooldown, 1000);
					}
				});
		}
		catch (error) {

			userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: userData.uuid }));
			userMap.get('nr' + message.author.id + message.guild.id).activeCommands -= 1;

			if (userData && userMap.get('nr' + message.author.id + message.guild.id).activeCommands <= 0) {

				userMap.get('nr' + message.author.id + message.guild.id).cooldownTimeout = setTimeout(removeCooldown, 1000);
			}

			await errorHandling.output(message, error);
		}

		userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: userData.uuid }));
		characterData = userData.characters[userData.currentCharacter[message.guild.id]];
		profileData = characterData.profiles[message.guild.id];

		const oneHourInMs = 3600000;
		// If sapling exists, the watering time is between 2 hours from perfect and 3 hours from perfect, and there wasn't a reminder in the last hour
		// The reminder in the last hour prevents the reminder from being sent out multiple times
		if (profileData !== null && profileData.sapling.exists === true && Date.now() > profileData.sapling.nextWaterTimestamp + oneHourInMs * 2 && Date.now() < profileData.sapling.nextWaterTimestamp + oneHourInMs * 3 && Date.now() > userMap.get('nr' + message.author.id + message.guild.id).lastGentleWaterReminderTimestamp + oneHourInMs) {

			userMap.get('nr' + message.author.id + message.guild.id).lastGentleWaterReminderTimestamp = Date.now();

			await message.channel
				.send({
					embeds: [{
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: `*Engrossed in ${pronoun(characterData, 2)} work, ${characterData.name} suddenly remembers that ${pronounAndPlural(characterData, 0, 'has', 'have')} not yet watered ${pronoun(characterData, 2)} plant today. The ${characterData.species} should really do it soon!*`,
						footer: { text: 'Type "rp water" to water your ginkgo sapling!' },
					}],
				})
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});
		}

		/*
		This if block ensures that no two timeouts are set at the same time, and only one of them being cleared. When a command that doesn't immediately return (ie explore) is called, this timeout doesn't exist yet, but the old timeout was already cleared. If a second command (ie stats) is started while the old one is still running, it will try to delete the same timeout that the first command (aka explore) already cleared, and create a new one, that subsequently is going to be overwritten by the first command (aka explore) once it is finished. That means that the timeout created by the other command (aka stats) is never going to be cleared, and instead only the timeout of the last finished command (aka explore) is going to be cleared, which means that 10 minutes after the other command (aka stats) was executed, the user will start automatically resting, even if they were still actively playing in that time.
		It is not a good idea to place clearing the timeout behind the command finish executing, since the command finish executing might take some time, and the 10 minutes from that timer might over in that time, making the user attempt to rest while executing a command.
		It is also not a good idea to place starting the timeout before the command start executing, since the command again might take some time to finish executing, and then the 10 minute timer might be over sooner as expected.
		*/
		if (userMap.get('nr' + message.author.id + message.guild.id).activeCommands === 0) {

			userMap.get('nr' + message.author.id + message.guild.id).restingTimeout = setTimeout(module.exports.startRestingTimeout, 600000, client, message);
		}


		/**
		 * Sets `hasCooldown` to false.
		 */
		async function removeCooldown() {

			/** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../typedef').ProfileSchema} */ p) => {
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].hasCooldown = false;
				},
			));
		}

		/**
		 * Looks for this users ID in `activeUserArray` and removes it.
		 */
		async function removeActiveUser() {

			/** @type {import('../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				(/** @type {import('../typedef').ServerSchema} */ s) => {
					const authorIndex = s.activeUsers.findIndex(element => element === message.author.id);
					if (authorIndex >= 0) { s.activeUsers.splice(authorIndex, 1); }
				},
			));
		}
	},
};
module.exports = {
	...event,

	/**
	 * Checks if character is eligable for resting, and executes rest command if true.
	 * @param {import('../paw').client} client
	 * @param {import('discord.js').Message} message
	 */
	async startRestingTimeout(client, message) {

		const userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.author.id }));
		const characterData = userData.characters[userData.currentCharacter[message.guild.id]];
		const profileData = characterData.profiles[message.guild.id];

		const serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({ serverId: message.guild.id }));

		if (profileData && profileData.isResting === false && profileData.energy < profileData.maxEnergy) {

			if (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0 || serverData.blockedEntrance.den === 'sleeping dens') {

				/*
				This if block ensures that no two timeouts are set at the same time, and only one of them being cleared. When a command that doesn't immediately return (ie explore) is called, this timeout doesn't exist yet, but the old timeout was already cleared. If a second command (ie stats) is started while the old one is still running, it will try to delete the same timeout that the first command (aka explore) already cleared, and create a new one, that subsequently is going to be overwritten by the first command (aka explore) once it is finished. That means that the timeout created by the other command (aka stats) is never going to be cleared, and instead only the timeout of the last finished command (aka explore) is going to be cleared, which means that 10 minutes after the other command (aka stats) was executed, the user will start automatically resting, even if they were still actively playing in that time.
				It is not a good idea to place clearing the timeout behind the command finish executing, since the command finish executing might take some time, and the 10 minutes from that timer might over in that time, making the user attempt to rest while executing a command.
				It is also not a good idea to place starting the timeout before the command start executing, since the command again might take some time to finish executing, and then the 10 minute timer might be over sooner as expected.
				*/
				if (userMap.get('nr' + message.author.id + message.guild.id).activeCommands === 0) {

					userMap.get('nr' + message.author.id + message.guild.id).restingTimeout = setTimeout(module.exports.startRestingTimeout, 600000, client, message);
				}

				return;
			}

			message.content = `${config.prefix}rest`;

			await module.exports.execute(client, message);
		}
	},
};