// @ts-check
const config = require('../../config.json');
const profileModel = require('../models/profileModel');
const serverModel = require('../models/serverModel');
const errorHandling = require('../utils/errorHandling');
const { activeCommandsObject } = require('../utils/commandCollector');
const { createGuild } = require('../utils/updateGuild');
const { pronoun, pronounAndPlural } = require('../utils/getPronouns');
const userMap = require('../utils/userMap');
const { sendVisitMessage } = require('../commands/interaction/requestvisit');
const { version } = require('../../package.json');

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

		if (message.author.bot) { return; }

		const prefix = config.prefix;

		/* Getting the user's profile data from the database. */
		let userData = /** @type {import('../typedef').ProfileSchema | null} */ (await profileModel.findOne({
			userId: message.author.id,
		}));
		let characterData = userData ? userData.characters[userData.currentCharacter[message.guildId || 'DM']] : null;

		let serverData = /** @type {import('../typedef').ServerSchema | null} */ (await serverModel.findOne({
			serverId: message.guildId,
		}));

		if (userData && serverData && message.inGuild()) {

			const allproxyIsDisabled = serverData.proxysetting.all.includes(message.channel.id) || serverData.proxysetting.all.includes('everywhere');
			const autoproxyIsDisabled = serverData.proxysetting.auto.includes(message.channel.id) || serverData.proxysetting.auto.includes('everywhere');

			/* Checking if the message starts with the character's proxy start and ends with the character's
			proxy end. If it does, it will set the current character to the character that the message is
			being sent from. */
			for (const character of Object.values(userData.characters)) {

				/* Checking if the message includes the proxy. If it does, it will change the message content
				to the prefix + 'say ' + the message content without the proxy. */
				const hasNoProxy = character.proxy.startsWith === '' && character.proxy.endsWith === '';
				const messageIncludesProxy = message.content.startsWith(character.proxy.startsWith) && message.content.endsWith(character.proxy.endsWith);
				if (!message.content.toLowerCase().startsWith(prefix) && !hasNoProxy && messageIncludesProxy && !allproxyIsDisabled) {

					if (userData.currentCharacter[message.guildId]) { userData.currentCharacter[message.guildId] = character._id; }
					message.content = prefix + 'say ' + message.content.substring(character.proxy.startsWith.length, message.content.length - character.proxy.endsWith.length);
				}
			}

			/* Checking if the user has autoproxy enabled in the current channel, and if so, it is adding the
			prefix to the message. */
			const autoproxyIsToggled = userData.autoproxy[message.guildId]?.includes(message.channel.id) || userData.autoproxy[message.guildId]?.includes('everywhere');
			if (!message.content.toLowerCase().startsWith(prefix) && autoproxyIsToggled && !allproxyIsDisabled && !autoproxyIsDisabled) {

				message.content = prefix + 'say ' + message.content;
			}

			if ((!message.content.toLowerCase().startsWith(prefix) || message.content.toLowerCase().startsWith(prefix + 'say ')) && serverData.currentlyVisiting !== null && message.channel.id === serverData.visitChannelId) {

				if (message.content.toLowerCase().startsWith(prefix + 'say ')) { message.content = message.content.substring((prefix + 'say ').length); }
				const otherServerData = /** @type {import('../typedef').ServerSchema | null} */ (await serverModel.findOne({ serverId: serverData.currentlyVisiting }));

				if (otherServerData) {

					await sendVisitMessage(client, message, userData, serverData, otherServerData);
					message.content = prefix + 'say ' + message.content;
				}
			}
		}

		/* Checking if the message starts with the prefix, if the author is a bot, or if the channel is a DM. */
		if (!message.content.toLowerCase().startsWith(prefix)) {

			return;
		}

		/* Checking if the serverData is null. If it is null, it will create a guild. */
		if (!serverData && message.inGuild()) {

			serverData = await createGuild(client, message.guild);
		}

		const embedArray = [];

		/* Taking the command name and arguments from the message and storing them in variables. */
		const argumentsArray = message.content.slice(prefix.length).trim().split(/ +/);
		const commandName = argumentsArray.shift()?.toLowerCase() || '';

		const command = client.commands[commandName] || client.commands[Object.keys(client.commands).find(cmnd => client.commands[cmnd].aliases !== undefined && client.commands[cmnd].aliases.includes(commandName)) || ''];

		/* Checking if the command is undefined. If it is, it will return. */
		if (command === undefined || !Object.hasOwn(command, 'sendMessage')) {

			return;
		}

		if (message.inGuild()) {

			if (userMap.has('nr' + message.author.id + message.guild.id) === false) {

				userMap.set('nr' + message.author.id + message.guild.id, { activeCommands: 0, lastGentleWaterReminderTimestamp: 0, activityTimeout: null, cooldownTimeout: null, restingTimeout: null });
			}

			if (module.exports.serverActiveUsers.has(message.guild.id) === false) {

				module.exports.serverActiveUsers.set(message.guild.id, [message.author.id]);
			}
			else if (!module.exports.serverActiveUsers.get(message.guild.id)?.includes(message.author.id)) {

				module.exports.serverActiveUsers.get(message.guild.id)?.push(message.author.id);
			}

			clearTimeout(userMap.get('nr' + message.author.id + message.guild.id)?.activityTimeout || undefined);
			clearTimeout(userMap.get('nr' + message.author.id + message.guild.id)?.cooldownTimeout || undefined);
			clearTimeout(userMap.get('nr' + message.author.id + message.guild.id)?.restingTimeout || undefined);

			// TO DO This should be updated to be called within commands, in order to prevent more edge-cases where this doesn't need to be called
			if (commandName !== 'say' && commandName !== 'stats' && commandName !== 'status' && Object.hasOwn(activeCommandsObject, 'nr' + message.author.id + message.guild.id)) {

				await activeCommandsObject['nr' + message.author.id + message.guild.id]();
			}

			// @ts-ignore
			userMap.get('nr' + message.author.id + message.guild.id).activeCommands += 1;
			// @ts-ignore
			userMap.get('nr' + message.author.id + message.guild.id).activityTimeout = setTimeout(removeActiveUser, 300000);
		}

		try {

			console.log(`\x1b[32m${message.author.tag} (${message.author.id})\x1b[0m successfully executed \x1b[31m${message.content} \x1b[0min \x1b[32m${message.guild?.name || 'DMs'} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);

			if (command.name !== 'say') {

				await message.channel
					.sendTyping()
					.catch(async (error) => {
						return await errorHandling.output(message, error);
					});
			}

			await command
				.sendMessage(client, message, argumentsArray, userData, serverData, embedArray)
				.then(async () => {

					if (message.inGuild()) {

						userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.author.id }));
						// @ts-ignore
						userMap.get('nr' + message.author.id + message.guild.id).activeCommands -= 1;

						// @ts-ignore
						if (userData && userMap.get('nr' + message.author.id + message.guild.id).activeCommands <= 0) {

							// @ts-ignore
							userMap.get('nr' + message.author.id + message.guild.id).cooldownTimeout = setTimeout(removeCooldown, 1000);
						}
					}
				});
		}
		catch (error) {

			if (message.inGuild()) {

				userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: userData?.uuid }));
				// @ts-ignore
				userMap.get('nr' + message.author.id + message.guild.id).activeCommands -= 1;

				// @ts-ignore
				if (userData && userMap.get('nr' + message.author.id + message.guild.id).activeCommands <= 0) {

					// @ts-ignore
					userMap.get('nr' + message.author.id + message.guild.id).cooldownTimeout = setTimeout(removeCooldown, 1000);
				}
			}

			await errorHandling.output(message, error);
		}

		userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ uuid: userData?.uuid }));

		if (Number(userData?.lastPlayedVersion) < Number(version.split('.').slice(0, -1).join('.'))) {

			await message
				.reply({
					content: `A new update has come out since you last played! You can view the changelog here: <https://github.com/MaksiRose/paw-and-paper/releases/tag/v${version.split('.').slice(0, -1).join('.')}.0>`,
					failIfNotExists: false,
				})
				.catch(async (error) => {
					return await errorHandling.output(message, error);
				});

			/** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../typedef').ProfileSchema} */ p) => {
					p.lastPlayedVersion = version.split('.').slice(0, -1).join('.');
				},
			));
		}

		if (message.inGuild()) {

			characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
			const profileData = characterData?.profiles?.[message.guild.id];

			const oneHourInMs = 3600000;
			// If sapling exists, the watering time is between 2 hours from perfect and 3 hours from perfect, and there wasn't a reminder in the last hour
			// The reminder in the last hour prevents the reminder from being sent out multiple times
			if (profileData != null && profileData.sapling.exists === true && Date.now() > (profileData.sapling.nextWaterTimestamp || 0) + oneHourInMs * 2 && Date.now() < (profileData.sapling.nextWaterTimestamp || 0) + oneHourInMs * 3 && Date.now() > (userMap.get('nr' + message.author.id + message.guild.id)?.lastGentleWaterReminderTimestamp || 0) + oneHourInMs) {

				// @ts-ignore
				userMap.get('nr' + message.author.id + message.guild.id).lastGentleWaterReminderTimestamp = Date.now();

				await message.channel
					.send({
						embeds: [{
							color: characterData.color,
							author: { name: characterData.name, icon_url: characterData.avatarURL },
							description: `*Engrossed in ${pronoun(characterData, 2)} work, ${characterData.name} suddenly remembers that ${pronounAndPlural(characterData, 0, 'has', 'have')} not yet watered ${pronoun(characterData, 2)} plant today. The ${characterData.displayedSpecies || characterData.species} should really do it soon!*`,
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
			if (userMap.get('nr' + message.author.id + message.guild.id)?.activeCommands === 0) {

				// @ts-ignore
				userMap.get('nr' + message.author.id + message.guild.id).restingTimeout = setTimeout(module.exports.startRestingTimeout, 600000, client, message);
			}
		}


		/** Sets `hasCooldown` to false. */
		async function removeCooldown() {

			/** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../typedef').ProfileSchema} */ p) => {
					if (p?.characters?.[p?.currentCharacter?.[message.guildId || 'DM']]?.profiles?.[message.guildId || 'DM']?.hasCooldown !== undefined) {
						p.characters[p.currentCharacter[message.guildId || 'DM']].profiles[message.guildId || 'DM'].hasCooldown = false;
					}
				},
			));
		}

		/** Looks for this users ID in `activeUserArray` and removes it. */
		async function removeActiveUser() {

			const authorIndex = module.exports.serverActiveUsers.get(message.guildId || '')?.findIndex(element => element === message.author.id);
			if (authorIndex && authorIndex >= 0) {

				module.exports.serverActiveUsers.get(message.guildId || '')?.splice(authorIndex, 1);
			}
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
		const characterData = userData?.characters?.[userData?.currentCharacter?.[message?.guildId || 'DM']];
		const profileData = characterData?.profiles?.[message?.guildId || 'DM'];

		if (profileData && profileData.isResting === false && profileData.energy < profileData.maxEnergy) {

			if (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0) {

				/*
				This if block ensures that no two timeouts are set at the same time, and only one of them being cleared. When a command that doesn't immediately return (ie explore) is called, this timeout doesn't exist yet, but the old timeout was already cleared. If a second command (ie stats) is started while the old one is still running, it will try to delete the same timeout that the first command (aka explore) already cleared, and create a new one, that subsequently is going to be overwritten by the first command (aka explore) once it is finished. That means that the timeout created by the other command (aka stats) is never going to be cleared, and instead only the timeout of the last finished command (aka explore) is going to be cleared, which means that 10 minutes after the other command (aka stats) was executed, the user will start automatically resting, even if they were still actively playing in that time.
				It is not a good idea to place clearing the timeout behind the command finish executing, since the command finish executing might take some time, and the 10 minutes from that timer might over in that time, making the user attempt to rest while executing a command.
				It is also not a good idea to place starting the timeout before the command start executing, since the command again might take some time to finish executing, and then the 10 minute timer might be over sooner as expected.
				*/
				if (userMap.get('nr' + message.author.id + message.guildId)?.activeCommands === 0) {

					// @ts-ignore
					userMap.get('nr' + message.author.id + message.guildId).restingTimeout = setTimeout(module.exports.startRestingTimeout, 600000, client, message);
				}

				return;
			}

			message.content = `${config.prefix}rest auto`;

			await module.exports.execute(client, message);
		}
	},

	/** @type {Map<string, Array<string>>} */
	serverActiveUsers: new Map(),
};