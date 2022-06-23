// @ts-check
const profileModel = require('../models/profileModel');
const { checkLevelRequirements, checkRoleCatchBlock } = require('./checkRoleRequirements');
const { upperCasePronounAndPlural } = require('./getPronouns');
const { default_color } = require('../config.json');

/**
 * Checks if the user is eligable for a level up, and sends a message if so.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../typedef').ProfileSchema} userData
 * @param {import('../typedef').ServerSchema} serverData
 * @param {import('discord.js').Message} [botReply]
 * @returns {Promise<import('discord.js').Message | undefined>}
 */
async function checkLevelUp(message, userData, serverData, botReply) {

	let characterData = userData.characters[userData.currentCharacter[message.guild.id]];
	let profileData = characterData.profiles[message.guild.id];

	const requiredExperiencePoints = profileData.levels * 50;

	if (profileData.experience >= requiredExperiencePoints) {

		userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].experience -= requiredExperiencePoints;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].levels += 1;
			},
		));
		characterData = userData.characters[userData.currentCharacter[message.guild.id]];
		profileData = characterData.profiles[message.guild.id];

		/** @type {import('discord.js').MessageEmbedOptions} */
		const embed = {
			color: characterData.color,
			title: `${characterData.name} just leveled up! ${upperCasePronounAndPlural(characterData, 0, 'is', 'are')} now level ${profileData.levels}.`,
		};

		botReply?.embeds?.push(/** @type {import('discord.js').MessageEmbed} */ (embed));
		await botReply
			?.edit({
				embeds: botReply?.embeds,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		const member = await message.guild.members.fetch(userData.userId);

		botReply = await module.exports.checkLevelUp(message, userData, serverData, botReply);
		await checkLevelRequirements(serverData, message, member, profileData.levels);
	}

	return botReply;
}

/**
 * Decreases the users level based on their current levels and removes their inventory, edits `botReply` and checks if any roles have to be removed.
 * @param {import('../typedef').ProfileSchema} userData
 * @param {import('discord.js').Message} botReply
 * @returns {Promise<import('discord.js').Message>}
 */
async function decreaseLevel(userData, botReply) {

	// @ts-ignore, since botReply is guaranteed to be in a guild
	let characterData = userData.characters[userData.currentCharacter[botReply.guild.id]];
	// @ts-ignore, since botReply is guaranteed to be in a guild
	let profileData = characterData.profiles[botReply.guild.id];

	const newUserLevel = Math.round(profileData.levels - (profileData.levels / 10));

	botReply.embeds[0].footer = { text: '' };
	botReply.embeds[0].footer.text = `${(newUserLevel !== profileData.levels) ? `-${profileData.levels - newUserLevel} level${(profileData.levels - newUserLevel > 1) ? 's' : ''}\n` : ''}${profileData.experience > 0 ? `-${profileData.experience} XP` : ''}`;

	const newUserInventory = {
		commonPlants: { ...profileData.inventory.commonPlants },
		uncommonPlants: { ...profileData.inventory.uncommonPlants },
		rarePlants: { ...profileData.inventory.rarePlants },
		meat: { ...profileData.inventory.meat },
	};

	for (const itemType of Object.keys(profileData.inventory)) {

		for (const item of Object.keys(profileData.inventory[itemType])) {

			if (newUserInventory[itemType][item] > 0) {

				botReply.embeds[0].footer.text += `\n-${profileData.inventory[itemType][item]} ${item}`;
				profileData.inventory[itemType][item] = 0;
			}
		}
	}

	userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(/** @type {import('../typedef').ProfileSchema} */ p) => {
			// @ts-ignore, since botReply is guaranteed to be in a guild
			p.characters[p.currentCharacter[botReply.guild.id]].profiles[botReply.guild.id].levels = newUserLevel;
			// @ts-ignore, since botReply is guaranteed to be in a guild
			p.characters[p.currentCharacter[botReply.guild.id]].profiles[botReply.guild.id].experience = 0;
			// @ts-ignore, since botReply is guaranteed to be in a guild
			p.characters[p.currentCharacter[botReply.guild.id]].profiles[botReply.guild.id].inventory = profileData.inventory;
		},
	));
	// @ts-ignore, since botReply is guaranteed to be in a guild
	characterData = userData.characters[userData.currentCharacter[botReply.guild.id]];
	// @ts-ignore, since botReply is guaranteed to be in a guild
	profileData = characterData.profiles[botReply.guild.id];

	if (botReply.embeds[0].footer.text === '') { botReply.embeds[0].footer = null; }

	botReply = await botReply
		.edit({
			embeds: botReply.embeds,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
			return botReply;
		});


	// @ts-ignore, since botReply is guaranteed to be in a guild
	const member = await botReply.guild.members.fetch(userData.userId);
	const roles = profileData.roles.filter(role => role.wayOfEarning === 'levels' && role.requirement > profileData.levels);

	for (const role of roles) {

		try {

			const userRoleIndex = profileData.roles.indexOf(role);
			if (userRoleIndex >= 0) { profileData.roles.splice(userRoleIndex, 1); }

			await profileModel.findOneAndUpdate(
				{ uuid: userData.uuid },
				(/** @type {import('../typedef').ProfileSchema} */ p) => {
					// @ts-ignore, since botReply is guaranteed to be in a guild
					p.characters[p.currentCharacter[botReply.guild.id]].profiles[botReply.guild.id].roles = profileData.roles;
				},
			);

			if (member.roles.cache.has(role.roleId) === true && profileData.roles.filter(profilerole => profilerole.roleId === role.roleId).length === 0) {

				await member.roles.remove(role.roleId);

				await botReply.channel
					.send({
						content: member.toString(),
						embeds: [{
							color: /** @type {`#${string}`} */ (default_color),
							// @ts-ignore, since botReply is guaranteed to be in a guild
							author: { name: botReply.guild.name, icon_url: botReply.guild.iconURL() || undefined },
							description: `You lost the <@&${role.roleId}> role because of a lack of levels!`,
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}
		}
		catch (error) {

			await checkRoleCatchBlock(error, botReply, member);
		}
	}

	return botReply;
}

module.exports = {
	checkLevelUp,
	decreaseLevel,
};