import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getRandomNumber } from '../../utils/randomizers';
import { respond } from '../../utils/helperFunctions';
import { SlashCommand } from '../../typings/handle';
import { UserData } from '../../typings/data/user';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('roll')
		.setDescription('Roll dices.')
		.addNumberOption(option =>
			option.setName('sides')
				.setDescription('The amount of sides the dice should have. Default is 6.')
				.setMinValue(2)
				.setMaxValue(1000000))
		.addNumberOption(option =>
			option.setName('multiplier')
				.setDescription('The amount of dice that should be rolled. Default is 1.')
				.setMinValue(1)
				.setMaxValue(1000))
		.addStringOption(option =>
			option.setName('add-subtract')
				.setDescription('The amount that you would like to be added or subtracted from the roll. Can also be a /skill.')
				.setAutocomplete(true))
		.toJSON(),
	category: 'page4',
	position: 7,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendAutocomplete: async (interaction, userData) => {

		const focusedValue = interaction.options.getFocused();

		const choices: string[] = [];
		if (focusedValue === '') {
			choices.push(...Object.keys(userData?.quid?.profile?.skills?.global || []).map(v => `+ ${v}`));
			choices.push(...Object.keys(userData?.quid?.profile?.skills?.global || []).map(v => `- ${v}`));
			choices.push(...Object.keys(userData?.quid?.profile?.skills?.personal || []).map(v => `+ ${v}`));
			choices.push(...Object.keys(userData?.quid?.profile?.skills?.personal || []).map(v => `- ${v}`));
			for (let i = 1; i < 11; i++) {
				choices.push(`+ ${i}`);
				choices.push(`- ${i}`);
			}
		}
		else if (focusedValue.startsWith('+')) { choices.push(...findMatches('+', focusedValue.slice(1), userData)); }
		else if (focusedValue.startsWith('-')) { choices.push(...findMatches('-', focusedValue.slice(1), userData)); }
		else {

			choices.push(...findMatches('+', focusedValue, userData));
			choices.push(...findMatches('-', focusedValue, userData));
		}

		await interaction.respond(
			choices.slice(0, 25).map(choice => ({ name: choice, value: choice })),
		);
	},
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		const sides = interaction.options.getNumber('sides') ?? 6;
		const multiplier = interaction.options.getNumber('multiplier') ?? 1;

		const args = getSubstringArray(interaction.options.getString('add-subtract') ?? '');
		let addOrSubtract = 0;
		for (let i = 0; i < args.length; i++) {

			let argstr = args[i];
			if (argstr === undefined) { continue; }
			for (const [skill, value] of [...Object.entries(userData?.quid?.profile?.skills?.global || {}), ...Object.entries(userData?.quid?.profile?.skills?.personal || {})]) {

				if (argstr.includes(skill)) { argstr = argstr.replace(skill, String(value)); }
			}
			argstr = argstr.replace(/\s/g, '');
			if (!isNaN(Number(argstr))) { addOrSubtract += Number(argstr); }
		}

		const rolledDice: number[] = [];
		for (let i = 0; i < multiplier; i++) { rolledDice.push(getRandomNumber(sides, 1)); }

		const result = rolledDice.reduce((a, b) => a + b, 0) + addOrSubtract;
		const resultFull = rolledDice.join(', ') + (addOrSubtract > 0 ? ` + ${addOrSubtract}` : addOrSubtract < 0 ? ` ${addOrSubtract}` : '');
		const member = interaction.inCachedGuild() ? await interaction.guild.members.fetch(interaction.user.id).catch(() => { return undefined; }) : undefined;

		// This is always a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData?.quid?.color || member?.displayColor || interaction.user.accentColor || '#ffffff')
				.setAuthor({
					name: userData?.quid ? userData.quid.getDisplayname() : member?.displayName || interaction.user.tag,
					iconURL: userData?.quid?.avatarURL || member?.displayAvatarURL() || interaction.user.avatarURL() || undefined,
				})
				.setDescription(`🎲 You rolled a \`${result}\`!`)
				.setFooter({ text: resultFull.length > 2048 ? resultFull.substring(0, 2047) + '…' : resultFull })],
		});
		return;
	},
};

function findMatches(
	prefix: string,
	stringToCheck: string,
	userData: UserData<undefined, ''> | null,
	isComplete = false,
): string[] {

	const choices: string[] = [];
	stringToCheck = stringToCheck.trim();

	for (const skill of [...Object.keys(userData?.quid?.profile?.skills?.global || []), ...Object.keys(userData?.quid?.profile?.skills?.personal || [])]) {

		if ((isComplete && skill === stringToCheck) || (!isComplete && skill.includes(stringToCheck))) { choices.push(`${prefix} ${skill}`); }
	}

	if (stringToCheck === '') {
		if (!isComplete) {
			for (let i = 1; i < 11; i++) { choices.push(`${prefix} ${i}`); }
		}
	}
	else {
		for (let i = 0; i < (isComplete ? 1 : 7); i++) {
			const num = Number(stringToCheck + '0'.repeat(i));
			if (isNaN(num) || num > 1000000 || num < -1000000) { break; }
			choices.push(`${prefix} ${num}`);
		}
	}

	if (!isComplete) {

		/* This takes the entire string and splits it by all + and - while keeping the + and - at the beginning of the substring where they were found */
		const substrings = getSubstringArray(prefix + stringToCheck);
		if (substrings.length > 1) {

			/* What I'm doing here is combining the elements of substrings in every way in which you can shorten them to two strings, this way if at any point there is a substring that contains a + or -, it will be recognized */
			for (let i = 1; i < substrings.length; i++) {

				const substring1 = substrings.slice(0, i).join('');
				const choices1 = findMatches(substring1.charAt(0), substring1.slice(1), userData, true);
				const substring2 = substrings.slice(i).join('');
				const choices2 = findMatches(substring2.charAt(0), substring2.slice(1), userData);

				choices.push(...prepareCartesian(choices1, choices2));
			}
		}
	}

	return [...new Set(choices)];
}

function prepareCartesian(
	arr1: string[] = [],
	arr2: string[] = [],
): string[] {

	const res = [];
	for (let i = 0; i < arr1.length; i++) {
		for (let j = 0; j < arr2.length; j++) {
			res.push(`${arr1[i] || ''} ${arr2[j] || ''}`);
		}
	}
	return res;
}

/**
 * Split the string into an array of substrings, where each substring is delimited by a plus or minus sign.
 * @param {string} stringToCheck - The string to check for substrings.
 * @returns An array of strings.
 */
function getSubstringArray(
	stringToCheck: string,
): string[] { return stringToCheck.split(/(?=[+-])/g); }