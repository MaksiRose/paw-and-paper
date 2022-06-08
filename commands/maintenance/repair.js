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
const { MessageActionRow, MessageButton, MessageSelectMenu } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const sendNoDM = require('../../utils/sendNoDM');
const { materialsMap } = require('../../utils/itemsInfo');

module.exports.name = 'repair';

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
					description: `*A hunter rushes to stop the ${profileData.rank}.*\n"${characterData.name}, you are not trained to repair dens, it is very dangerous! You should be playing on the prairie instead."\n*${characterData.name} lowers ${pronoun(characterData, 2)} head and leaves in shame.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (Object.values(serverData.inventory.materials).filter(value => value > 0).length <= 0) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} goes to look if any dens need to be repaired. But it looks like the pack has nothing that can be used to repair dens in the first place. Looks like the ${characterData.displayedSpecies || characterData.species} needs to go out and find materials first!*`,
					footer: { text: 'Materials can be found through scavenging and adventuring.' },
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/** @type {import('discord.js').Message} */
	let botReply = null;
	let chosenDen = ['sleeping dens', 'food den', 'medicine den'].includes(argumentsArray.join(' ').toLowerCase()) ?
		['sleepingDens', 'foodDen', 'medicineDen'][
			['sleeping dens', 'food den', 'medicine den'].indexOf(argumentsArray.join(' ').toLowerCase())
		] : null;
	const denSelectMenu = new MessageActionRow().addComponents(
		[ new MessageButton({
			customId: 'repair-sleepingDens',
			label: 'Sleeping Dens',
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'repair-foodDen',
			label: 'Food Den',
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'repair-medicineDen',
			label: 'Medicine Den',
			style: 'SECONDARY',
		})],
	);

	if (chosenDen == null) {

		botReply = await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					color: characterData.color,
					description: `*${characterData.name} roams around the pack, looking if any dens need to be repaired.*`,
				}],
				components: [denSelectMenu],
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}
	else {

		const { embeds: embeds, components: components } = await getMaterials() ?? { embeds: undefined, components: undefined };

		botReply = await message
			.reply({
				content: messageContent,
				embeds: embeds,
				components: components,
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });
	}

	createCommandCollector(message.author.id, message.guild.id, botReply);
	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('repair') && i.user.id === message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction<"cached"> | null} } */
		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
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

		if (interaction.isButton()) {

			chosenDen = interaction.customId.replace('repair-', '');

			const { embeds: embeds, components: components } = await getMaterials() ?? { embeds: undefined, components: undefined };

			botReply = await interaction.message
				.edit({
					content: messageContent,
					embeds: embeds,
					components: components,
				})
				.catch((error) => { throw new Error(error); });
			interactionCollector();
		}

		if (interaction.isSelectMenu()) {

			const repairKind = materialsMap.get(interaction.values[0]).reinforcesStructure ? 'structure' : materialsMap.get(interaction.values[0]).improvesBedding ? 'bedding' : materialsMap.get(interaction.values[0]).thickensWalls ? 'thickness' : 'evenness';
			const repairAmount = function(points) {
				return (serverData.dens[chosenDen][repairKind] + points > 100) ? 100 - serverData.dens[chosenDen][repairKind] : points;
			}(generateRandomNumber(5, 6));

			const isSuccessful = repairAmount > 0 && !((profileData.rank === 'Apprentice' || profileData.rank === 'Healer') && pullFromWeightedTable({ 0: profileData.rank === 'Healer' ? 90 : 40, 1: 60 + profileData.sapling.waterCycles }) === 0);

			serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				(/** @type {import('../../typedef').ServerSchema} */ s) => {
					s.inventory.materials[interaction.values[0]] -= 1;
					if (isSuccessful) { s.dens[chosenDen][repairKind] += repairAmount; }
				},
			));

			const experiencePoints = isSuccessful === false ? 0 : profileData.rank == 'Elderly' ? generateRandomNumber(41, 20) : profileData.rank == 'Healer' ? generateRandomNumber(21, 10) : generateRandomNumber(11, 5);
			const energyPoints = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));
			const hungerPoints = await decreaseHunger(profileData);
			const thirstPoints = await decreaseThirst(profileData);

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].experience += experiencePoints;
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].energy -= energyPoints;
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].hunger -= hungerPoints;
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].thirst -= thirstPoints;
				},
			));
			characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
			profileData = characterData?.profiles?.[message.guild.id];

			let footerStats = `-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

			if (experiencePoints > 0) {

				footerStats = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n` + footerStats;
			}

			if (hungerPoints >= 1) {

				footerStats += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
			}

			if (thirstPoints >= 1) {

				footerStats += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
			}

			const denName = ['sleeping dens', 'food den', 'medicine den'][
				['sleepingDens', 'foodDen', 'medicineDen'].indexOf(chosenDen)
			];

			botReply = await interaction.message
				.edit({
					content: messageContent,
					embeds: [...embedArray, {
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						color: characterData.color,
						description: `*${characterData.name} takes a ${interaction.values[0]} and tries to ${repairKind === 'structure' ? 'tuck it into parts of the walls and ceiling that look less stable.' : repairKind === 'bedding' ? 'spread it over parts of the floor that look harsh and rocky.' : repairKind === 'thickness' ? 'cover parts of the walls that look a little thin with it.' : 'drag it over parts of the walls with bumps and material sticking out.'} ` + (isSuccessful ? `Immediately you can see the ${repairKind} of the den improving. What a success!*` : `After a few attempts, the material breaks into little pieces, rendering it useless. Looks like the ${characterData.displayedSpecies || characterData.species} has to try again...*`),
						footer: { text: `${footerStats}\n\n-1 ${interaction.values[0]} for ${message.guild.name}\n${isSuccessful ? `+${repairAmount}% ${repairKind} for ${denName} (${serverData.dens[chosenDen][repairKind]}%  total)` : ''}` },
					}],
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => { throw new Error(error); });

			botReply = await decreaseHealth(userData, botReply, { ...profileData.injuries });
			botReply = await checkLevelUp(message, botReply, userData, serverData);
			await isPassedOut(message, userData, true);
		}


		`*${characterData.name} gasps and pants as ${pronounAndPlural(characterData, 0, 'tries', 'try')} to remove the . All ${pronoun(characterData, 1)} strength might only barely be enough to clear the blockage. The ${characterData.displayedSpecies || characterData.species} should collect ${pronoun(characterData, 4)} for a moment, and then try again...*`;
		`*${characterData.name} gasps and pants as ${pronounAndPlural(characterData, 0, 'tries', 'try')} to remove the . All ${pronoun(characterData, 1)} strength is needed, but ${pronounAndPlural(characterData, 0, 'is', 'are')} able to successfully clear the blockage. The  can be used again!*`;
		`*${characterData.name} gasps and pants as ${pronounAndPlural(characterData, 0, 'tries', 'try')} to remove the . But ${pronoun(characterData, 1)} attempts don't seem to leave any lasting impact. Maybe the ${characterData.displayedSpecies || characterData.species} is going about this the wrong way.*`;
	}

	/**
	 * Displays the condition of the currently chosen den, as well as a list of the packs materials.
	 * @returns { Promise<{embeds: Array<import('discord.js').MessageEmbedOptions>, components: Array<import('discord.js').MessageActionRow>}> }
	 */
	async function getMaterials() {

		const embed = {
			author: { name: characterData.name, icon_url: characterData.avatarURL },
			color: characterData.color,
			description: `*${characterData.name} patrols around the den, looking for anything that has to be repaired. The condition isn't perfect, and reinforcing it would definitely improve its quality. But what would be the best way?*`,
			footer: { text: `Structure: ${serverData.dens[chosenDen].structure}%\nBedding: ${serverData.dens[chosenDen].bedding}%\nThickness: ${serverData.dens[chosenDen].thickness}%\nEvenness: ${serverData.dens[chosenDen].evenness}%` },
		};

		const embed2 = {
			color: characterData.color,
			title: `Inventory of ${message.guild.name} - Materials`,
			fields: [],
			footer: { text: 'Choose one of the materials above to repair the den with it!' },
		};

		let selectMenu = new MessageActionRow().addComponents(
			[ new MessageSelectMenu({
				customId: 'repair-options',
				placeholder: 'Select an item',
				options: [],
			})],
		);

		for (const [materialName, materialObject] of [...materialsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

			if (serverData.inventory.materials[materialName] > 0) {

				embed2.fields.push({ name: `${materialName}: ${serverData.inventory.materials[materialName]}`, value: materialObject.description, inline: true });
				/** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.push({ label: materialName, value: materialName, description: `${serverData.inventory.materials[materialName]}` });
			}
		}

		if (/** @type {import('discord.js').MessageSelectMenuOptions} */ (selectMenu.components[0]).options.length === 0) { selectMenu = null; }

		const
			embeds = [...embedArray, embed, embed2],
			components = [denSelectMenu, ...selectMenu != null ? [selectMenu] : []];

		return { embeds, components };
	}
};