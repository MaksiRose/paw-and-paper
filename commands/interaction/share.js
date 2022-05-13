// @ts-check
const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { error_color } = require('../../config.json');
const { generateRandomNumber, pullFromWeightedTable } = require('../../utils/randomizers');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { decreaseThirst, decreaseHunger, decreaseEnergy, decreaseHealth } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { remindOfAttack } = require('../gameplay/attack');
const { pronounAndPlural, pronoun } = require('../../utils/getPronouns');
const { addFriendshipPoints } = require('../../utils/friendshipHandling');
const sharingCooldownAccountsMap = new Map();

module.exports.name = 'share';

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

	if (sharingCooldownAccountsMap.has('nr' + message.author.id + message.guild.id) && Date.now() - sharingCooldownAccountsMap.get('nr' + message.author.id + message.guild.id) < 7200000) {

		await message
			.reply({
				content: messageContent,
				embeds: [{
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					title: 'You can only share every 2 hours!',
					description: `You can share again <t:${Math.floor((sharingCooldownAccountsMap.get('nr' + message.author.id + message.guild.id) + 7200000) / 1000)}:R>.`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (profileData.rank !== 'Elderly') {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} is about to begin sharing a story when an elderly interrupts them.* "Oh, young ${characterData.species}, you need to have a lot more adventures before you can start advising others!"`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (message.mentions.users.size > 0 && message.mentions.users.first().id == message.author.id) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} is very wise from all the adventures ${pronoun(characterData, 0)} had, but also a little... quaint. Sometimes ${pronounAndPlural(characterData, 0, 'sit')} down at the fireplace, mumbling to ${pronoun(characterData, 4)} a story from back in the day. Busy packmates look at ${pronoun(characterData, 1)} in confusion as they pass by.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const thirstPoints = await decreaseThirst(profileData);
	const hungerPoints = await decreaseHunger(profileData);
	const energyPoints = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));

	userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.author.id },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].energy -= energyPoints;
			p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].hunger -= hungerPoints;
			p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].thirst -= thirstPoints;
			p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].currentRegion = 'ruins';
		},
	));
	characterData = userData.characters[userData.currentCharacter[message.guild.id]];
	profileData = characterData.profiles[message.guild.id];

	let embedFooterStatsText = `-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

	if (hungerPoints >= 1) {

		embedFooterStatsText += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
	}

	if (thirstPoints >= 1) {

		embedFooterStatsText += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
	}

	if (profileData.currentRegion != 'ruins') {

		embedFooterStatsText += '\nYou are now at the ruins';
	}

	let healthPoints = 0;
	const userInjuryObject = { ...profileData.injuries };

	const embed = {
		color: characterData.color,
		author: { name: characterData.name, icon_url: characterData.avatarURL },
		description: '',
		footer: { text: '' },
	};

	/** @type {import('../../typedef').ProfileSchema} */
	let partnerUserData;
	/** @type {import('../../typedef').Character} */
	let partnerCharacterData;
	/** @type {import('../../typedef').Profile} */
	let partnerProfileData;
	/** @type {Array<import('discord.js').MessageEmbedOptions>} */
	let extraEmbeds = [];

	if (!message.mentions.users.size) {

		const allRuinUsersList = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel
			.find(
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					return Object.values(p.characters).filter(c => c.profiles[message.guild.id] !== undefined && c.profiles[message.guild.id].currentRegion === 'ruins' && c.profiles[message.guild.id].energy > 0 && c.profiles[message.guild.id].health > 0 && c.profiles[message.guild.id].hunger > 0 && c.profiles[message.guild.id].thirst > 0 && c.profiles[message.guild.id].injuries.cold === false).length > 0;
				},
			))
			.map(user => user.userId)
			.filter(userId => userId != userData.userId);

		if (allRuinUsersList.length > 0) {

			const allRuinsProfilesArrayRandomIndex = generateRandomNumber(allRuinUsersList.length, 0);

			partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({
				userId: allRuinUsersList[allRuinsProfilesArrayRandomIndex],
			}));
			partnerCharacterData = Object.values(partnerUserData.characters).find(c => c.profiles[message.guild.id] !== undefined && c.profiles[message.guild.id].currentRegion === 'ruins' && c.profiles[message.guild.id].energy > 0 && c.profiles[message.guild.id].health > 0 && c.profiles[message.guild.id].hunger > 0 && c.profiles[message.guild.id].thirst > 0 && c.profiles[message.guild.id].injuries.cold === false);
			partnerProfileData = partnerCharacterData?.[message.guild.id];

			if (partnerProfileData.energy > 0 && partnerProfileData.health > 0 && partnerProfileData.hunger > 0 || partnerProfileData.thirst > 0) {

				extraEmbeds = await shareStory();
			}
			else {

				extraEmbeds = await noSharing();
			}
		}
		else {

			extraEmbeds = await noSharing();
		}
	}
	else {

		partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.mentions.users.first().id }));
		partnerCharacterData = Object.values(partnerUserData.characters).find(c => c.profiles[message.guild.id] !== undefined && c.profiles[message.guild.id].currentRegion === 'ruins');
		partnerProfileData = partnerCharacterData?.[message.guild.id];

		if (!partnerCharacterData || partnerCharacterData.name === '' || partnerCharacterData.species === '' || !partnerProfileData || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0) {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].energy += energyPoints;
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].hunger += hungerPoints;
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].thirst += thirstPoints;
				},
			);

			await message
				.reply({
					content: messageContent,
					embeds: [...embedArray, {
						color: /** @type {`#${string}`} */ (error_color),
						title: 'The mentioned user has no account or is passed out :(',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
		else {

			extraEmbeds = await shareStory();
		}
	}

	let botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, ...extraEmbeds],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	botReply = await checkLevelUp(message, botReply, userData, serverData);
	await decreaseHealth(userData, botReply, userInjuryObject);
	await isPassedOut(message, userData, false);

	if (partnerUserData !== null) { await addFriendshipPoints(message, userData, characterData._id, partnerUserData, partnerCharacterData._id); }


	/**
	 * Shares a story with a user.
	 * @returns {Promise<Array<import('discord.js').MessageEmbedOptions>>}
	 */
	async function shareStory() {

		sharingCooldownAccountsMap.set('nr' + message.author.id + message.guild.id, Date.now());

		const partnerExperiencePoints = generateRandomNumber(Math.round((partnerProfileData.levels * 50) * 0.15), Math.round((partnerProfileData.levels * 50) * 0.05));

		partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: partnerUserData.userId },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[partnerCharacterData._id].profiles[message.guild.id].experience += partnerExperiencePoints;
			},
		));
		partnerCharacterData = partnerUserData.characters[partnerCharacterData._id];
		partnerProfileData = partnerCharacterData?.[message.guild.id];

		embed.description = `*${partnerCharacterData.name} comes running to the old wooden trunk at the ruins where ${characterData.name} sits, ready to tell an exciting story from long ago. Their eyes are sparkling as the ${characterData.species} recounts great adventures and the lessons to be learned from them.*`;
		embed.footer.text = `${embedFooterStatsText}\n+${partnerExperiencePoints} XP for ${partnerCharacterData.name} (${partnerProfileData.experience}/${partnerProfileData.levels * 50})`;

		/** @type {Array<import('discord.js').MessageEmbedOptions>} */
		extraEmbeds = [embed];

		if (partnerProfileData.experience >= partnerProfileData.levels * 50) {

			partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: partnerUserData.userId },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[partnerCharacterData._id].profiles[message.guild.id].experience += -(p.characters[partnerCharacterData._id].profiles[message.guild.id].levels * 50);
					p.characters[partnerCharacterData._id].profiles[message.guild.id].levels += 1;
				},
			));
			partnerCharacterData = partnerUserData.characters[partnerCharacterData._id];
			partnerProfileData = partnerCharacterData?.[message.guild.id];

			extraEmbeds.push({
				color: partnerCharacterData.color,
				author: { name: partnerCharacterData.name, icon_url: partnerCharacterData.avatarURL },
				title: `${partnerCharacterData.name} just leveled up! They are now level ${partnerProfileData.levels}.`,
			});
		}

		if (partnerProfileData.injuries.cold === true && profileData.injuries.cold === false && pullFromWeightedTable({ 0: 3, 1: 7 }) === 0) {

			healthPoints = generateRandomNumber(5, 3);

			if (profileData.health - healthPoints < 0) {

				healthPoints = profileData.health;
			}

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ userId: message.author.id },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].health -= healthPoints;
				},
			));

			userInjuryObject.cold = true;

			extraEmbeds.push({
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*Suddenly, ${characterData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${partnerCharacterData.name}, who was coughing as well. That was probably not the best idea!*`,
				footer: { text: `-${healthPoints} HP (from cold)` },
			});
		}

		return extraEmbeds;
	}

	/**
	 * Sends a message that there is no one to share with.
	 * @returns {Promise<Array<import('discord.js').MessageEmbedOptions>>}
	 */
	async function noSharing() {

		embed.description = `*${characterData.name} sits on an old wooden trunk at the ruins, ready to tell a story to any willing listener. But to ${pronoun(characterData, 2)} disappointment, no one seems to be around.*`;
		embed.footer.text = '';

		userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: message.author.id },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].energy += energyPoints;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].hunger += hungerPoints;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].thirst += thirstPoints;
			},
		));

		extraEmbeds.push(embed);
		return extraEmbeds;
	}
};