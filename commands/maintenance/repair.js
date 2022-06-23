// @ts-check
const { hasCompletedAccount } = require('../../utils/checkAccountCompletion');
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
const { MessageActionRow, MessageButton, MessageSelectMenu, MessageEmbed } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const isInGuild = require('../../utils/isInGuild');
const { materialsMap } = require('../../utils/itemsInfo');
const { eatAdvice, drinkAdvice, restAdvice } = require('../../utils/adviceMessages');

module.exports.name = 'repair';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	if (!isInGuild(message)) {

		return;
	}

	let characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	let profileData = characterData?.profiles?.[message.guild.id];

	if (!hasCompletedAccount(message, characterData)) {

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

	let botReply = await message
		.reply(!chosenDen ? {
			content: messageContent,
			embeds: [...embedArray, {
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				color: characterData.color,
				description: `*${characterData.name} roams around the pack, looking if any dens need to be repaired.*`,
			}],
			components: [denSelectMenu],
			failIfNotExists: false,
		} : {
			content: messageContent,
			embeds: (await getMaterials()).embeds || undefined,
			components: (await getMaterials()).components || undefined,
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild.id, botReply);
	interactionCollector();

	async function interactionCollector() {

		/** @type {import('discord.js').MessageComponentInteraction | null} } */
		const interaction = await botReply
			.awaitMessageComponent({
				filter: (i) => i.user.id === message.author.id,
				time: 120_000,
			})
			.catch(() => { return null; });

		if (interaction === null || !interaction.inCachedGuild()) {

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

			botReply = await interaction.message
				.edit({
					content: messageContent,
					embeds: (await getMaterials()).embeds || undefined,
					components: (await getMaterials()).components || undefined,
				})
				.catch((error) => { throw new Error(error); });
			interactionCollector();
		}

		if (interaction.isSelectMenu()) {

			const repairKind = materialsMap.get(interaction.values[0])?.reinforcesStructure ? 'structure' : materialsMap.get(interaction.values[0])?.improvesBedding ? 'bedding' : materialsMap.get(interaction.values[0])?.thickensWalls ? 'thickness' : 'evenness';
			const repairAmount = function(points) {
				// @ts-ignore, since select menus always have a chosen den
				return (serverData.dens[chosenDen][repairKind] + points > 100) ? 100 - serverData.dens[chosenDen][repairKind] : points;
			}(generateRandomNumber(5, 6));

			const isSuccessful = repairAmount > 0 && !((profileData.rank === 'Apprentice' || profileData.rank === 'Healer') && pullFromWeightedTable({ 0: profileData.rank === 'Healer' ? 90 : 40, 1: 60 + profileData.sapling.waterCycles }) === 0);

			serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
				{ serverId: interaction.guild.id },
				(/** @type {import('../../typedef').ServerSchema} */ s) => {
					s.inventory.materials[interaction.values[0]] -= 1;
					// @ts-ignore, since select menus always have a chosen den
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
					p.characters[p.currentCharacter[interaction.guild.id]].profiles[interaction.guild.id].experience += experiencePoints;
					p.characters[p.currentCharacter[interaction.guild.id]].profiles[interaction.guild.id].energy -= energyPoints;
					p.characters[p.currentCharacter[interaction.guild.id]].profiles[interaction.guild.id].hunger -= hungerPoints;
					p.characters[p.currentCharacter[interaction.guild.id]].profiles[interaction.guild.id].thirst -= thirstPoints;
				},
			));
			characterData = userData?.characters?.[userData?.currentCharacter?.[interaction.guild.id]];
			profileData = characterData?.profiles?.[interaction.guild.id];

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
				// @ts-ignore, since select menus always have a chosen den
				['sleepingDens', 'foodDen', 'medicineDen'].indexOf(chosenDen)
			];

			botReply = await interaction.message
				.edit({
					content: messageContent,
					embeds: [...embedArray, {
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						color: characterData.color,
						description: `*${characterData.name} takes a ${interaction.values[0]} and tries to ${repairKind === 'structure' ? 'tuck it into parts of the walls and ceiling that look less stable.' : repairKind === 'bedding' ? 'spread it over parts of the floor that look harsh and rocky.' : repairKind === 'thickness' ? 'cover parts of the walls that look a little thin with it.' : 'drag it over parts of the walls with bumps and material sticking out.'} ` + (isSuccessful ? `Immediately you can see the ${repairKind} of the den improving. What a success!*` : `After a few attempts, the material breaks into little pieces, rendering it useless. Looks like the ${characterData.displayedSpecies || characterData.species} has to try again...*`),
						// @ts-ignore, since select menus always have a chosen den
						footer: { text: `${footerStats}\n\n-1 ${interaction.values[0]} for ${interaction.guild.name}\n${isSuccessful ? `+${repairAmount}% ${repairKind} for ${denName} (${serverData.dens[chosenDen][repairKind]}%  total)` : ''}` },
					}],
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => { throw new Error(error); });

			botReply = await decreaseHealth(userData, botReply, { ...profileData.injuries });
			// @ts-ignore, since message must be in guild
			botReply = await checkLevelUp(message, userData, serverData, botReply) || botReply;
			// @ts-ignore, since message must be in guild
			await isPassedOut(message, userData, true);

			// @ts-ignore, since message must be in guild
			await restAdvice(message, userData);
			// @ts-ignore, since message must be in guild
			await drinkAdvice(message, userData);
			// @ts-ignore, since message must be in guild
			await eatAdvice(message, userData);
		}


		`*${characterData.name} gasps and pants as ${pronounAndPlural(characterData, 0, 'tries', 'try')} to remove the . All ${pronoun(characterData, 1)} strength might only barely be enough to clear the blockage. The ${characterData.displayedSpecies || characterData.species} should collect ${pronoun(characterData, 4)} for a moment, and then try again...*`;
		`*${characterData.name} gasps and pants as ${pronounAndPlural(characterData, 0, 'tries', 'try')} to remove the . All ${pronoun(characterData, 1)} strength is needed, but ${pronounAndPlural(characterData, 0, 'is', 'are')} able to successfully clear the blockage. The  can be used again!*`;
		`*${characterData.name} gasps and pants as ${pronounAndPlural(characterData, 0, 'tries', 'try')} to remove the . But ${pronoun(characterData, 1)} attempts don't seem to leave any lasting impact. Maybe the ${characterData.displayedSpecies || characterData.species} is going about this the wrong way.*`;
	}

	/**
	 * Displays the condition of the currently chosen den, as well as a list of the packs materials.
	 * @returns { Promise<{embeds: Array<import('discord.js').MessageEmbed>, components: Array<import('discord.js').MessageActionRow>}> }
	 */
	async function getMaterials() {

		const embed = new MessageEmbed()
			.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
			.setColor(characterData.color)
			.setDescription(`*${characterData.name} patrols around the den, looking for anything that has to be repaired. The condition isn't perfect, and reinforcing it would definitely improve its quality. But what would be the best way?*`)
			// @ts-ignore, since select menus always have a chosen den
			.setFooter({ text: `Structure: ${serverData.dens[chosenDen].structure}%\nBedding: ${serverData.dens[chosenDen].bedding}%\nThickness: ${serverData.dens[chosenDen].thickness}%\nEvenness: ${serverData.dens[chosenDen].evenness}%` });

		const embed2 = new MessageEmbed()
			.setColor(characterData.color)
			.setTitle(`Inventory of ${profileData.serverId} - Materials`)
			.setFooter({ text: 'Choose one of the materials above to repair the den with it!' });

		const selectMenu = new MessageSelectMenu({
			customId: 'repair-options',
			placeholder: 'Select an item',
		});

		for (const [materialName, materialObject] of [...materialsMap.entries()].sort((a, b) => (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)) {

			if (serverData.inventory.materials[materialName] > 0) {

				embed2.addField(`${materialName}: ${serverData.inventory.materials[materialName]}`, materialObject.description, true);
				selectMenu.addOptions({ label: materialName, value: materialName, description: `${serverData.inventory.materials[materialName]}` });
			}
		}

		const
			embeds = [...embedArray, embed, embed2],
			components = [denSelectMenu, ...selectMenu.options.length > 0 ? [new MessageActionRow().addComponents([selectMenu])] : []];

		return { embeds, components };
	}
};
