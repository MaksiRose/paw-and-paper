import { EmbedBuilder, GuildMember, SlashCommandBuilder } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { respond } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { BanList, Character, GivenIdList, SlashCommand } from '../../typedef';
import { checkLevelRequirements, checkRankRequirements } from '../../utils/checkRoleRequirements';
import { commonPlantsMap, materialsMap, rarePlantsMap, specialPlantsMap, speciesMap, uncommonPlantsMap } from '../../utils/itemsInfo';
import { generateRandomNumber } from '../../utils/randomizers';
const { version } = require('../../../package.json');
const { default_color, error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'name';
const description: SlashCommand['description'] = 'Start your adventure! (Re-)name a character.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The name that you want your character to have.')
				.setMaxLength(24) // A normal name should only have 24 characters, but a displayname/nickname should still have 32 characters max length.
				.setRequired(true))
		.toJSON(),
	disablePreviousCommand: false,
	sendCommand: async (client, interaction, userData, serverData) => {

		/* This is checking if the user has any data saved in the database. If they don't, it will create a new user. */
		if (!userData) {

			/* Checking if the user is banned from using the bot. */
			const bannedList = JSON.parse(readFileSync('./database/bannedList.json', 'utf-8')) as BanList;
			if (bannedList.users.includes(interaction.user.id)) {

				await respond(interaction, {
					content: 'I am sorry to inform you that you have been banned from using this bot.',
					ephemeral: true,
				}, true)
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			}

			userData = await userModel.create({
				userId: interaction.user.id,
				advice: { resting: false, drinking: false, eating: false, passingout: false, coloredbuttons: false },
				reminders: { water: true, resting: true },
				characters: {},
				currentCharacter: {},
				autoproxy: {},
				lastPlayedVersion: `${version.split('.').slice(0, -1).join('.')}`,
				uuid: '',
			});
		}

		const name = interaction.options.getString('name');

		/* This is checking if the user has inputted a name for their character. If they haven't, it will send them an error message. If they have, it will check if the name is too long. If it is, it will send them an error message. */
		if (!name) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please input a name for your character.')],
				ephemeral: true,
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		/* This is checking if the user has a character in the database. If they don't, it will create a new user. */
		const characterData = (userData.characters[userData.currentCharacter[interaction.guildId || 'DM']] || null) as Character | null;
		const _id = characterData ? characterData._id : await createId();

		userData = await userModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(u) => {
				if (!characterData) {

					u.characters[_id] = {
						_id: _id,
						name: name,
						species: '',
						displayedSpecies: '',
						description: '',
						avatarURL: 'https://cdn.discordapp.com/embed/avatars/1.png',
						pronounSets: [['they', 'them', 'their', 'theirs', 'themselves', 'plural']],
						proxy: {
							startsWith: '',
							endsWith: '',
						},
						color: default_color,
						mentions: {},
						profiles: interaction.inGuild() ? {
							[interaction.guildId]: {
								serverId: interaction.guildId,
								rank: 'Youngling',
								levels: 1,
								experience: 0,
								health: 100,
								energy: 100,
								hunger: 100,
								thirst: 100,
								maxHealth: 100,
								maxEnergy: 100,
								maxHunger: 100,
								maxThirst: 100,
								temporaryStatIncrease: {},
								isResting: false,
								hasQuest: false,
								currentRegion: 'ruins',
								unlockedRanks: 0,
								sapling: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, lastMessageChannelId: null, sentReminder: false, sentGentleReminder: false },
								injuries: { wounds: 0, infections: 0, cold: false, sprains: 0, poison: false },
								inventory: {
									commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
									uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
									rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
									specialPlants: Object.fromEntries([...specialPlantsMap.keys()].sort().map(key => [key, 0])),
									meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
									materials: Object.fromEntries([...materialsMap.keys()].sort().map(key => [key, 0])),
								},
								roles: [],
								skills: { global: {}, personal: {} },
							},
						} : {},
					};
				}
				else {

					u.characters[_id].name = name;
				}

				u.currentCharacter[interaction.guildId || 'DM'] = _id;
			},
		);

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle(characterData === null ? `You successfully created the character ${name}!` : `You successfully renamed your character to ${name}!`)
				.setFooter(characterData === null ? { text: 'To continue setting up your profile for the RPG, type "rp species". For other options, review "rp help".' } : null)],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		/* This is checking if the user is in a guild, if the server has data saved in the database, and if the guildmember data is cached. If all of these are true, it will check if the user has reached the requirements to get roles based on their rank and level. */
		if (interaction.inGuild() && serverData && (interaction.member instanceof GuildMember)) {

			await checkRankRequirements(serverData, interaction, interaction.member, 'Youngling');
			await checkLevelRequirements(serverData, interaction, interaction.member, 1);
		}
	},
};

/**
 * Creates a unique 6-character ID.
 */
async function createId(): Promise<string> {

	const legend = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	let uuid = '';

	for (let index = 0; index < 6; index++) {

		uuid += legend[generateRandomNumber(legend.length)];
	}

	const givenIds = JSON.parse(readFileSync('./database/givenIds.json', 'utf-8')) as GivenIdList;

	if (givenIds.includes(uuid)) { return await createId(); }

	givenIds.push(uuid);
	writeFileSync('./database/givenIds.json', JSON.stringify(givenIds, null, '\t'));

	return uuid;
}