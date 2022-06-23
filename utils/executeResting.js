// @ts-check
/** @type {Map<string, NodeJS.Timeout>} */
const restingTimeoutMap = new Map();
const { MessageActionRow, MessageButton } = require('discord.js');
const profileModel = require('../models/profileModel');
const serverModel = require('../models/serverModel');
const { pronounAndPlural } = require('./getPronouns');

/**
	 * Clears the timeout of the specific user that is resting.
	 * @param {string} userId
	 * @param {string} guildId
	 */
function stopResting(userId, guildId) {

	clearTimeout(restingTimeoutMap.get('nr' + userId + guildId));
}

/**
 * Starts a Timeout that gives the user one energy point every 30 seconds.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../typedef').ProfileSchema} userData
 * @param {import('discord.js').Message} botReply
 * @param {'sleeping dens' | 'food den' | 'medicine den' | 'prairie' | 'ruins' | 'lake'} previousRegion
 * @param {boolean} isAutomatic
 * @param {string} weardownText
 */
async function startResting(message, userData, botReply, previousRegion, isAutomatic, weardownText) {

	let energyPoints = 0;
	restingTimeoutMap.set('nr' + message.author.id + message.guild.id, setTimeout(addEnergy, 30_000 + await getExtraRestingTime(message)));

	/**
	 * Gives the user an energy point, checks if they reached the maximum, and create a new Timeout if they didn't.
	 * @returns {Promise<void>}
	 */
	async function addEnergy() {

		energyPoints += 1;

		userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].energy += 1;
			},
		));
		const characterData = userData.characters[userData.currentCharacter[message.guild.id]];
		const profileData = characterData.profiles[message.guild.id];

		botReply.embeds[botReply.embeds.length - 1].setFooter({ text: `+${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})${isAutomatic ? '\nYour character started resting because you were inactive for 10 minutes' : ''}\n\n${weardownText}\n\nTip: You can also do "rp vote" to get +30 energy per vote!` });

		await botReply
			.edit({
				embeds: botReply.embeds,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		/* It checks if the user has reached their maximum energy, and if they have, it stops the resting
		process. */
		if (profileData.energy >= profileData.maxEnergy) {

			await message.channel
				.sendTyping()
				.catch((error) => {
					throw new Error(error);
				});

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../typedef').ProfileSchema} */ p) => {
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].isResting = false;
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].currentRegion = previousRegion;
				},
			);

			await botReply
				.delete()
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			await message
				.reply({
					embeds: [{
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: `*${characterData.name}'s eyes blink open, ${pronounAndPlural(characterData, 0, 'sit')} up to stretch and then walk out into the light and buzz of late morning camp. Younglings are spilling out of the nursery, ambitious to start the day, Hunters and Healers are traveling in and out of the camp border. It is the start of the next good day!*`,
						footer: { text: `+${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})${(previousRegion !== 'sleeping dens') ? `\nYou are now at the ${previousRegion}` : ''}${isAutomatic ? '\nYour character started resting because you were inactive for 10 minutes' : ''}\n\n${weardownText}` },
					}],
					components: isAutomatic ? [ new MessageActionRow({
						components: [ new MessageButton({
							customId: `resting-reminder-${userData.reminders.resting === true ? 'off' : 'on'}`,
							label: `Turn automatic resting pings ${userData.reminders.resting === true ? 'off' : 'on'}`,
							style: 'SECONDARY',
						})],
					})] : [],
					allowedMentions: {
						repliedUser: (isAutomatic && userData.reminders.resting === false) ? false : true,
					},
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		restingTimeoutMap.set('nr' + message.author.id + message.guild.id, setTimeout(addEnergy, 30_000 + await getExtraRestingTime(message)));
		return;
	}
}

module.exports = {
	stopResting,
	startResting,
};

/**
 * It gets the server's den stats, calculates a multiplier based on those stats, and returns the
 * difference between 30,000 and 30,000 times the multiplier
 * @param {import('discord.js').Message} message - The message that triggered the command.
 * @returns {Promise<number>} the amount of time in milliseconds that the user will be resting for.
 */
async function getExtraRestingTime(message) {

	const serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({
		serverId: message.guild?.id,
	}));

	const denStats = serverData.dens.sleepingDens.structure + serverData.dens.sleepingDens.bedding + serverData.dens.sleepingDens.thickness + serverData.dens.sleepingDens.evenness;
	const multiplier = denStats / 400;
	return 30_000 - Math.round(30_000 * multiplier);
}