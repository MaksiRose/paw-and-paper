// @ts-check
const { error_color } = require('../../config.json');
const { generateRandomNumber } = require('../../utils/randomizers');

module.exports.name = 'diceroll';
module.exports.aliases = ['dice', 'roll', 'rolldice'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData) => {

	const dice = argumentsArray.splice(0, 1)[0];
	const multiplier = dice?.toLowerCase().split('d')[0] === '' ? 1 : Number(dice?.toLowerCase().split('d')[0]);
	const faces = Number(dice?.toLowerCase().split('d')[1]);

	let args = argumentsArray.join('');
	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];
	const profileData = characterData?.profiles?.[message.guild.id];
	for (const [skill, value] of [...Object.entries(profileData?.skills?.global), ...Object.entries(profileData?.skills?.personal)]) {

		if (args.includes(skill)) { args = args.replace(skill, `${value}`);}
	}

	const addOrSubtract = Number(args);

	if (isNaN(multiplier) || multiplier < 1 || isNaN(faces) || faces < 2 || isNaN(addOrSubtract)) {

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					title: 'This is a command to roll a dice. Here is how to use the command:',
					description: 'The command has three sections: number of dice (optional), number of faces, and addition/subtraction (optional). Number of dice and number of faces is separated by a "D" with no spaces. After that, you can include an amount that you would like to be added or subtracted from your diceroll. You can also use the name of a `skill` as the amount.\n\nExamples:\n`rp diceroll D6` - Number between 1 and 6.\n`rp diceroll 2D20 + 12` - Number between 14 and 52.\n`rp rolldice 5d12 -4` - Number between 1 and 56.',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/** @type {Array<number>} */
	const rolledDice = [];

	for (let index = 0; index < multiplier; index++) {

		rolledDice.push(generateRandomNumber(faces, 1));
	}

	const result = rolledDice.reduce((a, b) => a + b, 0) + addOrSubtract;

	await message
		.reply({
			embeds: [{
				color: characterData?.color || message.member.displayHexColor,
				author: { name: characterData?.name || message.member.displayName, icon_url: characterData?.avatarURL || message.member.displayAvatarURL() },
				description: `You rolled a \`${result}\`!`,
				footer: { text: rolledDice.join(', ').length > 2048 ? rolledDice.join(', ').substring(0, 2045) + '...' : rolledDice.join(', ') },
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};