import { ActionRowBuilder, ButtonStyle, ButtonBuilder } from 'discord.js';
import { SpeciesHabitatType } from '../typings/main';
import { getArrayElement } from './helperFunctions';
import { getRandomNumber } from './randomizers';

export const plantEmojis = {
	/** These are the emojis of which one is selected that the player has to find, and the rest of them will be used as "neutral" emojis */
	findable: ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰'] as const,
	/** These are "neutral" emojis based on the habitat the player is in */
	habitat: {
		[SpeciesHabitatType.Cold]: ['🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔'] as const,
		[SpeciesHabitatType.Warm]: ['🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫'] as const,
		[SpeciesHabitatType.Water]: ['🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪨', '🪵', '🌴'] as const,
	},
	/** This is the emoji to avoid */
	toAvoid: '🏕️' as const,
};

// "o", "m", "1", "c", "8", "g", "T", "n", "4", "G", "r", "B", "J", "M"
export const accessiblePlantEmojis = {
	findable: ['x', 't', 'Q', '3', 'd', 'e', 'b', 'Y', 'h', 'A', 'H', 'X', '9', 'L', 'f', 'E', 'z'] as const,
	habitat: ['7', 'y', 'K', 'a', 'R', 'F', 'P', 's', 'k', 'N', '6', 'D', 'i'] as const,
	toAvoid: 'C' as const,
};

export type PlantGame = {
	thisRoundEmojiIndex: number;
	emojiToFind: (typeof plantEmojis.findable)[number] | (typeof accessiblePlantEmojis.findable)[number];
	plantComponent: ActionRowBuilder<ButtonBuilder>;
	correctButtonOverwrite: () => ActionRowBuilder<ButtonBuilder>;
	chosenRightButtonOverwrite: (customId: string) => ActionRowBuilder<ButtonBuilder>;
	chosenWrongButtonOverwrite: (customId: string) => ActionRowBuilder<ButtonBuilder>;
}

export function createPlantGame(
	playerHabitat: SpeciesHabitatType | 'accessible',
	lastRoundEmojiIndex?: number,
): PlantGame {

	const thisRoundEmojiIndex = getRandomNumber((playerHabitat === 'accessible' ? accessiblePlantEmojis : plantEmojis).findable.length, 0, lastRoundEmojiIndex);
	const emojiToFind = (playerHabitat === 'accessible' ? accessiblePlantEmojis : plantEmojis).findable[thisRoundEmojiIndex]; // emojiToFind can be undefined, which is unintended
	if (emojiToFind === undefined) { throw new TypeError('emojiToFind is undefined'); }

	const neutralEmojis = [
		...(playerHabitat === 'accessible' ? accessiblePlantEmojis : plantEmojis).findable,
		...(playerHabitat === 'accessible' ? accessiblePlantEmojis : plantEmojis).findable,
		...playerHabitat === 'accessible' ? accessiblePlantEmojis.habitat : plantEmojis.habitat[playerHabitat],
		...playerHabitat === 'accessible' ? accessiblePlantEmojis.habitat : plantEmojis.habitat[playerHabitat],
	].filter(value => value !== emojiToFind);

	const correctButtonIndex = getRandomNumber(5);
	const incorrectButtonIndex = getRandomNumber(5, 0, correctButtonIndex);

	const correctButtonEmojiToFindIndex = getRandomNumber(5);
	const incorrectButtonEmojiToFindIndex = getRandomNumber(5);
	const incorrectButtonEmojiToAvoidIndex = getRandomNumber(5, 0, incorrectButtonEmojiToFindIndex);

	const plantComponent = new ActionRowBuilder<ButtonBuilder>();
	for (let i = 0; i < 5; i++) {

		const emojisInButton: string[] = [];
		for (let j = 0; j < 5; j++) {

			if ((i === correctButtonIndex && j === correctButtonEmojiToFindIndex)
				|| (i === incorrectButtonIndex && j === incorrectButtonEmojiToFindIndex)) {

				emojisInButton.push(emojiToFind);
			}
			else if (i === incorrectButtonIndex && j === incorrectButtonEmojiToAvoidIndex) {

				emojisInButton.push((playerHabitat === 'accessible' ? accessiblePlantEmojis : plantEmojis).toAvoid);
			}
			else {

				const neutralEmoji = getArrayElement(neutralEmojis.splice(getRandomNumber(neutralEmojis.length), 1), 0);
				emojisInButton.push(neutralEmoji);
			}
		}

		plantComponent.addComponents(
			new ButtonBuilder()
				.setCustomId(emojisInButton.join(''))
				.setLabel(emojisInButton.join(' '))
				.setStyle(ButtonStyle.Secondary));
	}

	return {
		thisRoundEmojiIndex,
		emojiToFind,
		plantComponent,
		correctButtonOverwrite: () => plantComponent.setComponents(plantComponent.components.map(component => {

			const data = component.toJSON();

			if (data.style !== ButtonStyle.Link && data.custom_id.includes(emojiToFind) && !data.custom_id.includes((playerHabitat === 'accessible' ? accessiblePlantEmojis : plantEmojis).toAvoid)) { component.setStyle(ButtonStyle.Primary); }
			return component;
		})),
		chosenRightButtonOverwrite: (customId) => plantComponent.setComponents(plantComponent.components.map(component => {

			const data = component.toJSON();

			if (data.style !== ButtonStyle.Link && data.custom_id === customId) { component.setStyle(ButtonStyle.Success); }
			return component;
		})),
		chosenWrongButtonOverwrite: (customId) => plantComponent.setComponents(plantComponent.components.map(component => {

			const data = component.toJSON();

			if (data.style !== ButtonStyle.Link && data.custom_id === customId) { component.setStyle(ButtonStyle.Danger); }
			return component;
		})),
	};
}


const cycleKinds = ['_attack', 'dodge', 'defend'] as const; // It's _attack instead of attack because the overlap with the attack-command leads to bugs otherwise

export type FightGame = {
	thisRoundCycleIndex: number;
	cycleKind: (typeof cycleKinds)[number];
	fightComponent: ActionRowBuilder<ButtonBuilder>;
	correctButtonOverwrite: () => ActionRowBuilder<ButtonBuilder>;
	chosenRightButtonOverwrite: (customId: string) => ActionRowBuilder<ButtonBuilder>;
	chosenWrongButtonOverwrite: (customId: string) => ActionRowBuilder<ButtonBuilder>;
}

export function createFightGame(
	roundNumber?: number,
	lastRoundCycleIndex?: number,
): FightGame {

	const cycleKind = cycleKinds[getRandomNumber(cycleKinds.length, 0, lastRoundCycleIndex)]; // cycleKind can be undefined, which is unintended
	if (cycleKind === undefined) { throw new TypeError('cycleKind is undefined'); }

	const fightComponent = new ActionRowBuilder<ButtonBuilder>()
		.setComponents([
			new ButtonBuilder()
				.setCustomId(`_attack${roundNumber ? `_${roundNumber}` : ''}`)
				.setLabel('Attack')
				.setEmoji('⏫')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`defend${roundNumber ? `_${roundNumber}` : ''}`)
				.setLabel('Defend')
				.setEmoji('⏺️')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`dodge${roundNumber ? `_${roundNumber}` : ''}`)
				.setLabel('Dodge')
				.setEmoji('↪️')
				.setStyle(ButtonStyle.Secondary),
		].sort(() => Math.random() - 0.5));

	return {
		thisRoundCycleIndex: cycleKinds.findIndex(el => el === cycleKind),
		cycleKind,
		fightComponent,
		correctButtonOverwrite: () => fightComponent.setComponents(fightComponent.components.map(component => {

			const data = component.toJSON();

			if (data.style !== ButtonStyle.Link && data.custom_id.includes(
				cycleKind === 'defend' ? '_attack' : cycleKind === 'dodge' ? 'defend' : 'dodge',
			)) { component.setStyle(ButtonStyle.Primary); }
			return component;
		})),
		chosenRightButtonOverwrite: (customId) => fightComponent.setComponents(fightComponent.components.map(component => {

			const data = component.toJSON();

			if (data.style !== ButtonStyle.Link && data.custom_id === customId) { component.setStyle(ButtonStyle.Success); }
			return component;
		})),
		chosenWrongButtonOverwrite: (customId) => fightComponent.setComponents(fightComponent.components.map(component => {

			const data = component.toJSON();

			if (data.style !== ButtonStyle.Link && data.custom_id === customId) { component.setStyle(ButtonStyle.Danger); }
			return component;
		})),
	};
}