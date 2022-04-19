// @ts-check
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { pronoun, pronounAndPlural } = require('../../utils/getPronouns');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('../gameplay/attack');
const serverModel = require('../../models/serverModel');
const { profileModel } = require('../../models/profileModel');
const { pullFromWeightedTable, generateRandomNumber } = require('../../utils/randomizers');
const { decreaseEnergy, decreaseHunger, decreaseThirst, decreaseHealth } = require('../../utils/checkCondition');
const { createCommandCollector } = require('../../utils/commandCollector');
const { checkLevelUp } = require('../../utils/levelHandling');
const { MessageActionRow, MessageButton } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');

module.exports.name = 'dispose';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData, embedArray) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

		return;
	}

	profileData = await startCooldown(message, profileData);
	const messageContent = remindOfAttack(message);

	if (profileData.rank === 'Youngling' || profileData.rank === 'Healer') {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*A hunter rushes to stop the ${profileData.rank}.*\n"${profileData.name}, you are not trained to dispose things that are blocking the dens, it is very dangerous! I don't ever wanna see you again in here without supervision!"\n*${profileData.name} lowers ${pronoun(profileData, 2)} head and leaves in shame.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (serverData.blockedEntranceObject.den === null) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} patrols around the pack, looking for anything that blocks entrances or might be a hazard. Luckily, it seems like everything is in order as of now.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let blockText = null;
	if (serverData.blockedEntranceObject.blockedKind === 'vines') blockText = 'thick vines appear to have grown over';
	if (serverData.blockedEntranceObject.blockedKind === 'burrow') blockText = 'someone seems to have built a big burrow right under';
	if (serverData.blockedEntranceObject.blockedKind === 'tree trunk') blockText = 'a rotten tree trunk has fallen in front of';
	if (serverData.blockedEntranceObject.blockedKind === 'boulder') blockText = 'a boulder has rolled in front of';

	let botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} patrols around the pack, looking for anything that blocks entrances or might be a hazard. And indeed, ${blockText} the entrance to the ${serverData.blockedEntranceObject.den}, making it impossible to enter safely. The ${profileData.species} should remove it immediately! But what would be the best way?*`,
			}],
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: 'dispose-bite',
					label: 'Bite through',
					style: 'SECONDARY',
				}), new MessageButton({
					customId: 'dispose-soil',
					label: 'Throw soil',
					style: 'SECONDARY',
				}), new MessageButton({
					customId: 'dispose-trample',
					label: 'Trample',
					style: 'SECONDARY',
				}), new MessageButton({
					customId: 'dispose-push',
					label: 'Push away',
					style: 'SECONDARY',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);
	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('dispose') && i.user.id === message.author.id;

		/** @type {import('discord.js').SelectMenuInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 60000 })
			.catch(() => { return null; });

		if (interaction === null) {

			await botReply
				.edit({
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			return;
		}

		const energyPoints = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));
		const hungerPoints = await decreaseHunger(profileData);
		const thirstPoints = await decreaseThirst(profileData);

		profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$inc: {
					energy: -energyPoints,
					hunger: -hungerPoints,
					thirst: -thirstPoints,
				},
			},
		));

		let footerStats = `-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

		if (hungerPoints >= 1) {

			footerStats += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
		}

		if (thirstPoints >= 1) {

			footerStats += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
		}

		botReply.components = disableAllComponents(botReply.components);

		if ((interaction.customId === 'dispose-bite' && serverData.blockedEntranceObject.blockedKind === 'vines') || (interaction.customId === 'dispose-soil' && serverData.blockedEntranceObject.blockedKind === 'burrow') || (interaction.customId === 'dispose-trample' && serverData.blockedEntranceObject.blockedKind === 'tree trunk') || (interaction.customId === 'dispose-push' && serverData.blockedEntranceObject.blockedKind === 'boulder')) {

			/* The button the player choses is green. */
			/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === interaction.customId)]).style = 'SUCCESS';

			if (profileData.rank === 'Apprentice' && pullFromWeightedTable({ 0: 30, 1: 70 + profileData.saplingObject.waterCycles }) === 0) {

				botReply = await botReply
					.edit({
						content: messageContent,
						embeds: [...embedArray, {
							color: profileData.color,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							description: `*${profileData.name} gasps and pants as ${pronounAndPlural(profileData, 0, 'tries', 'try')} to remove the ${serverData.blockedEntranceObject.blockedKind}. All ${pronoun(profileData, 1)} strength might only barely be enough to clear the blockage. The ${profileData.species} should collect ${pronoun(profileData, 4)} for a moment, and then try again...*`,
							footer: { text: footerStats },
						}],
						components: botReply.components,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});

				checkHealthAndLevel();
				return;
			}

			const experiencePoints = profileData.rank === 'Elderly' ? generateRandomNumber(41, 20) : profileData.rank === 'Hunter' ? generateRandomNumber(21, 10) : generateRandomNumber(11, 5);

			profileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $inc: { experience: +experiencePoints } },
			));

			footerStats = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n` + footerStats;

			await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { blockedEntranceObject: { den: null, blockedKind: null } } },
			);

			botReply = await botReply
				.edit({
					content: messageContent,
					embeds: [...embedArray, {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} gasps and pants as ${pronounAndPlural(profileData, 0, 'tries', 'try')} to remove the ${serverData.blockedEntranceObject.blockedKind}. All ${pronoun(profileData, 1)} strength is needed, but ${pronounAndPlural(profileData, 0, 'is', 'are')} able to successfully clear the blockage. The ${serverData.blockedEntranceObject.den} can be used again!*`,
						footer: { text: footerStats },
					}],
					components: botReply.components,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
		}
		else {

			/* The button the player choses is red. */
			/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === interaction.customId)]).style = 'DANGER';

			botReply = await botReply
				.edit({
					content: messageContent,
					embeds: [...embedArray, {
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name} gasps and pants as ${pronounAndPlural(profileData, 0, 'tries', 'try')} to remove the ${serverData.blockedEntranceObject.blockedKind}. But ${pronoun(profileData, 1)} attempts don't seem to leave any lasting impact. Maybe the ${profileData.species} is going about this the wrong way.*`,
						footer: { text: footerStats },
					}],
					components: botReply.components,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
		}

		checkHealthAndLevel();
		return;
	}

	/**
	 * Checks whether to decrease the players health, level them up and if they are passed out.
	 */
	async function checkHealthAndLevel() {

		botReply = await decreaseHealth(profileData, botReply, { ...profileData.injuryObject });
		botReply = await checkLevelUp(message, botReply, profileData, serverData);
		await isPassedOut(message, profileData, true);
	}
};