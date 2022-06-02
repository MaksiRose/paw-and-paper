// @ts-check
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { pronoun, pronounAndPlural } = require('../../utils/getPronouns');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('../gameplay/attack');
const serverModel = require('../../models/serverModel');
const profileModel = require('../../models/profileModel');
const { pullFromWeightedTable, generateRandomNumber } = require('../../utils/randomizers');
const { decreaseEnergy, decreaseHunger, decreaseThirst, decreaseHealth } = require('../../utils/checkCondition');
const { createCommandCollector } = require('../../utils/commandCollector');
const { checkLevelUp } = require('../../utils/levelHandling');
const { MessageActionRow, MessageButton } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const sendNoDM = require('../../utils/sendNoDM');

module.exports.name = 'dispose';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	if (await sendNoDM(message)) {

		return;
	}

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];

	if (await hasNotCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	if (profileData.rank === 'Youngling') {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*A hunter rushes to stop the ${profileData.rank}.*\n"${characterData.name}, you are not trained to dispose things that are blocking the dens, it is very dangerous! I don't ever wanna see you again in here without supervision!"\n*${characterData.name} lowers ${pronoun(characterData, 2)} head and leaves in shame.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (serverData.blockedEntrance.den === null) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} patrols around the pack, looking for anything that blocks entrances or might be a hazard. Luckily, it seems like everything is in order as of now.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let blockText = null;
	if (serverData.blockedEntrance.blockedKind === 'vines') blockText = 'thick vines appear to have grown over';
	if (serverData.blockedEntrance.blockedKind === 'burrow') blockText = 'someone seems to have built a big burrow right under';
	if (serverData.blockedEntrance.blockedKind === 'tree trunk') blockText = 'a rotten tree trunk has fallen in front of';
	if (serverData.blockedEntrance.blockedKind === 'boulder') blockText = 'a boulder has rolled in front of';

	let botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*${characterData.name} patrols around the pack, looking for anything that blocks entrances or might be a hazard. And indeed, ${blockText} the entrance to the ${serverData.blockedEntrance.den}, making it impossible to enter safely. The ${characterData.displayedSpecies || characterData.species} should remove it immediately! But what would be the best way?*`,
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
			.awaitMessageComponent({ filter, time: 60_000 })
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

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[botReply.guild.id]].profiles[botReply.guild.id].energy -= energyPoints;
				p.characters[p.currentCharacter[botReply.guild.id]].profiles[botReply.guild.id].hunger -= hungerPoints;
				p.characters[p.currentCharacter[botReply.guild.id]].profiles[botReply.guild.id].thirst -= thirstPoints;
			},
		));
		characterData = userData.characters[userData.currentCharacter[message.guild.id]];
		profileData = characterData.profiles[message.guild.id];

		let footerStats = `-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

		if (hungerPoints >= 1) {

			footerStats += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
		}

		if (thirstPoints >= 1) {

			footerStats += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
		}

		botReply.components = disableAllComponents(botReply.components);

		if ((interaction.customId === 'dispose-bite' && serverData.blockedEntrance.blockedKind === 'vines') || (interaction.customId === 'dispose-soil' && serverData.blockedEntrance.blockedKind === 'burrow') || (interaction.customId === 'dispose-trample' && serverData.blockedEntrance.blockedKind === 'tree trunk') || (interaction.customId === 'dispose-push' && serverData.blockedEntrance.blockedKind === 'boulder')) {

			/* The button the player choses is green. */
			/** @type {import('discord.js').MessageButton} */ (botReply.components[botReply.components.length - 1].components[botReply.components[botReply.components.length - 1].components.findIndex(button => button.customId === interaction.customId)]).style = 'SUCCESS';

			if ((profileData.rank === 'Apprentice' || profileData.rank === 'Healer') && pullFromWeightedTable({ 0: profileData.rank === 'Healer' ? 70 : 30, 1: 70 + profileData.sapling.waterCycles }) === 0) {

				botReply = await botReply
					.edit({
						content: messageContent,
						embeds: [...embedArray, {
							color: characterData.color,
							author: { name: characterData.name, icon_url: characterData.avatarURL },
							description: `*${characterData.name} gasps and pants as ${pronounAndPlural(characterData, 0, 'tries', 'try')} to remove the ${serverData.blockedEntrance.blockedKind}. All ${pronoun(characterData, 1)} strength might only barely be enough to clear the blockage. The ${characterData.displayedSpecies || characterData.species} should collect ${pronoun(characterData, 4)} for a moment, and then try again...*`,
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

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ uuid: userData.uuid },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[p.currentCharacter[botReply.guild.id]].profiles[botReply.guild.id].experience += experiencePoints;
				},
			));
			characterData = userData.characters[userData.currentCharacter[message.guild.id]];
			profileData = characterData.profiles[message.guild.id];

			footerStats = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n` + footerStats;

			await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				(/** @type {import('../../typedef').ServerSchema} */ s) => {
					s.blockedEntrance = { den: null, blockedKind: null };
				},
			);

			botReply = await botReply
				.edit({
					content: messageContent,
					embeds: [...embedArray, {
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: `*${characterData.name} gasps and pants as ${pronounAndPlural(characterData, 0, 'tries', 'try')} to remove the ${serverData.blockedEntrance.blockedKind}. All ${pronoun(characterData, 1)} strength is needed, but ${pronounAndPlural(characterData, 0, 'is', 'are')} able to successfully clear the blockage. The ${serverData.blockedEntrance.den} can be used again!*`,
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
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: `*${characterData.name} gasps and pants as ${pronounAndPlural(characterData, 0, 'tries', 'try')} to remove the ${serverData.blockedEntrance.blockedKind}. But ${pronoun(characterData, 1)} attempts don't seem to leave any lasting impact. Maybe the ${characterData.displayedSpecies || characterData.species} is going about this the wrong way.*`,
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

		botReply = await decreaseHealth(userData, botReply, { ...profileData.injuries });
		botReply = await checkLevelUp(message, botReply, userData, serverData);
		await isPassedOut(message, userData, true);
	}
};